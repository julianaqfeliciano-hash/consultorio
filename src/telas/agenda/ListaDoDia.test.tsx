import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { criarRepositorioMemoria } from '../../dados/memoria';
import type { Repositorio } from '../../dados/repositorio';
import { sementeDemo } from '../../dados/semente-demo';
import { CONFIGURACOES_PADRAO } from '../../dominio/padroes';
import type { Sessao } from '../../dominio/tipos';
import { instanteDe } from '../../regras/datas';
import { sessaoExemplo } from '../../testes/fabricas';
import { ANA, HOJE, PEDRO, usarHojeFixo } from '../../testes/ficha';
import { renderComRotas } from '../../testes/utilitarios';

usarHojeFixo();

type Semente = ReturnType<typeof sementeDemo>;

/** Repositório da demonstração, com `mudar` mexendo na semente antes de começar. */
function repositorioCom(mudar: (semente: Semente) => void = () => {}): Repositorio {
  const semente = sementeDemo(HOJE);
  mudar(semente);
  return criarRepositorioMemoria(semente);
}

/** Sem horários fixos nada é gerado: só existem as sessões que o teste coloca. */
const semHorarios = (semente: Semente) => {
  semente.horarios = [];
};

/** Uma sessão marcada para `data` (terça 03/11 é "amanhã") às `hora`, de um paciente da demonstração. */
function sessaoNo(data: string, hora: string, sobre: Partial<Sessao> = {}): Sessao {
  return sessaoExemplo({ id: `extra-${data}-${hora}`, pacienteId: PEDRO, inicio: instanteDe(data, hora), ...sobre });
}

function abrirAgenda(repositorio: Repositorio = repositorioCom()) {
  return { ...renderComRotas('/agenda', { repositorio }), usuaria: userEvent.setup() };
}

type Usuaria = ReturnType<typeof userEvent.setup>;

const avisoDeAmanha = (nome: string | RegExp) => screen.findByRole('button', { name: nome });

/** Toca no aviso do topo e devolve a folha com a lista. */
async function abrirLista(usuaria: Usuaria) {
  await usuaria.click(await avisoDeAmanha(/^Amanhã:/));
  return screen.findByRole('dialog', { name: /^Amanhã/ });
}

/** Cada linha da lista, na ordem da tela. */
const linhas = (folha: HTMLElement) => within(folha).queryAllByRole('listitem');
const linhaDe = (folha: HTMLElement, paciente: string) => {
  const linha = linhas(folha).find((l) => l.textContent?.includes(paciente));
  if (!linha) throw new Error(`Sem linha para ${paciente}`);
  return linha;
};

describe('Aviso de amanhã no topo da agenda', () => {
  it('"Amanhã: 1 paciente" com a Ana Clara na terça 03/11', async () => {
    abrirAgenda();

    expect(await avisoDeAmanha('Amanhã: 1 paciente')).toBeInTheDocument();
  });

  it('plural quando são vários: "Amanhã: 2 pacientes"', async () => {
    abrirAgenda(repositorioCom((s) => s.sessoes.push(sessaoNo('2026-11-03', '09:00'))));

    expect(await avisoDeAmanha('Amanhã: 2 pacientes')).toBeInTheDocument();
  });

  it('"Amanhã: nenhum paciente" quando não há sessão', async () => {
    abrirAgenda(repositorioCom(semHorarios));

    expect(await avisoDeAmanha('Amanhã: nenhum paciente')).toBeInTheDocument();
  });

  it('só conta as sessões agendadas', async () => {
    abrirAgenda(
      repositorioCom((s) => {
        semHorarios(s);
        s.sessoes.push(
          sessaoNo('2026-11-03', '09:00'),
          sessaoNo('2026-11-03', '10:00', { situacao: 'cancelada' }),
          sessaoNo('2026-11-03', '11:00', { situacao: 'compareceu' }),
          sessaoNo('2026-11-03', '12:00', { situacao: 'remarcada' }),
        );
      }),
    );

    expect(await avisoDeAmanha('Amanhã: 1 paciente')).toBeInTheDocument();
  });

  it('enquanto a agenda está sendo completada não mostra número (nunca "nenhum paciente" por engano)', async () => {
    const repositorio = repositorioCom();
    const inserir = repositorio.inserirOcorrencias.bind(repositorio);
    let liberar: () => void = () => {};
    const espia = vi.spyOn(repositorio, 'inserirOcorrencias').mockImplementation(
      (novas) => new Promise((resolve) => (liberar = () => resolve(inserir(novas)))),
    );
    abrirAgenda(repositorio);
    await waitFor(() => expect(espia).toHaveBeenCalled());

    expect(screen.getByText('Amanhã: carregando…')).toBeInTheDocument();
    expect(screen.queryByText(/nenhum paciente/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Amanhã:/ })).not.toBeInTheDocument();

    liberar();
    expect(await avisoDeAmanha('Amanhã: 1 paciente')).toBeInTheDocument();
  });

  it('se a agenda não pôde ser completada, mostra o que já existe', async () => {
    const repositorio = repositorioCom((s) => s.sessoes.push(sessaoNo('2026-11-03', '09:00')));
    vi.spyOn(repositorio, 'inserirOcorrencias').mockRejectedValue(new Error('sem rede'));
    abrirAgenda(repositorio);

    expect(await avisoDeAmanha('Amanhã: 1 paciente')).toBeInTheDocument();
  });

  it('avisa quando não consegue carregar a lista de amanhã e deixa tentar de novo', async () => {
    const repositorio = repositorioCom();
    const original = repositorio.listarSessoes.bind(repositorio);
    let semRede = true;
    vi.spyOn(repositorio, 'listarSessoes').mockImplementation((de, ate) =>
      semRede && de === '2026-11-03' && ate === '2026-11-03' ? Promise.reject(new Error('sem rede')) : original(de, ate),
    );
    const { usuaria } = abrirAgenda(repositorio);

    expect(await screen.findByText('Não foi possível carregar a lista de amanhã.')).toBeInTheDocument();
    semRede = false;
    await usuaria.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(await avisoDeAmanha('Amanhã: 1 paciente')).toBeInTheDocument();
  });
});

describe('Lista de amanhã', () => {
  it('tocar no aviso abre a lista numa folha com o dia no título; Esc fecha e o foco volta ao aviso', async () => {
    const { usuaria } = abrirAgenda();
    const aviso = await avisoDeAmanha('Amanhã: 1 paciente');

    await usuaria.click(aviso);
    const folha = await screen.findByRole('dialog', { name: 'Amanhã, terça-feira, 03/11' });
    expect(folha).toHaveFocus();
    await usuaria.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(aviso).toHaveFocus();
  });

  it('mostra hora, paciente, responsável principal e telefone', async () => {
    const { usuaria } = abrirAgenda();
    const folha = await abrirLista(usuaria);

    const ana = await within(folha).findByRole('listitem');
    expect(ana).toHaveTextContent('14:00');
    expect(ana).toHaveTextContent('Ana Clara Souza');
    expect(ana).toHaveTextContent('Mariana Souza');
    expect(ana).toHaveTextContent('(85) 90000-0001');
    expect(within(ana).queryByText('sem telefone')).not.toBeInTheDocument();
  });

  it('o botão WhatsApp é um link para outra aba com a mensagem pronta', async () => {
    const { usuaria } = abrirAgenda();
    const folha = await abrirLista(usuaria);

    const link = await within(folha).findByRole('link', { name: 'WhatsApp de Mariana Souza' });
    expect(link).toHaveTextContent('WhatsApp');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    const url = new URL(link.getAttribute('href') ?? '');
    expect(`${url.origin}${url.pathname}`).toBe('https://wa.me/5585900000001');
    expect(url.searchParams.get('text')).toBe(
      'Olá, Mariana! Passando para lembrar da sessão de Ana amanhã, terça-feira, 03/11, às 14:00. ' +
        'Caso não possa comparecer, por favor avise com antecedência. Até amanhã!',
    );
  });

  it('usa a mensagem das configurações', async () => {
    const mensagemWhatsapp = 'Oi, {responsável}! {paciente} tem sessão {dia} às {hora}. {outro}';
    const { usuaria } = abrirAgenda(
      repositorioCom((s) => {
        s.configuracoes = { ...CONFIGURACOES_PADRAO, mensagemWhatsapp };
      }),
    );
    const folha = await abrirLista(usuaria);

    const link = await within(folha).findByRole('link', { name: /^WhatsApp/ });
    expect(new URL(link.getAttribute('href') ?? '').searchParams.get('text')).toBe(
      'Oi, Mariana! Ana tem sessão terça-feira, 03/11 às 14:00. {outro}',
    );
  });

  it('ordena por horário', async () => {
    const repositorio = repositorioCom((s) => s.sessoes.push(sessaoNo('2026-11-03', '09:00')));
    // O repositório entrega em ordem; a lista não pode depender disso.
    const original = repositorio.listarSessoes.bind(repositorio);
    vi.spyOn(repositorio, 'listarSessoes').mockImplementation(async (de, ate) => (await original(de, ate)).reverse());
    const { usuaria } = abrirAgenda(repositorio);
    await avisoDeAmanha('Amanhã: 2 pacientes');
    const folha = await abrirLista(usuaria);

    const horas = linhas(folha).map((l) => /\d\d:\d\d/.exec(l.textContent ?? '')?.[0]);
    expect(horas).toEqual(['09:00', '14:00']);
    expect(linhas(folha)[0]).toHaveTextContent('Pedro Henrique Lima');
    expect(linhas(folha)[1]).toHaveTextContent('Ana Clara Souza');
  });

  it('só lista sessões agendadas', async () => {
    const { usuaria } = abrirAgenda(
      repositorioCom((s) => {
        semHorarios(s);
        s.sessoes.push(
          sessaoNo('2026-11-03', '09:00', { pacienteId: ANA }),
          sessaoNo('2026-11-03', '10:00', { situacao: 'cancelada' }),
          sessaoNo('2026-11-03', '11:00', { situacao: 'compareceu' }),
        );
      }),
    );
    await avisoDeAmanha('Amanhã: 1 paciente');
    const folha = await abrirLista(usuaria);

    expect(linhas(folha)).toHaveLength(1);
    expect(linhas(folha)[0]).toHaveTextContent('Ana Clara Souza');
  });

  it('dia sem sessão: diz que não há nenhuma e a folha continua útil', async () => {
    const { usuaria } = abrirAgenda(repositorioCom(semHorarios));
    await avisoDeAmanha('Amanhã: nenhum paciente');
    const folha = await abrirLista(usuaria);

    expect(within(folha).getByText('Nenhuma sessão agendada neste dia.')).toBeInTheDocument();
    expect(linhas(folha)).toHaveLength(0);
    expect(within(folha).getByRole('button', { name: 'Próximo dia' })).toBeInTheDocument();
  });

  describe('setas', () => {
    it('"Próximo dia" e "Dia anterior" mudam o dia: o título passa a ser o dia e só aparecem sessões agendadas', async () => {
      const { usuaria } = abrirAgenda();
      const folha = await abrirLista(usuaria);
      await within(folha).findByRole('listitem');

      await usuaria.click(within(folha).getByRole('button', { name: 'Próximo dia' }));

      expect(await screen.findByRole('dialog', { name: 'quarta-feira, 04/11' })).toBe(folha);
      const pedro = await within(folha).findByRole('listitem');
      expect(pedro).toHaveTextContent('09:00');
      expect(pedro).toHaveTextContent('Pedro Henrique Lima');
      // O principal é o Carlos; a Fernanda (mãe, não principal) não entra.
      expect(pedro).toHaveTextContent('Carlos Lima');
      expect(pedro).not.toHaveTextContent('Fernanda');
      expect(within(pedro).getByRole('link', { name: 'WhatsApp de Carlos Lima' })).toBeInTheDocument();
      expect(within(folha).queryByText(/Ana Clara/)).not.toBeInTheDocument();

      await usuaria.click(within(folha).getByRole('button', { name: 'Dia anterior' }));

      expect(await screen.findByRole('dialog', { name: 'Amanhã, terça-feira, 03/11' })).toBe(folha);
      expect(await within(folha).findByText(/Ana Clara Souza/)).toBeInTheDocument();
    });

    it('a seta continua com o foco depois de trocar o dia', async () => {
      const { usuaria } = abrirAgenda();
      const folha = await abrirLista(usuaria);
      const proximo = within(folha).getByRole('button', { name: 'Próximo dia' });

      await usuaria.click(proximo);
      await within(folha).findByText(/Pedro Henrique Lima/);

      expect(proximo).toHaveFocus();
    });

    it('um dia com sessões canceladas ou realizadas mostra a lista vazia', async () => {
      const { usuaria } = abrirAgenda(
        repositorioCom((s) => {
          semHorarios(s);
          s.sessoes.push(sessaoNo('2026-11-04', '09:00', { situacao: 'cancelada' }));
        }),
      );
      await avisoDeAmanha('Amanhã: nenhum paciente');
      const folha = await abrirLista(usuaria);

      await usuaria.click(within(folha).getByRole('button', { name: 'Próximo dia' }));

      expect(await within(folha).findByText('Nenhuma sessão agendada neste dia.')).toBeInTheDocument();
    });
  });

  describe('sem telefone', () => {
    it('Maria Luísa (quinta) tem o telefone do responsável vazio: mostra "sem telefone" e nenhum botão de WhatsApp', async () => {
      const { usuaria } = abrirAgenda();
      const folha = await abrirLista(usuaria);
      await usuaria.click(within(folha).getByRole('button', { name: 'Próximo dia' }));
      await usuaria.click(within(folha).getByRole('button', { name: 'Próximo dia' }));

      expect(await screen.findByRole('dialog', { name: 'quinta-feira, 05/11' })).toBeInTheDocument();
      const maria = await waitFor(() => linhaDe(folha, 'Maria Luísa Costa'));
      expect(maria).toHaveTextContent('16:00');
      expect(maria).toHaveTextContent('Renata Costa');
      expect(within(maria).getByText('sem telefone')).toBeInTheDocument();
      expect(within(maria).queryByRole('link')).not.toBeInTheDocument();
      expect(within(folha).queryByRole('link', { name: /WhatsApp/ })).not.toBeInTheDocument();
    });

    it('paciente sem responsável principal não quebra: "sem telefone" e sem WhatsApp', async () => {
      const { usuaria } = abrirAgenda(
        repositorioCom((s) => {
          s.responsaveis = s.responsaveis.filter((r) => r.pacienteId !== ANA);
        }),
      );
      const folha = await abrirLista(usuaria);

      const ana = await within(folha).findByRole('listitem');
      expect(ana).toHaveTextContent('Ana Clara Souza');
      expect(ana).toHaveTextContent('Sem responsável principal');
      expect(within(ana).getByText('sem telefone')).toBeInTheDocument();
      expect(within(ana).queryByRole('link')).not.toBeInTheDocument();
      // Dá para confirmar do mesmo jeito.
      expect(within(ana).getByRole('checkbox', { name: 'Confirmado: Ana Clara Souza' })).toBeInTheDocument();
    });

    it('telefone inválido (incompleto) também vira "sem telefone", sem link', async () => {
      const { usuaria } = abrirAgenda(
        repositorioCom((s) => {
          s.responsaveis = s.responsaveis.map((r) => (r.pacienteId === ANA ? { ...r, telefone: '98823' } : r));
        }),
      );
      const folha = await abrirLista(usuaria);

      const ana = await within(folha).findByRole('listitem');
      expect(within(ana).getByText('sem telefone')).toBeInTheDocument();
      expect(within(ana).queryByRole('link')).not.toBeInTheDocument();
    });
  });

  describe('"Confirmado"', () => {
    const caixaDaAna = (folha: HTMLElement) =>
      within(folha).findByRole('checkbox', { name: 'Confirmado: Ana Clara Souza' });

    it('a caixa traz o nome do paciente e começa desmarcada', async () => {
      const { usuaria } = abrirAgenda();
      const folha = await abrirLista(usuaria);

      const caixa = await caixaDaAna(folha);
      expect(caixa).not.toBeChecked();
      expect(caixa.closest('label')).toHaveTextContent('Confirmado');
    });

    it('marcar grava confirmada = true e o cartão da agenda passa a mostrar o ícone de confirmado', async () => {
      const { usuaria, repositorio } = abrirAgenda();
      const terca = await screen.findByRole('region', { name: /terça-feira, 03\/11/i });
      const cartao = await within(terca).findByRole('button', { name: /Ana Clara Souza/ });
      expect(within(cartao).queryByText('Confirmada')).not.toBeInTheDocument();
      const folha = await abrirLista(usuaria);

      await usuaria.click(await caixaDaAna(folha));

      await waitFor(async () => {
        const [ana] = await repositorio.listarSessoes('2026-11-03', '2026-11-03');
        expect(ana.confirmada).toBe(true);
      });
      expect(await caixaDaAna(folha)).toBeChecked();
      await usuaria.click(within(folha).getByRole('button', { name: 'Fechar' }));
      await waitFor(() => expect(within(cartao).getByText('Confirmada')).toBeInTheDocument());
    });

    it('desmarcar volta confirmada para false', async () => {
      const { usuaria, repositorio } = abrirAgenda(
        repositorioCom((s) => {
          semHorarios(s);
          s.sessoes.push(sessaoNo('2026-11-03', '14:00', { pacienteId: ANA, confirmada: true }));
        }),
      );
      const folha = await abrirLista(usuaria);
      const caixa = await caixaDaAna(folha);
      expect(caixa).toBeChecked();

      await usuaria.click(caixa);

      await waitFor(() => expect(caixa).not.toBeChecked());
      const [ana] = await repositorio.listarSessoes('2026-11-03', '2026-11-03');
      expect(ana.confirmada).toBe(false);
    });

    it('cada linha confirma só a sua sessão', async () => {
      const { usuaria, repositorio } = abrirAgenda(repositorioCom((s) => s.sessoes.push(sessaoNo('2026-11-03', '09:00'))));
      await avisoDeAmanha('Amanhã: 2 pacientes');
      const folha = await abrirLista(usuaria);

      await usuaria.click(await within(folha).findByRole('checkbox', { name: 'Confirmado: Pedro Henrique Lima' }));

      await waitFor(async () => {
        const dia = await repositorio.listarSessoes('2026-11-03', '2026-11-03');
        expect(dia.map((s) => [s.pacienteNome, s.confirmada])).toEqual([
          ['Pedro Henrique Lima', true],
          ['Ana Clara Souza', false],
        ]);
      });
    });

    it('se não conseguir gravar, avisa e a caixa volta a ficar desmarcada', async () => {
      const { usuaria, repositorio } = abrirAgenda();
      const folha = await abrirLista(usuaria);
      const caixa = await caixaDaAna(folha);
      vi.spyOn(repositorio, 'atualizarSessao').mockRejectedValueOnce(new Error('sem rede'));

      await usuaria.click(caixa);

      expect(await within(folha).findByText('Não foi possível salvar. Tente de novo.')).toBeInTheDocument();
      expect(caixa).not.toBeChecked();
    });
  });
});
