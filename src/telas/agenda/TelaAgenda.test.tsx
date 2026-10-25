import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { criarRepositorioMemoria } from '../../dados/memoria';
import { sementeDemo } from '../../dados/semente-demo';
import { CONFIGURACOES_PADRAO } from '../../dominio/padroes';
import { instanteDe } from '../../regras/datas';
import { ANA, HOJE, repositorioDemo, usarHojeFixo } from '../../testes/ficha';
import { sessaoExemplo } from '../../testes/fabricas';
import { renderComRotas } from '../../testes/utilitarios';
import type { Repositorio } from '../../dados/repositorio';

usarHojeFixo();
afterEach(() => vi.unstubAllGlobals());

async function abrirAgenda(repositorio: Repositorio = repositorioDemo()) {
  const resultado = renderComRotas('/agenda', { repositorio });
  return { ...resultado, usuaria: userEvent.setup() };
}

/** A coluna (ou, no celular, o dia) pelo nome do dia, como "terça-feira, 03/11". */
const dia = (data: string) => screen.findByRole('region', { name: new RegExp(data.replace('/', '\\/'), 'i') });
const cartaoDe = (coluna: HTMLElement, paciente: string) => within(coluna).findByRole('button', { name: new RegExp(paciente) });

/** Uma tela com `largura` px: `matchMedia` responde às consultas "(min-width: Npx)" como um navegador. */
function simularLargura(largura: number) {
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    matches: largura >= Number(/min-width:\s*(\d+)px/.exec(consulta)?.[1] ?? Infinity),
    media: consulta,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
}

const simularCelular = () => simularLargura(390);

describe('TelaAgenda — semana', () => {
  it('mostra a sessão da Ana Clara na terça às 14:00 como "Psicoterapia" e "Agendada"', async () => {
    await abrirAgenda();

    const terca = await dia('terça-feira, 03/11');
    const cartao = await cartaoDe(terca, 'Ana Clara Souza');
    expect(cartao).toHaveTextContent('14:00');
    expect(within(cartao).getByText('Psicoterapia')).toBeInTheDocument();
    expect(within(cartao).getByText('Agendada')).toBeInTheDocument();
  });

  it('a avaliação do Pedro Henrique mostra "sessão 4 de 10" (3 comparecimentos + 1)', async () => {
    await abrirAgenda();

    const quarta = await dia('quarta-feira, 04/11');
    const cartao = await cartaoDe(quarta, 'Pedro Henrique Lima');
    expect(cartao).toHaveTextContent('09:00');
    expect(within(cartao).getByText('Avaliação')).toBeInTheDocument();
    expect(await within(cartao).findByText('sessão 4 de 10')).toBeInTheDocument();
  });

  it('a Maria Luísa aparece na quinta às 16:00', async () => {
    await abrirAgenda();

    const quinta = await dia('quinta-feira, 05/11');
    expect(await cartaoDe(quinta, 'Maria Luísa Costa')).toHaveTextContent('16:00');
  });

  it('o cartão tem faixa lateral na cor do tipo e o ícone de confirmado só quando confirmou', async () => {
    const { usuaria } = await abrirAgenda();

    const terca = await dia('terça-feira, 03/11');
    const cartaoAna = await cartaoDe(terca, 'Ana Clara Souza');
    expect(cartaoAna.className).toContain('border-l-laranja');
    expect(within(cartaoAna).queryByText('Confirmada')).not.toBeInTheDocument();

    const quarta = await dia('quarta-feira, 04/11');
    expect((await cartaoDe(quarta, 'Pedro Henrique Lima')).className).toContain('border-l-amarelo');

    // A semana anterior tem o comparecimento do Pedro (já confirmado).
    await usuaria.click(screen.getByRole('button', { name: 'Semana anterior' }));
    const quartaAntes = await dia('quarta-feira, 28/10');
    const passada = await cartaoDe(quartaAntes, 'Pedro Henrique Lima');
    expect(within(passada).getByText('Compareceu')).toBeInTheDocument();
    expect(within(passada).getByText('Confirmada')).toBeInTheDocument();
  });

  it('"Próxima semana" mostra 09/11–15/11 e "Semana anterior" volta', async () => {
    const { usuaria } = await abrirAgenda();
    expect(await screen.findByText('02/11–08/11')).toBeInTheDocument();

    await usuaria.click(screen.getByRole('button', { name: 'Próxima semana' }));

    expect(await screen.findByText('09/11–15/11')).toBeInTheDocument();
    const terca = await dia('terça-feira, 10/11');
    expect(await cartaoDe(terca, 'Ana Clara Souza')).toBeInTheDocument();

    await usuaria.click(screen.getByRole('button', { name: 'Semana anterior' }));
    expect(await screen.findByText('02/11–08/11')).toBeInTheDocument();
  });

  it('no computador, o domingo só aparece quando tem sessão', async () => {
    const semente = sementeDemo(HOJE);
    semente.sessoes.push(
      sessaoExemplo({ id: 'dom', pacienteId: ANA, inicio: instanteDe('2026-11-08', '10:00'), origem: 'avulsa' }),
    );
    const { unmount } = await abrirAgenda(criarRepositorioMemoria({ ...semente, sessoes: [] }));
    await dia('terça-feira, 03/11');
    expect(screen.queryByRole('region', { name: /domingo/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole('region')).toHaveLength(6);
    unmount();

    await abrirAgenda(criarRepositorioMemoria(semente));
    expect(await dia('domingo, 08/11')).toBeInTheDocument();
    expect(screen.getAllByRole('region')).toHaveLength(7);
  });

  it('mostra um aviso quando a agenda não carrega e tenta de novo', async () => {
    const repositorio = repositorioDemo();
    const original = repositorio.listarSessoes.bind(repositorio);
    let semRede = true;
    // Só a consulta da semana na tela falha; a geração da agenda (outra janela) segue normal.
    vi.spyOn(repositorio, 'listarSessoes').mockImplementation((de, ate) =>
      semRede && de === '2026-11-02' && ate === '2026-11-08' ? Promise.reject(new Error('sem rede')) : original(de, ate),
    );
    const { usuaria } = await abrirAgenda(repositorio);

    expect(await screen.findByText('Não foi possível carregar a agenda.')).toBeInTheDocument();
    semRede = false;
    await usuaria.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    const terca = await dia('terça-feira, 03/11');
    expect(await cartaoDe(terca, 'Ana Clara Souza')).toBeInTheDocument();
  });

  it('avisa quando a agenda das próximas semanas não pôde ser completada e deixa tentar de novo', async () => {
    const repositorio = repositorioDemo();
    const inserir = vi.spyOn(repositorio, 'inserirOcorrencias').mockRejectedValueOnce(new Error('sem rede'));
    const { usuaria } = await abrirAgenda(repositorio);

    expect(await screen.findByText('Não foi possível completar a agenda das próximas semanas.')).toBeInTheDocument();
    await usuaria.click(screen.getByRole('button', { name: 'Completar agenda' }));

    expect(await cartaoDe(await dia('terça-feira, 03/11'), 'Ana Clara Souza')).toBeInTheDocument();
    expect(inserir).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('Não foi possível completar a agenda das próximas semanas.')).not.toBeInTheDocument();
  });
});

describe('TelaAgenda — ao abrir', () => {
  it('completa a agenda com as semanas das configurações, uma vez, mesmo em StrictMode', async () => {
    const repositorio = repositorioDemo();
    const inserir = vi.spyOn(repositorio, 'inserirOcorrencias');
    renderComRotas('/agenda', { repositorio, provedores: StrictMode });

    const terca = await dia('terça-feira, 03/11');
    await cartaoDe(terca, 'Ana Clara Souza');

    expect(inserir).toHaveBeenCalledTimes(1);
    // 4 semanas a partir de 02/11: terças 03, 10, 17 e 24.
    const geradas = await repositorio.listarSessoes('2026-11-01', '2026-12-31');
    expect(geradas.filter((s) => s.pacienteId === ANA)).toHaveLength(4);
  });

  it('usa o número de semanas das configurações', async () => {
    const repositorio = criarRepositorioMemoria({
      ...sementeDemo(HOJE),
      configuracoes: { ...CONFIGURACOES_PADRAO, semanasGeradas: 1 },
    });
    await abrirAgenda(repositorio);
    await cartaoDe(await dia('terça-feira, 03/11'), 'Ana Clara Souza');

    const geradas = await repositorio.listarSessoes('2026-11-01', '2026-12-31');
    expect(geradas.filter((s) => s.pacienteId === ANA)).toHaveLength(1);
  });
});

describe('TelaAgenda — painel da sessão', () => {
  it('tocar no cartão e em "Compareceu" muda o chip do cartão para "Compareceu"', async () => {
    const { usuaria, repositorio } = await abrirAgenda();
    const cartao = await cartaoDe(await dia('terça-feira, 03/11'), 'Ana Clara Souza');

    await usuaria.click(cartao);
    const painel = await screen.findByRole('dialog', { name: 'Ana Clara Souza' });
    await usuaria.click(within(painel).getByRole('button', { name: 'Compareceu' }));

    await waitFor(() => expect(within(cartao).getByText('Compareceu')).toBeInTheDocument());
    const [ana] = (await repositorio.listarSessoes('2026-11-03', '2026-11-03')).filter((s) => s.pacienteId === ANA);
    expect(ana.situacao).toBe('compareceu');
  });

  it('remarcar para 05/11 15:00: a terça mostra "Remarcada" e a quinta, a nova sessão "Agendada"', async () => {
    const { usuaria } = await abrirAgenda();
    const terca = await dia('terça-feira, 03/11');
    await usuaria.click(await cartaoDe(terca, 'Ana Clara Souza'));
    const painel = await screen.findByRole('dialog', { name: 'Ana Clara Souza' });

    await usuaria.type(within(painel).getByLabelText('Nova data'), '2026-11-05');
    await usuaria.type(within(painel).getByLabelText('Nova hora'), '15:00');
    await usuaria.click(within(painel).getByRole('button', { name: 'Remarcar' }));

    expect(await within(painel).findByText('Remarcada para quinta-feira, 05/11, 15:00')).toBeInTheDocument();
    expect(within(painel).queryByRole('button', { name: 'Compareceu' })).not.toBeInTheDocument();
    await usuaria.click(within(painel).getByRole('button', { name: 'Fechar' }));

    expect(within(await cartaoDe(terca, 'Ana Clara Souza')).getByText('Remarcada')).toBeInTheDocument();
    const quinta = await dia('quinta-feira, 05/11');
    await waitFor(() => expect(within(quinta).getAllByRole('button')).toHaveLength(2));
    const nova = await cartaoDe(quinta, 'Ana Clara Souza');
    expect(nova).toHaveTextContent('15:00');
    expect(within(nova).getByText('Agendada')).toBeInTheDocument();
  });

  it('ligar "Acompanhamento familiar" muda o rótulo do cartão', async () => {
    const { usuaria } = await abrirAgenda();
    const cartao = await cartaoDe(await dia('terça-feira, 03/11'), 'Ana Clara Souza');
    expect(within(cartao).queryByText('Acompanhamento familiar')).not.toBeInTheDocument();

    await usuaria.click(cartao);
    const painel = await screen.findByRole('dialog', { name: 'Ana Clara Souza' });
    await usuaria.click(within(painel).getByRole('checkbox', { name: 'Acompanhamento familiar' }));

    await waitFor(() => expect(within(cartao).getByText('Acompanhamento familiar')).toBeInTheDocument());
    expect(within(cartao).queryByText('Psicoterapia')).not.toBeInTheDocument();
    expect(cartao.className).toContain('border-l-azul-claro');
  });

  it('Esc fecha o painel e o foco volta ao cartão', async () => {
    const { usuaria } = await abrirAgenda();
    const cartao = await cartaoDe(await dia('terça-feira, 03/11'), 'Ana Clara Souza');

    await usuaria.click(cartao);
    expect(await screen.findByRole('dialog', { name: 'Ana Clara Souza' })).toHaveFocus();
    await usuaria.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(cartao).toHaveFocus();
  });
});

describe('TelaAgenda — bloquear dias', () => {
  async function abrirBloqueio() {
    const resultado = await abrirAgenda();
    // Espera a agenda gerada: o bloqueio cancela o que já está marcado.
    await cartaoDe(await dia('terça-feira, 03/11'), 'Ana Clara Souza');
    await resultado.usuaria.click(screen.getByRole('button', { name: 'Bloquear dias' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Bloquear dias' });
    return { ...resultado, dialogo };
  }

  type Usuaria = ReturnType<typeof userEvent.setup>;
  const confirmacao = () => screen.findByRole('dialog', { name: 'Bloquear estes dias?' });

  /** Preenche e toca em "Bloquear período". Não confirma: quem chama decide. */
  async function preencher(dialogo: HTMLElement, usuaria: Usuaria, v: { inicio: string; fim: string; motivo: string }) {
    if (v.inicio) await usuaria.type(within(dialogo).getByLabelText('Início'), v.inicio);
    if (v.fim) await usuaria.type(within(dialogo).getByLabelText('Fim'), v.fim);
    if (v.motivo) await usuaria.type(within(dialogo).getByLabelText('Motivo'), v.motivo);
    await usuaria.click(within(dialogo).getByRole('button', { name: 'Bloquear período' }));
  }

  /** Preenche e confirma a pergunta "Bloquear estes dias?". */
  async function bloquear(dialogo: HTMLElement, usuaria: Usuaria, v: { inicio: string; fim: string; motivo: string }) {
    await preencher(dialogo, usuaria, v);
    await usuaria.click(within(await confirmacao()).getByRole('button', { name: 'Bloquear' }));
  }

  it('10/11–14/11 "Feriado": avisa quantas foram canceladas e a semana seguinte mostra "Cancelada"', async () => {
    const { usuaria, dialogo, repositorio } = await abrirBloqueio();

    await bloquear(dialogo, usuaria, { inicio: '2026-11-10', fim: '2026-11-14', motivo: 'Feriado' });

    expect(await within(dialogo).findByText('3 sessões canceladas.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Bloquear estes dias?' })).not.toBeInTheDocument();
    expect(await repositorio.listarBloqueios()).toEqual([
      expect.objectContaining({ inicio: '2026-11-10', fim: '2026-11-14', motivo: 'Feriado' }),
    ]);
    await usuaria.click(within(dialogo).getByRole('button', { name: 'Fechar' }));

    await usuaria.click(screen.getByRole('button', { name: 'Próxima semana' }));
    for (const [data, paciente] of [
      ['terça-feira, 10/11', 'Ana Clara Souza'],
      ['quarta-feira, 11/11', 'Pedro Henrique Lima'],
      ['quinta-feira, 12/11', 'Maria Luísa Costa'],
    ]) {
      const cartao = await cartaoDe(await dia(data), paciente);
      await waitFor(() => expect(within(cartao).getByText('Cancelada')).toBeInTheDocument());
    }
  });

  it('com uma sessão: "1 sessão cancelada."', async () => {
    const { usuaria, dialogo } = await abrirBloqueio();

    await bloquear(dialogo, usuaria, { inicio: '2026-11-03', fim: '2026-11-03', motivo: 'Consulta' });

    expect(await within(dialogo).findByText('1 sessão cancelada.')).toBeInTheDocument();
  });

  it('sem nenhuma sessão: "Nenhuma sessão cancelada."', async () => {
    const { usuaria, dialogo } = await abrirBloqueio();

    await bloquear(dialogo, usuaria, { inicio: '2026-11-07', fim: '2026-11-08', motivo: 'Fim de semana' });

    expect(await within(dialogo).findByText('Nenhuma sessão cancelada.')).toBeInTheDocument();
  });

  it('antes de bloquear, pergunta: diz o período e que o que está agendado nele será cancelado', async () => {
    const { usuaria, dialogo, repositorio } = await abrirBloqueio();

    await preencher(dialogo, usuaria, { inicio: '2026-11-10', fim: '2026-11-14', motivo: 'Feriado' });

    const pergunta = await confirmacao();
    // Com o ano: um ano digitado errado aparece na pergunta.
    expect(pergunta).toHaveTextContent('10/11/2026 a 14/11/2026');
    expect(pergunta).toHaveTextContent('Feriado');
    expect(pergunta).toHaveTextContent('As sessões que ainda estiverem agendadas nesse período serão canceladas');
    expect(pergunta).not.toHaveTextContent('Atenção');
    // Só perguntou: nada foi gravado.
    expect(await repositorio.listarBloqueios()).toEqual([]);
  });

  it.each([
    ['2026-11-10', '2027-11-14', 'Atenção: são 370 dias.'],
    ['2026-12-01', '2027-01-01', 'Atenção: são 32 dias.'],
  ])('período de %s a %s (mais de 31 dias): a pergunta avisa "%s"', async (inicio, fim, aviso) => {
    const { usuaria, dialogo, repositorio } = await abrirBloqueio();

    await preencher(dialogo, usuaria, { inicio, fim, motivo: 'Férias' });

    const pergunta = await confirmacao();
    expect(within(pergunta).getByText(aviso)).toBeInTheDocument();
    expect(pergunta).toHaveAccessibleDescription(expect.stringContaining(aviso));
    expect(await repositorio.listarBloqueios()).toEqual([]);
  });

  it('31 dias ainda não pede atenção', async () => {
    const { usuaria, dialogo } = await abrirBloqueio();

    await preencher(dialogo, usuaria, { inicio: '2026-12-01', fim: '2026-12-31', motivo: 'Férias' });

    const pergunta = await confirmacao();
    expect(pergunta).toHaveTextContent('01/12/2026 a 31/12/2026');
    expect(pergunta).not.toHaveTextContent('Atenção');
  });

  it('"Cancelar" na pergunta não muda nada e mantém o formulário preenchido', async () => {
    const { usuaria, dialogo, repositorio } = await abrirBloqueio();
    await preencher(dialogo, usuaria, { inicio: '2026-11-10', fim: '2026-11-14', motivo: 'Feriado' });

    await usuaria.click(within(await confirmacao()).getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog', { name: 'Bloquear estes dias?' })).not.toBeInTheDocument();
    expect(within(dialogo).getByLabelText('Início')).toHaveValue('2026-11-10');
    expect(within(dialogo).getByLabelText('Motivo')).toHaveValue('Feriado');
    expect(await repositorio.listarBloqueios()).toEqual([]);
    const semana = await repositorio.listarSessoes('2026-11-10', '2026-11-14');
    expect(semana).toHaveLength(3);
    expect(semana.every((s) => s.situacao === 'agendada')).toBe(true);
  });

  it('Esc na pergunta só cancela a pergunta: o formulário continua aberto', async () => {
    const { usuaria, dialogo } = await abrirBloqueio();
    await preencher(dialogo, usuaria, { inicio: '2026-11-10', fim: '2026-11-14', motivo: 'Feriado' });
    await confirmacao();

    await usuaria.keyboard('{Escape}');

    expect(screen.queryByRole('dialog', { name: 'Bloquear estes dias?' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Bloquear dias' })).toBeInTheDocument();
  });

  it('enquanto bloqueia, nada fecha: nem Esc, nem "Fechar", nem a pergunta', async () => {
    const { usuaria, dialogo, repositorio } = await abrirBloqueio();
    const salvar = repositorio.salvarBloqueio.bind(repositorio);
    let liberar: () => void = () => {};
    vi.spyOn(repositorio, 'salvarBloqueio').mockImplementation(
      (b) => new Promise((resolve) => (liberar = () => resolve(salvar(b)))),
    );
    await preencher(dialogo, usuaria, { inicio: '2026-11-10', fim: '2026-11-14', motivo: 'Feriado' });
    const pergunta = await confirmacao();

    await usuaria.click(within(pergunta).getByRole('button', { name: 'Bloquear' }));
    await usuaria.keyboard('{Escape}');

    expect(within(pergunta).getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    expect(within(pergunta).getByRole('button', { name: 'Bloquear' })).toBeDisabled();
    expect(within(dialogo).getByRole('button', { name: 'Fechar' })).toBeDisabled();
    expect(screen.getAllByRole('dialog')).toHaveLength(2);

    liberar();
    expect(await within(dialogo).findByText('3 sessões canceladas.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Bloquear estes dias?' })).not.toBeInTheDocument();
    expect(within(dialogo).getByRole('button', { name: 'Fechar' })).toBeEnabled();
  });

  it('recusa fim antes do início e motivo em branco, sem perguntar nem bloquear nada', async () => {
    const { usuaria, dialogo, repositorio } = await abrirBloqueio();

    await preencher(dialogo, usuaria, { inicio: '2026-11-14', fim: '2026-11-10', motivo: '' });

    expect(within(dialogo).getByText('A data de fim não pode ser antes do início.')).toBeInTheDocument();
    expect(within(dialogo).getByText('Informe o motivo, por exemplo: Férias.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Bloquear estes dias?' })).not.toBeInTheDocument();
    expect(await repositorio.listarBloqueios()).toEqual([]);
  });

  it('avisa na própria pergunta quando não foi possível bloquear, e deixa tentar de novo', async () => {
    const { usuaria, dialogo, repositorio } = await abrirBloqueio();
    const salvar = repositorio.salvarBloqueio.bind(repositorio);
    vi.spyOn(repositorio, 'salvarBloqueio').mockRejectedValueOnce(new Error('sem rede')).mockImplementation(salvar);

    await bloquear(dialogo, usuaria, { inicio: '2026-11-10', fim: '2026-11-14', motivo: 'Feriado' });

    const pergunta = await confirmacao();
    expect(await within(pergunta).findByText('Não foi possível bloquear o período. Tente de novo.')).toBeInTheDocument();
    await usuaria.click(within(pergunta).getByRole('button', { name: 'Bloquear' }));
    expect(await within(dialogo).findByText('3 sessões canceladas.')).toBeInTheDocument();
  });
});

describe('TelaAgenda — sessão avulsa', () => {
  async function abrirAvulsa() {
    const resultado = await abrirAgenda();
    await cartaoDe(await dia('terça-feira, 03/11'), 'Ana Clara Souza');
    await resultado.usuaria.click(screen.getByRole('button', { name: 'Sessão avulsa' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Nova sessão avulsa' });
    return { ...resultado, dialogo };
  }

  it('a sessão criada aparece no dia e na hora escolhidos', async () => {
    const { usuaria, dialogo, repositorio } = await abrirAvulsa();

    await usuaria.selectOptions(within(dialogo).getByLabelText('Paciente'), 'Maria Luísa Costa');
    const data = within(dialogo).getByLabelText('Data');
    await usuaria.clear(data);
    await usuaria.type(data, '2026-11-06');
    await usuaria.type(within(dialogo).getByLabelText('Hora'), '10:30');
    await usuaria.click(within(dialogo).getByRole('button', { name: 'Criar sessão' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const sexta = await dia('sexta-feira, 06/11');
    const cartao = await cartaoDe(sexta, 'Maria Luísa Costa');
    expect(cartao).toHaveTextContent('10:30');
    expect(within(cartao).getByText('Agendada')).toBeInTheDocument();
    const criada = (await repositorio.listarSessoes('2026-11-06', '2026-11-06'))[0];
    expect(criada).toMatchObject({ origem: 'avulsa', inicio: instanteDe('2026-11-06', '10:30'), duracaoMin: 50 });
    expect(screen.getByRole('button', { name: 'Sessão avulsa' })).toHaveFocus();
  });

  it('lista só pacientes ativos e traz a duração padrão', async () => {
    const { dialogo } = await abrirAvulsa();

    const paciente = within(dialogo).getByLabelText('Paciente');
    const opcoes = within(paciente).getAllByRole('option').map((o) => o.textContent);
    expect(opcoes).toEqual(['Escolha o paciente', 'Ana Clara Souza', 'Maria Luísa Costa', 'Pedro Henrique Lima']);
    expect(within(dialogo).getByLabelText('Duração (min)')).toHaveValue(50);
  });

  it('a data já vem com o dia que a agenda está mostrando', async () => {
    const { dialogo } = await abrirAvulsa();

    expect(within(dialogo).getByLabelText('Data')).toHaveValue(HOJE);
  });

  it('marcar "Acompanhamento familiar" cria a sessão já como familiar', async () => {
    const { usuaria, dialogo, repositorio } = await abrirAvulsa();

    await usuaria.selectOptions(within(dialogo).getByLabelText('Paciente'), 'Ana Clara Souza');
    await usuaria.type(within(dialogo).getByLabelText('Hora'), '18:00');
    await usuaria.click(within(dialogo).getByRole('checkbox', { name: 'Acompanhamento familiar' }));
    await usuaria.click(within(dialogo).getByRole('button', { name: 'Criar sessão' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const [segunda] = await repositorio.listarSessoes(HOJE, HOJE);
    expect(segunda).toMatchObject({ pacienteId: ANA, acompanhamentoFamiliar: true, origem: 'avulsa' });
    const cartao = await cartaoDe(await dia('segunda-feira, 02/11'), 'Ana Clara Souza');
    expect(within(cartao).getByText('Acompanhamento familiar')).toBeInTheDocument();
  });

  it('pede paciente e hora quando faltam', async () => {
    const { usuaria, dialogo, repositorio } = await abrirAvulsa();

    await usuaria.click(within(dialogo).getByRole('button', { name: 'Criar sessão' }));

    expect(within(dialogo).getByText('Escolha o paciente.')).toBeInTheDocument();
    expect(within(dialogo).getByText('Informe a hora.')).toBeInTheDocument();
    expect(await repositorio.listarSessoes(HOJE, HOJE)).toEqual([]);
  });
});

describe('TelaAgenda — largura da tela', () => {
  it('a partir de 1024 px mostra os seis dias úteis em colunas que encolhem, sem rolagem interna', async () => {
    simularLargura(1024);
    const { container } = await abrirAgenda();

    await dia('terça-feira, 03/11');
    expect(screen.getAllByRole('region')).toHaveLength(6);
    expect(screen.queryByRole('group', { name: 'Dias da semana' })).not.toBeInTheDocument();
    // Seis colunas iguais que encolhem (grid-cols-6 = repeat(6, minmax(0, 1fr))) e nenhum contêiner com rolagem.
    const grade = screen.getByRole('region', { name: /terça-feira, 03\/11/i }).parentElement as HTMLElement;
    expect(grade.className).toContain('grid-cols-6');
    expect(container.querySelector('[class*="overflow-x"]')).toBeNull();
  });

  it('na vertical do iPad (820 px) e em 1023 px, mostra um dia por vez, com o seletor e as setas', async () => {
    for (const largura of [820, 1023]) {
      simularLargura(largura);
      const { unmount } = await abrirAgenda();

      expect(await screen.findByRole('group', { name: 'Dias da semana' })).toBeInTheDocument();
      expect(screen.getAllByRole('region')).toHaveLength(1);
      expect(screen.getByRole('button', { name: 'Semana anterior' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Próxima semana' })).toBeInTheDocument();
      unmount();
    }
  });

  it('o painel da sessão continua lateral a partir de 768 px (a Folha não depende da grade)', async () => {
    simularLargura(820);
    const { usuaria } = await abrirAgenda();
    await usuaria.click(await screen.findByRole('button', { name: 'Ter 03' }));

    await usuaria.click(await cartaoDe(await dia('terça-feira, 03/11'), 'Ana Clara Souza'));

    expect(await screen.findByRole('dialog', { name: 'Ana Clara Souza' })).toBeInTheDocument();
  });
});

describe('TelaAgenda — celular', () => {
  it('abre no dia de hoje, com Seg a Sáb e um dia por vez', async () => {
    simularCelular();
    const { usuaria } = await abrirAgenda();

    const dias = await screen.findByRole('group', { name: 'Dias da semana' });
    const botoes = within(dias).getAllByRole('button');
    expect(botoes.map((b) => b.textContent)).toEqual(['Seg 02', 'Ter 03', 'Qua 04', 'Qui 05', 'Sex 06', 'Sáb 07']);
    expect(within(dias).getByRole('button', { name: 'Seg 02' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByRole('region')).toHaveLength(1);
    expect(screen.getByRole('region', { name: /segunda-feira, 02\/11/i })).toBeInTheDocument();

    await usuaria.click(within(dias).getByRole('button', { name: 'Ter 03' }));

    const terca = await dia('terça-feira, 03/11');
    expect(await cartaoDe(terca, 'Ana Clara Souza')).toBeInTheDocument();
    expect(screen.getAllByRole('region')).toHaveLength(1);
    expect(within(dias).getByRole('button', { name: 'Ter 03' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('as setas mudam a semana e mantêm o dia da semana', async () => {
    simularCelular();
    const { usuaria } = await abrirAgenda();
    await usuaria.click(await screen.findByRole('button', { name: 'Ter 03' }));

    await usuaria.click(screen.getByRole('button', { name: 'Próxima semana' }));

    expect(await screen.findByRole('button', { name: 'Ter 10' })).toHaveAttribute('aria-pressed', 'true');
    expect(await cartaoDe(await dia('terça-feira, 10/11'), 'Ana Clara Souza')).toBeInTheDocument();
  });

  it('o domingo entra no seletor só quando tem sessão', async () => {
    simularCelular();
    const semente = sementeDemo(HOJE);
    const { unmount } = await abrirAgenda(criarRepositorioMemoria(semente));
    await screen.findByRole('group', { name: 'Dias da semana' });
    expect(screen.queryByRole('button', { name: /^Dom/ })).not.toBeInTheDocument();
    unmount();

    semente.sessoes.push(sessaoExemplo({ id: 'dom', pacienteId: ANA, inicio: instanteDe('2026-11-08', '10:00') }));
    await abrirAgenda(criarRepositorioMemoria(semente));
    expect(await screen.findByRole('button', { name: 'Dom 08' })).toBeInTheDocument();
  });

  it('o painel da sessão funciona no celular', async () => {
    simularCelular();
    const { usuaria } = await abrirAgenda();
    await usuaria.click(await screen.findByRole('button', { name: 'Qui 05' }));

    await usuaria.click(await cartaoDe(await dia('quinta-feira, 05/11'), 'Maria Luísa Costa'));

    const painel = await screen.findByRole('dialog', { name: 'Maria Luísa Costa' });
    expect(within(painel).getByRole('button', { name: 'Faltou com aviso' })).toBeInTheDocument();
  });
});
