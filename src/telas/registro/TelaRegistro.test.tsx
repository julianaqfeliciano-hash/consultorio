import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { criarRepositorioMemoria } from '../../dados/memoria';
import { MENSAGEM_DO_RESUMO, ErroResumo, type Resumidor } from '../../dados/resumidor';
import { guardarRascunho, lerRascunho } from '../../dados/rascunhos';
import type { CamposRegistro, RegistroSessao, Responsavel } from '../../dominio/tipos';
import { pacienteExemplo, sessaoExemplo } from '../../testes/fabricas';
import { resumidorFalso } from '../../testes/resumidorFalso';
import { renderComRotas } from '../../testes/utilitarios';

const CAMINHO = '/agenda/sessoes/s1/registro';

const marta: Responsavel = {
  id: 'r1',
  pacienteId: 'p1',
  nome: 'Marta Souza',
  parentesco: 'mãe',
  cpf: null,
  telefone: '11999990000',
  email: null,
  principal: true,
  pagador: true,
};

function repositorio(registros: RegistroSessao[] = []) {
  return criarRepositorioMemoria({
    pacientes: [pacienteExemplo()],
    responsaveis: [marta],
    sessoes: [sessaoExemplo()],
    registros,
  });
}

const CAMPOS: CamposRegistro = {
  comoChegou: 'Chegou cansada.',
  trabalhado: 'Desenho livre.',
  observacoes: 'Falou da escola.',
  proximosPassos: 'Retomar o desenho.',
};

const registroSalvo = (sobre: Partial<RegistroSessao> = {}): RegistroSessao => ({
  sessaoId: 's1',
  textoFalado: 'texto antigo',
  ...CAMPOS,
  atualizadoEm: '2026-11-03T18:00:00.000Z',
  ...sobre,
});

const resumidorQue = (resumir: Resumidor['resumir']): Resumidor => ({ resumir: vi.fn(resumir) });

async function abrir(opcoes: Parameters<typeof renderComRotas>[1] = {}) {
  const resultado = renderComRotas(CAMINHO, opcoes);
  await screen.findByRole('heading', { name: 'Registro da sessão' });
  await waitFor(() => expect(screen.queryByText('Carregando…')).not.toBeInTheDocument());
  return { ...resultado, usuaria: userEvent.setup() };
}

const area = () => screen.getByLabelText('O que aconteceu na sessão');
const campo = (nome: string) => screen.getByLabelText(nome);
const botao = (nome: string) => screen.getByRole('button', { name: nome });

async function ditar(usuaria: ReturnType<typeof userEvent.setup>, texto: string) {
  await usuaria.type(area(), texto);
  await waitFor(() => expect(botao('Resumir')).toBeEnabled());
}

beforeEach(() => localStorage.clear());

describe('TelaRegistro', () => {
  it('resume e preenche os quatro campos com os nomes de volta', async () => {
    const resumidor = resumidorQue(async () => ({
      comoChegou: '[P] chegou bem com [R1].',
      trabalhado: 'Brincou.',
      observacoes: 'Nada.',
      proximosPassos: 'Voltar.',
    }));
    const { usuaria } = await abrir({ repositorio: repositorio(), resumidor });
    await waitFor(() => expect(screen.getByText(/Ana Clara Souza/)).toBeInTheDocument());
    await ditar(usuaria, 'Ana Clara veio com Marta.');
    await usuaria.click(botao('Resumir'));

    await waitFor(() => expect(campo('Como chegou')).toHaveValue('Ana chegou bem com Marta.'));
    expect(campo('O que foi trabalhado')).toHaveValue('Brincou.');
    expect(campo('Observações')).toHaveValue('Nada.');
    expect(campo('Próximos passos')).toHaveValue('Voltar.');
    // O nome não saiu do aparelho.
    expect(resumidor.resumir).toHaveBeenCalledWith('[P] veio com [R1].');
  });

  it('salva, mostra Registro salvo. e apaga o rascunho', async () => {
    const repo = repositorio();
    const { usuaria } = await abrir({ repositorio: repo });
    await ditar(usuaria, 'Falou muito.');
    await usuaria.click(botao('Resumir'));
    await waitFor(() => expect(campo('Como chegou')).toHaveValue('Chegou bem.'));
    await waitFor(() => expect(lerRascunho('s1')).not.toBeNull());

    await usuaria.click(botao('Salvar registro'));
    expect(await screen.findByText('Registro salvo.')).toBeInTheDocument();
    expect(lerRascunho('s1')).toBeNull();
    expect(await repo.obterRegistro('s1')).toMatchObject({
      textoFalado: 'Falou muito.',
      comoChegou: 'Chegou bem.',
      proximosPassos: 'Retomar na próxima.',
    });
  });

  it('abre com o rascunho e o aviso de recuperação quando há rascunho', async () => {
    guardarRascunho('s1', { textoFalado: 'ditado no meio', campos: { ...CAMPOS, comoChegou: 'Rascunho.' } });
    // O rascunho vence o registro salvo, que é mais antigo.
    await abrir({ repositorio: repositorio([registroSalvo()]) });
    expect(area()).toHaveValue('ditado no meio');
    expect(campo('Como chegou')).toHaveValue('Rascunho.');
    expect(screen.getByText('Rascunho recuperado deste aparelho.')).toBeInTheDocument();
  });

  it('abre com o registro salvo quando ele é mais novo que o rascunho deste aparelho', async () => {
    // Rascunho velho, deixado neste aparelho; o registro foi salvo depois, em outro aparelho.
    const velho = { textoFalado: 'rascunho velho', campos: { ...CAMPOS, comoChegou: 'Velho.' }, atualizadoEm: '2026-11-02T10:00:00.000Z' };
    localStorage.setItem('consultorio:rascunho-registro:s1', JSON.stringify(velho));
    await abrir({ repositorio: repositorio([registroSalvo({ atualizadoEm: '2026-11-03T18:00:00.000Z' })]) });
    expect(area()).toHaveValue('texto antigo');
    expect(campo('Como chegou')).toHaveValue('Chegou cansada.');
    expect(screen.queryByText('Rascunho recuperado deste aparelho.')).not.toBeInTheDocument();
  });

  it('abre com o registro salvo quando não há rascunho', async () => {
    await abrir({ repositorio: repositorio([registroSalvo()]) });
    expect(area()).toHaveValue('texto antigo');
    expect(campo('Observações')).toHaveValue('Falou da escola.');
    expect(screen.queryByText('Rascunho recuperado deste aparelho.')).not.toBeInTheDocument();
  });

  it('sem internet: mostra a mensagem exata, mantém o texto e não salva', async () => {
    const repo = repositorio();
    const resumidor = resumidorQue(async () => {
      throw new ErroResumo('sem_internet');
    });
    const { usuaria } = await abrir({ repositorio: repo, resumidor });
    await ditar(usuaria, 'Texto importante.');
    await usuaria.click(botao('Resumir'));

    expect(await screen.findByText(MENSAGEM_DO_RESUMO.sem_internet)).toBeInTheDocument();
    expect(botao('Tentar de novo')).toBeInTheDocument();
    expect(area()).toHaveValue('Texto importante.');
    await waitFor(() => expect(lerRascunho('s1')?.textoFalado).toBe('Texto importante.'));
    expect(await repo.obterRegistro('s1')).toBeNull();
  });

  it('recusa: mostra a mensagem exata', async () => {
    const resumidor = resumidorQue(async () => {
      throw new ErroResumo('recusa');
    });
    const { usuaria } = await abrir({ repositorio: repositorio(), resumidor });
    await ditar(usuaria, 'Algo.');
    await usuaria.click(botao('Resumir'));
    expect(await screen.findByText(MENSAGEM_DO_RESUMO.recusa)).toBeInTheDocument();
  });

  it('Tentar de novo chama o resumidor outra vez', async () => {
    const resumir = vi
      .fn<Resumidor['resumir']>()
      .mockRejectedValueOnce(new ErroResumo('falha'))
      .mockResolvedValueOnce(CAMPOS);
    const { usuaria } = await abrir({ repositorio: repositorio(), resumidor: { resumir } });
    await ditar(usuaria, 'Algo.');
    await usuaria.click(botao('Resumir'));
    await usuaria.click(await screen.findByRole('button', { name: 'Tentar de novo' }));

    await waitFor(() => expect(campo('Como chegou')).toHaveValue('Chegou cansada.'));
    expect(resumir).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(MENSAGEM_DO_RESUMO.falha)).not.toBeInTheDocument();
  });

  it('com campos preenchidos, Resumir pede confirmação e Cancelar não troca nada', async () => {
    const resumidor = resumidorFalso();
    const { usuaria } = await abrir({ repositorio: repositorio([registroSalvo()]), resumidor });
    await usuaria.click(botao('Resumir'));

    expect(await screen.findByText('Substituir o que está nos campos pelo resumo?')).toBeInTheDocument();
    await usuaria.click(botao('Cancelar'));
    expect(screen.queryByText('Substituir o que está nos campos pelo resumo?')).not.toBeInTheDocument();
    expect(resumidor.resumir).not.toHaveBeenCalled();
    expect(campo('Como chegou')).toHaveValue('Chegou cansada.');

    await usuaria.click(botao('Resumir'));
    await usuaria.click(await screen.findByRole('button', { name: 'Substituir' }));
    await waitFor(() => expect(campo('Como chegou')).toHaveValue('Chegou bem.'));
  });

  it('se a tela mudou enquanto salvava, não diz Registro salvo. e mantém o rascunho', async () => {
    const repo = repositorio();
    const original = repo.salvarRegistro.bind(repo);
    let liberar: (() => void) | undefined;
    vi.spyOn(repo, 'salvarRegistro').mockImplementation(async (id, dados) => {
      await new Promise<void>((r) => (liberar = r));
      return original(id, dados);
    });
    const { usuaria } = await abrir({ repositorio: repo });
    await usuaria.type(campo('Observações'), 'Primeira parte.');
    await usuaria.click(botao('Salvar registro'));
    await waitFor(() => expect(liberar).toBeDefined());
    await usuaria.type(campo('Observações'), ' Segunda parte.');
    liberar!();

    await waitFor(() => expect(botao('Salvar registro')).toBeEnabled());
    expect(await repo.obterRegistro('s1')).toMatchObject({ observacoes: 'Primeira parte.' });
    expect(screen.queryByText('Registro salvo.')).not.toBeInTheDocument();
    expect(campo('Observações')).toHaveValue('Primeira parte. Segunda parte.');
    await waitFor(() => expect(lerRascunho('s1')?.campos.observacoes).toBe('Primeira parte. Segunda parte.'));
  });

  it('enquanto resume, Salvar registro fica desligado', async () => {
    let entregar: ((c: CamposRegistro) => void) | undefined;
    const resumidor = resumidorQue(() => new Promise<CamposRegistro>((r) => (entregar = r)));
    const { usuaria } = await abrir({ repositorio: repositorio(), resumidor });
    await ditar(usuaria, 'Algo.');
    await usuaria.click(botao('Resumir'));
    await screen.findByRole('button', { name: 'Resumindo…' });
    expect(botao('Salvar registro')).toBeDisabled();

    entregar!(CAMPOS);
    await waitFor(() => expect(campo('Como chegou')).toHaveValue('Chegou cansada.'));
    expect(botao('Salvar registro')).toBeEnabled();
  });

  it('enquanto resume, os quatro campos ficam só para leitura', async () => {
    let entregar: ((c: CamposRegistro) => void) | undefined;
    const resumidor = resumidorQue(() => new Promise<CamposRegistro>((r) => (entregar = r)));
    const { usuaria } = await abrir({ repositorio: repositorio(), resumidor });
    await ditar(usuaria, 'Algo.');
    await usuaria.click(botao('Resumir'));
    await screen.findByRole('button', { name: 'Resumindo…' });
    const nomes = ['Como chegou', 'O que foi trabalhado', 'Observações', 'Próximos passos'];
    for (const nome of nomes) expect(campo(nome)).toHaveAttribute('readonly');
    await usuaria.type(campo('Observações'), 'escrito durante o resumo');
    expect(campo('Observações')).toHaveValue('');

    entregar!(CAMPOS);
    await waitFor(() => expect(campo('Observações')).toHaveValue('Falou da escola.'));
    for (const nome of nomes) expect(campo(nome)).not.toHaveAttribute('readonly');
  });

  it('Ver o texto que vai para o Claude mostra o texto com [P] e sem o nome', async () => {
    const resumidor = resumidorFalso();
    const { usuaria } = await abrir({ repositorio: repositorio(), resumidor });
    await ditar(usuaria, 'Ana Clara veio com Marta.');
    const resumo = screen.getByText('Ver o texto que vai para o Claude');
    const previa = resumo.closest('details')!;
    await usuaria.click(resumo);

    expect(previa).toHaveAttribute('open');
    expect(within(previa).getByText('[P] veio com [R1].')).toBeVisible();
    expect(previa).not.toHaveTextContent(/Ana|Clara|Marta/);
    // É o mesmo texto que o Resumir manda.
    await usuaria.click(botao('Resumir'));
    expect(resumidor.resumir).toHaveBeenCalledWith('[P] veio com [R1].');
  });

  it('se a ficha não carrega, avisa que o resumo fica desligado', async () => {
    const repo = repositorio();
    vi.spyOn(repo, 'obterFicha').mockRejectedValue(new Error('sem rede'));
    const { usuaria } = await abrir({ repositorio: repo });
    await usuaria.type(area(), 'Algo.');
    expect(
      await screen.findByText('Não foi possível carregar os responsáveis; o resumo fica desligado.'),
    ).toBeInTheDocument();
    expect(botao('Resumir')).toBeDisabled();
  });

  it('salvar tudo vazio mostra a mensagem e não grava', async () => {
    const repo = repositorio();
    const { usuaria } = await abrir({ repositorio: repo });
    await usuaria.click(botao('Salvar registro'));
    expect(await screen.findByText('Escreva o registro ou resuma o texto antes de salvar.')).toBeInTheDocument();
    expect(await repo.obterRegistro('s1')).toBeNull();
  });

  it('escrever direto nos campos e salvar funciona sem resumir', async () => {
    const repo = repositorio();
    const resumidor = resumidorFalso();
    const { usuaria } = await abrir({ repositorio: repo, resumidor });
    await usuaria.type(campo('Observações'), 'Anotei à mão.');
    await usuaria.click(botao('Salvar registro'));
    expect(await screen.findByText('Registro salvo.')).toBeInTheDocument();
    expect(await repo.obterRegistro('s1')).toMatchObject({ textoFalado: '', observacoes: 'Anotei à mão.' });
    expect(resumidor.resumir).not.toHaveBeenCalled();
  });

  it('sessão inexistente mostra Sessão não encontrada.', async () => {
    renderComRotas('/agenda/sessoes/nao-existe/registro', { repositorio: repositorio() });
    expect(await screen.findByText('Sessão não encontrada.')).toBeInTheDocument();
  });
});
