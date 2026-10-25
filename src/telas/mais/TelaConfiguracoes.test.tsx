import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { criarRepositorioMemoria } from '../../dados/memoria';
import { CONFIGURACOES_PADRAO, MENSAGEM_WHATSAPP_PADRAO } from '../../dominio/padroes';
import { renderComRotas } from '../../testes/utilitarios';

const CAMINHO = '/mais/configuracoes';
const ERRO_NUMERO = 'Informe um número maior que zero.';

async function trocarValor(rotulo: string, valor: string) {
  const usuaria = userEvent.setup();
  const campo = await screen.findByLabelText(rotulo);
  await usuaria.clear(campo);
  // Na digitação do user-event, "{" abre um comando de tecla; "{{" digita a chave de verdade.
  if (valor) await usuaria.type(campo, valor.replaceAll('{', '{{'));
  return usuaria;
}

describe('TelaConfiguracoes', () => {
  it('no primeiro acesso já vem com os dados do kit e a mensagem padrão, e o repositório passa a ter configurações', async () => {
    const { repositorio } = renderComRotas(CAMINHO);

    expect(await screen.findByRole('heading', { name: 'Configurações' })).toBeInTheDocument();
    expect(await screen.findByDisplayValue('Juliana Queiroz Feliciano')).toBeInTheDocument();
    expect(screen.getByDisplayValue('CRP 11/16479')).toBeInTheDocument();
    expect(screen.getByLabelText('Mensagem do WhatsApp')).toHaveValue(MENSAGEM_WHATSAPP_PADRAO);
    expect(await repositorio.obterConfiguracoes()).toEqual(CONFIGURACOES_PADRAO);
  });

  it('agrupa os campos em "Seus dados" e "Agenda"', async () => {
    renderComRotas(CAMINHO);

    const dados = await screen.findByRole('group', { name: 'Seus dados' });
    for (const rotulo of [
      'Nome completo',
      'Nome de exibição',
      'Título',
      'CRP',
      'CPF',
      'Telefone',
      'E-mail',
      'Endereço',
      'Cidade',
      'Instagram',
    ]) {
      expect(within(dados).getByLabelText(rotulo)).toBeInTheDocument();
    }
    expect(within(dados).getByLabelText('E-mail')).toHaveValue('julianaqfeliciano@gmail.com');

    const agenda = screen.getByRole('group', { name: 'Agenda' });
    expect(within(agenda).getByLabelText('Duração padrão da sessão')).toHaveValue(50);
    expect(within(agenda).getByLabelText('Sessões da avaliação')).toHaveValue(10);
    expect(within(agenda).getByLabelText('Semanas geradas')).toHaveValue(4);
    expect(within(agenda).getByLabelText('Mensagem do WhatsApp')).toBeInTheDocument();
  });

  it('mostra as configurações já gravadas, sem sobrescrevê-las', async () => {
    const gravadas = { ...CONFIGURACOES_PADRAO, crp: 'CRP 11/00000', duracaoPadraoMin: 40 };
    const { repositorio } = renderComRotas(CAMINHO, { repositorio: criarRepositorioMemoria({ configuracoes: gravadas }) });

    expect(await screen.findByDisplayValue('CRP 11/00000')).toBeInTheDocument();
    expect(screen.getByLabelText('Duração padrão da sessão')).toHaveValue(40);
    expect(await repositorio.obterConfiguracoes()).toEqual(gravadas);
  });

  it('mudar a duração padrão para 45 e salvar grava no repositório e avisa "Configurações salvas."', async () => {
    const { repositorio } = renderComRotas(CAMINHO);
    const usuaria = await trocarValor('Duração padrão da sessão', '45');

    await usuaria.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Configurações salvas.')).toBeInTheDocument();
    expect((await repositorio.obterConfiguracoes())?.duracaoPadraoMin).toBe(45);
  });

  it('salvar guarda todos os campos editados, sem espaços nas pontas, e mantém o que a tela não mostra', async () => {
    const gravadas = { ...CONFIGURACOES_PADRAO, bloqueioMinutos: 30 };
    const { repositorio } = renderComRotas(CAMINHO, { repositorio: criarRepositorioMemoria({ configuracoes: gravadas }) });
    const usuaria = await trocarValor('Cidade', '  São Paulo – SP  ');
    await trocarValor('Sessões da avaliação', '8');
    await trocarValor('Semanas geradas', '6');
    await trocarValor('Mensagem do WhatsApp', 'Oi, {responsável}!');

    await usuaria.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Configurações salvas.')).toBeInTheDocument();
    expect(await repositorio.obterConfiguracoes()).toEqual({
      ...gravadas,
      cidade: 'São Paulo – SP',
      sessoesAvaliacaoPadrao: 8,
      semanasGeradas: 6,
      mensagemWhatsapp: 'Oi, {responsável}!',
    });
  });

  it('o aviso de "salvas" some quando ela volta a editar', async () => {
    renderComRotas(CAMINHO);
    const usuaria = await trocarValor('Duração padrão da sessão', '45');
    await usuaria.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText('Configurações salvas.')).toBeInTheDocument();

    await usuaria.type(screen.getByLabelText('Cidade'), '!');

    expect(screen.queryByText('Configurações salvas.')).not.toBeInTheDocument();
  });

  it.each([
    ['0', '0'],
    ['vazio', ''],
  ])('duração %s mostra "Informe um número maior que zero." e não salva', async (_nome, valor) => {
    const { repositorio } = renderComRotas(CAMINHO);
    const usuaria = await trocarValor('Duração padrão da sessão', valor);

    await usuaria.click(screen.getByRole('button', { name: 'Salvar' }));

    const campo = screen.getByLabelText('Duração padrão da sessão');
    expect(await screen.findByText(ERRO_NUMERO)).toBeInTheDocument();
    expect(campo).toHaveAccessibleDescription(expect.stringContaining(ERRO_NUMERO));
    expect(campo).toBeInvalid();
    expect(screen.queryByText('Configurações salvas.')).not.toBeInTheDocument();
    expect((await repositorio.obterConfiguracoes())?.duracaoPadraoMin).toBe(50);
  });

  it('valida também as sessões da avaliação e as semanas geradas', async () => {
    renderComRotas(CAMINHO);
    const usuaria = await trocarValor('Sessões da avaliação', '0');
    await trocarValor('Semanas geradas', '');

    await usuaria.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findAllByText(ERRO_NUMERO)).toHaveLength(2);
    expect(screen.getByLabelText('Sessões da avaliação')).toBeInvalid();
    expect(screen.getByLabelText('Semanas geradas')).toBeInvalid();
    expect(screen.getByLabelText('Duração padrão da sessão')).toBeValid();
  });

  it('número com vírgula ou ponto (não inteiro) também não é aceito', async () => {
    const { repositorio } = renderComRotas(CAMINHO);
    const usuaria = await trocarValor('Duração padrão da sessão', '45.5');

    await usuaria.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Informe um número inteiro.')).toBeInTheDocument();
    expect((await repositorio.obterConfiguracoes())?.duracaoPadraoMin).toBe(50);
  });

  it.each([
    ['Semanas geradas', '13', 'Use um número de 1 a 12.', 'semanasGeradas', 4],
    ['Semanas geradas', '400', 'Use um número de 1 a 12.', 'semanasGeradas', 4],
    ['Duração padrão da sessão', '481', 'Use um número de 1 a 480.', 'duracaoPadraoMin', 50],
    ['Sessões da avaliação', '100', 'Use um número de 1 a 99.', 'sessoesAvaliacaoPadrao', 10],
  ] as const)('"%s" = %s passa do limite: avisa "%s" e não salva', async (rotulo, valor, aviso, chave, gravado) => {
    const { repositorio } = renderComRotas(CAMINHO);
    const usuaria = await trocarValor(rotulo, valor);

    await usuaria.click(screen.getByRole('button', { name: 'Salvar' }));

    const campo = screen.getByLabelText(rotulo);
    expect(await screen.findByText(aviso)).toBeInTheDocument();
    expect(campo).toHaveAccessibleDescription(expect.stringContaining(aviso));
    expect(campo).toBeInvalid();
    expect(screen.queryByText('Configurações salvas.')).not.toBeInTheDocument();
    expect((await repositorio.obterConfiguracoes())?.[chave]).toBe(gravado);
  });

  it('os próprios limites (12 semanas, 480 minutos, 99 sessões) são aceitos', async () => {
    const { repositorio } = renderComRotas(CAMINHO);
    const usuaria = await trocarValor('Semanas geradas', '12');
    await trocarValor('Duração padrão da sessão', '480');
    await trocarValor('Sessões da avaliação', '99');

    await usuaria.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Configurações salvas.')).toBeInTheDocument();
    expect(await repositorio.obterConfiguracoes()).toMatchObject({
      semanasGeradas: 12,
      duracaoPadraoMin: 480,
      sessoesAvaliacaoPadrao: 99,
    });
    // O teclado e o navegador também conhecem o limite.
    expect(screen.getByLabelText('Semanas geradas')).toHaveAttribute('max', '12');
    expect(screen.getByLabelText('Duração padrão da sessão')).toHaveAttribute('max', '480');
    expect(screen.getByLabelText('Sessões da avaliação')).toHaveAttribute('max', '99');
  });

  it.each([['Nome completo'], ['Mensagem do WhatsApp']])('"%s" em branco: avisa "Preencha este campo." e não salva', async (rotulo) => {
    const { repositorio } = renderComRotas(CAMINHO);
    const usuaria = await trocarValor(rotulo, '   ');

    await usuaria.click(screen.getByRole('button', { name: 'Salvar' }));

    const campo = screen.getByLabelText(rotulo);
    expect(await screen.findByText('Preencha este campo.')).toBeInTheDocument();
    expect(campo).toHaveAccessibleDescription(expect.stringContaining('Preencha este campo.'));
    expect(campo).toBeInvalid();
    expect(screen.queryByText('Configurações salvas.')).not.toBeInTheDocument();
    expect(await repositorio.obterConfiguracoes()).toEqual(CONFIGURACOES_PADRAO);
  });

  it('corrigir o número e salvar de novo tira o aviso e grava', async () => {
    const { repositorio } = renderComRotas(CAMINHO);
    const usuaria = await trocarValor('Duração padrão da sessão', '0');
    await usuaria.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText(ERRO_NUMERO)).toBeInTheDocument();

    await trocarValor('Duração padrão da sessão', '30');
    await usuaria.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Configurações salvas.')).toBeInTheDocument();
    expect(screen.queryByText(ERRO_NUMERO)).not.toBeInTheDocument();
    expect((await repositorio.obterConfiguracoes())?.duracaoPadraoMin).toBe(30);
  });

  it('a mensagem do WhatsApp mostra os campos disponíveis', async () => {
    renderComRotas(CAMINHO);

    const mensagem = await screen.findByLabelText('Mensagem do WhatsApp');
    for (const campo of ['{responsável}', '{paciente}', '{dia}', '{hora}']) {
      expect(screen.getByText(campo, { selector: 'code' })).toBeInTheDocument();
      expect(mensagem).toHaveAccessibleDescription(expect.stringContaining(campo));
    }
  });

  it('se não conseguir salvar, avisa e não diz que salvou', async () => {
    const base = criarRepositorioMemoria({ configuracoes: CONFIGURACOES_PADRAO });
    const repositorio = { ...base, salvarConfiguracoes: vi.fn().mockRejectedValue(new Error('sem rede')) };
    renderComRotas(CAMINHO, { repositorio });
    const usuaria = await trocarValor('Duração padrão da sessão', '45');

    await usuaria.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível salvar. Tente de novo.');
    expect(screen.queryByText('Configurações salvas.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeEnabled();
  });

  it('se não conseguir carregar, avisa e não mostra o formulário (para não gravar os padrões por cima)', async () => {
    const base = criarRepositorioMemoria({ configuracoes: CONFIGURACOES_PADRAO });
    const repositorio = {
      ...base,
      obterConfiguracoes: vi.fn().mockRejectedValue(new Error('sem rede')),
      salvarConfiguracoes: vi.fn(),
    };
    renderComRotas(CAMINHO, { repositorio });

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar as configurações.');
    expect(screen.queryByRole('button', { name: 'Salvar' })).not.toBeInTheDocument();
    expect(repositorio.salvarConfiguracoes).not.toHaveBeenCalled();
  });

  it('tem um caminho de volta para "Mais"', async () => {
    renderComRotas(CAMINHO);
    const usuaria = userEvent.setup();

    await usuaria.click(await screen.findByRole('link', { name: 'Voltar para Mais' }));

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Mais' })).toBeInTheDocument());
  });
});
