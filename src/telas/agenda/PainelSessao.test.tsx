import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { criarRepositorioMemoria } from '../../dados/memoria';
import type { Repositorio } from '../../dados/repositorio';
import { useSessoes } from '../../dados/useAgenda';
import { instanteDe } from '../../regras/datas';
import { avaliacaoExemplo, pacienteExemplo, sessaoExemplo } from '../../testes/fabricas';
import { usarHojeFixo } from '../../testes/ficha';
import { Provedores } from '../../Provedores';
import { PainelSessao } from './PainelSessao';

usarHojeFixo();

/** A sessão de teste: terça 03/11, 14:00 (Ana, `p1`). */
const ID = 's1';

/** Faz o papel da agenda: busca a sessão na semana e entrega ao painel, que se atualiza a cada mudança. */
function Pai() {
  const { data } = useSessoes('2026-11-02', '2026-11-08');
  const sessao = data?.find((s) => s.id === ID);
  return sessao ? <PainelSessao sessao={sessao} /> : <p>Carregando…</p>;
}

function repositorioCom(sessao = sessaoExemplo(), paciente = pacienteExemplo({ dataEntrada: null })): Repositorio {
  return criarRepositorioMemoria({ pacientes: [paciente], sessoes: [sessao] });
}

function abrirPainel(repositorio: Repositorio = repositorioCom()) {
  render(
    <Provedores repositorio={repositorio} semNovasTentativas>
      <Pai />
    </Provedores>,
  );
  return { repositorio, usuaria: userEvent.setup() };
}

const sessaoGravada = async (repositorio: Repositorio, id = ID) =>
  (await repositorio.listarSessoesDoPaciente('p1')).find((s) => s.id === id);

describe('PainelSessao', () => {
  it('mostra o dia, a hora, o tipo e a situação, e os controles da sessão', async () => {
    abrirPainel();

    expect(await screen.findByText('terça-feira, 03/11 · 14:00 · 50 min')).toBeInTheDocument();
    expect(screen.getByText('Psicoterapia')).toBeInTheDocument();
    expect(screen.getByText('Agendada')).toBeInTheDocument();
    for (const nome of ['Compareceu', 'Faltou com aviso', 'Faltou sem aviso', 'Cancelar sessão', 'Remarcar']) {
      expect(screen.getByRole('button', { name: nome })).toBeInTheDocument();
    }
    expect(screen.getByLabelText('Nova data')).toBeInTheDocument();
    expect(screen.getByLabelText('Nova hora')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Acompanhamento familiar' })).not.toBeChecked();
    expect(screen.getByLabelText('Observação')).toHaveValue('');
  });

  it('em avaliação, mostra "sessão X de N" contando só os comparecimentos anteriores', async () => {
    const repositorio = criarRepositorioMemoria({
      pacientes: [pacienteExemplo({ tipo: 'avaliacao', dataEntrada: '2026-10-20' })],
      avaliacoes: [avaliacaoExemplo({ sessoesPrevistas: 8 })],
      sessoes: [
        sessaoExemplo({ id: 'a', tipo: 'avaliacao', avaliacaoId: 'av1', situacao: 'compareceu', inicio: '2026-10-20T17:00:00.000Z' }),
        sessaoExemplo({ id: 'b', tipo: 'avaliacao', avaliacaoId: 'av1', situacao: 'falta_sem_aviso', inicio: '2026-10-27T17:00:00.000Z' }),
        sessaoExemplo({ id: ID, tipo: 'avaliacao', avaliacaoId: 'av1' }),
      ],
    });
    abrirPainel(repositorio);

    expect(await screen.findByText('sessão 2 de 8')).toBeInTheDocument();
  });

  describe('situação', () => {
    it.each([
      ['Compareceu', 'compareceu'],
      ['Faltou com aviso', 'falta_com_aviso'],
      ['Faltou sem aviso', 'falta_sem_aviso'],
      ['Cancelar sessão', 'cancelada'],
    ])('"%s" grava a situação %s e o botão fica marcado', async (botao, situacao) => {
      const { usuaria, repositorio } = abrirPainel();

      await usuaria.click(await screen.findByRole('button', { name: botao }));

      await waitFor(() => expect(screen.getByRole('button', { name: botao })).toHaveAttribute('aria-pressed', 'true'));
      expect((await sessaoGravada(repositorio))?.situacao).toBe(situacao);
      expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1);
    });

    it('"Voltar para Agendada" desfaz a marcação: o chip volta a "Agendada" e nenhum botão fica marcado', async () => {
      const { usuaria, repositorio } = abrirPainel();
      await usuaria.click(await screen.findByRole('button', { name: 'Faltou sem aviso' }));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Faltou sem aviso' })).toHaveAttribute('aria-pressed', 'true'));
      expect(screen.getByText('Faltou sem aviso', { selector: 'span' })).toBeInTheDocument();

      await usuaria.click(screen.getByRole('button', { name: 'Voltar para Agendada' }));

      await waitFor(() => expect(screen.getByText('Agendada', { selector: 'span' })).toBeInTheDocument());
      expect(screen.queryByRole('button', { pressed: true })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Voltar para Agendada' })).not.toBeInTheDocument();
      expect((await sessaoGravada(repositorio))?.situacao).toBe('agendada');
    });

    it('"Voltar para Agendada" só aparece depois de marcada uma situação', async () => {
      abrirPainel();

      await screen.findByRole('button', { name: 'Compareceu' });
      expect(screen.queryByRole('button', { name: 'Voltar para Agendada' })).not.toBeInTheDocument();
    });

    it('tocar de novo no botão já marcado não desmarca (só "Voltar para Agendada" desfaz)', async () => {
      const { usuaria, repositorio } = abrirPainel();
      await usuaria.click(await screen.findByRole('button', { name: 'Cancelar sessão' }));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Cancelar sessão' })).toHaveAttribute('aria-pressed', 'true'));

      await usuaria.click(screen.getByRole('button', { name: 'Cancelar sessão' }));

      await waitFor(() => expect(screen.getByRole('button', { name: 'Cancelar sessão' })).toHaveAttribute('aria-pressed', 'true'));
      expect((await sessaoGravada(repositorio))?.situacao).toBe('cancelada');
    });

    it('o primeiro comparecimento define a data de entrada do paciente', async () => {
      const { usuaria, repositorio } = abrirPainel();

      await usuaria.click(await screen.findByRole('button', { name: 'Compareceu' }));

      await waitFor(async () => expect((await repositorio.obterFicha('p1'))?.paciente.dataEntrada).toBe('2026-11-03'));
    });

    it('avisa quando não foi possível gravar e deixa tentar de novo', async () => {
      const { usuaria, repositorio } = abrirPainel();
      const atualizar = vi.spyOn(repositorio, 'atualizarSessao').mockRejectedValueOnce(new Error('sem rede'));

      await usuaria.click(await screen.findByRole('button', { name: 'Faltou sem aviso' }));
      expect(await screen.findByText('Não foi possível salvar. Tente de novo.')).toBeInTheDocument();

      await usuaria.click(screen.getByRole('button', { name: 'Faltou sem aviso' }));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Faltou sem aviso' })).toHaveAttribute('aria-pressed', 'true'));
      expect(screen.queryByText('Não foi possível salvar. Tente de novo.')).not.toBeInTheDocument();
      expect(atualizar).toHaveBeenCalledTimes(2);
    });
  });

  describe('remarcar', () => {
    it('cria a nova sessão na data e hora escolhidas e mostra "Remarcada para {dia}, {hora}"', async () => {
      const { usuaria, repositorio } = abrirPainel();

      await usuaria.type(await screen.findByLabelText('Nova data'), '2026-11-05');
      await usuaria.type(screen.getByLabelText('Nova hora'), '15:00');
      await usuaria.click(screen.getByRole('button', { name: 'Remarcar' }));

      expect(await screen.findByText('Remarcada para quinta-feira, 05/11, 15:00')).toBeInTheDocument();
      expect(screen.getByText('Remarcada')).toBeInTheDocument();
      const todas = await repositorio.listarSessoesDoPaciente('p1');
      const nova = todas.find((s) => s.id !== ID);
      expect(nova).toMatchObject({ inicio: instanteDe('2026-11-05', '15:00'), situacao: 'agendada', origem: 'remarcacao' });
      expect(todas.find((s) => s.id === ID)).toMatchObject({ situacao: 'remarcada', remarcadaPara: nova?.id });
    });

    it('sem os botões de situação, nem o formulário de remarcar, depois de remarcada', async () => {
      const { usuaria } = abrirPainel();
      await usuaria.type(await screen.findByLabelText('Nova data'), '2026-11-05');
      await usuaria.type(screen.getByLabelText('Nova hora'), '15:00');
      await usuaria.click(screen.getByRole('button', { name: 'Remarcar' }));
      await screen.findByText('Remarcada para quinta-feira, 05/11, 15:00');

      for (const nome of ['Compareceu', 'Faltou com aviso', 'Faltou sem aviso', 'Cancelar sessão', 'Remarcar']) {
        expect(screen.queryByRole('button', { name: nome })).not.toBeInTheDocument();
      }
      expect(screen.queryByLabelText('Nova data')).not.toBeInTheDocument();
      // Ainda dá para mexer na observação.
      expect(screen.getByLabelText('Observação')).toBeInTheDocument();
    });

    it('uma sessão já remarcada, aberta de novo, mostra o destino mesmo em outra semana', async () => {
      const repositorio = criarRepositorioMemoria({
        pacientes: [pacienteExemplo()],
        sessoes: [
          sessaoExemplo({ id: ID, situacao: 'remarcada', remarcadaPara: 'destino' }),
          sessaoExemplo({ id: 'destino', inicio: instanteDe('2026-11-17', '16:30'), origem: 'remarcacao' }),
        ],
      });
      abrirPainel(repositorio);

      expect(await screen.findByText('Remarcada para terça-feira, 17/11, 16:30')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Compareceu' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Remarcar' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Voltar para Agendada' })).not.toBeInTheDocument();
    });

    it.each([
      ['compareceu', false],
      ['falta_sem_aviso', false],
      ['agendada', true],
      ['falta_com_aviso', true],
      ['cancelada', true],
    ] as const)('sessão %s: oferece remarcar? %s (a que já é cobrada não pode virar "remarcada")', async (situacao, oferece) => {
      abrirPainel(repositorioCom(sessaoExemplo({ situacao })));

      await screen.findByText('terça-feira, 03/11 · 14:00 · 50 min');
      expect(screen.queryByRole('button', { name: 'Remarcar' }) !== null).toBe(oferece);
      expect(screen.queryByLabelText('Nova data') !== null).toBe(oferece);
      // A situação continua podendo ser corrigida.
      expect(screen.getByRole('button', { name: 'Compareceu' })).toBeInTheDocument();
    });

    it('marcar "Compareceu" tira o remarcar; "Voltar para Agendada" traz de volta', async () => {
      const { usuaria } = abrirPainel();
      await usuaria.click(await screen.findByRole('button', { name: 'Compareceu' }));
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Remarcar' })).not.toBeInTheDocument());

      await usuaria.click(screen.getByRole('button', { name: 'Voltar para Agendada' }));

      expect(await screen.findByRole('button', { name: 'Remarcar' })).toBeInTheDocument();
    });

    it('pede data e hora, e não cria nada quando faltam', async () => {
      const { usuaria, repositorio } = abrirPainel();

      await usuaria.click(await screen.findByRole('button', { name: 'Remarcar' }));

      expect(screen.getByText('Informe a nova data.')).toBeInTheDocument();
      expect(screen.getByText('Informe a nova hora.')).toBeInTheDocument();
      expect(await repositorio.listarSessoesDoPaciente('p1')).toHaveLength(1);
    });

    it('recusa o mesmo dia e a mesma hora', async () => {
      const { usuaria } = abrirPainel();
      await usuaria.type(await screen.findByLabelText('Nova data'), '2026-11-03');
      await usuaria.type(screen.getByLabelText('Nova hora'), '14:00');

      await usuaria.click(screen.getByRole('button', { name: 'Remarcar' }));

      expect(screen.getByText('Escolha uma data ou uma hora diferente da atual.')).toBeInTheDocument();
    });

    it('avisa quando a remarcação falha', async () => {
      const { usuaria, repositorio } = abrirPainel();
      vi.spyOn(repositorio, 'criarSessao').mockRejectedValue(new Error('sem rede'));
      await usuaria.type(await screen.findByLabelText('Nova data'), '2026-11-05');
      await usuaria.type(screen.getByLabelText('Nova hora'), '15:00');

      await usuaria.click(screen.getByRole('button', { name: 'Remarcar' }));

      expect(await screen.findByText('Não foi possível remarcar. Confira a agenda antes de tentar de novo.')).toBeInTheDocument();
    });
  });

  describe('acompanhamento familiar', () => {
    it('liga e desliga, gravando na sessão', async () => {
      const { usuaria, repositorio } = abrirPainel();
      const caixa = await screen.findByRole('checkbox', { name: 'Acompanhamento familiar' });

      await usuaria.click(caixa);
      await waitFor(() => expect(screen.getByText('Acompanhamento familiar', { selector: 'span' })).toBeInTheDocument());
      expect(caixa).toBeChecked();
      expect((await sessaoGravada(repositorio))?.acompanhamentoFamiliar).toBe(true);

      await usuaria.click(caixa);
      await waitFor(async () => expect((await sessaoGravada(repositorio))?.acompanhamentoFamiliar).toBe(false));
      expect(caixa).not.toBeChecked();
    });

    it('já vem ligado numa sessão familiar, com o rótulo do tipo "Acompanhamento familiar"', async () => {
      abrirPainel(repositorioCom(sessaoExemplo({ acompanhamentoFamiliar: true })));

      expect(await screen.findByRole('checkbox', { name: 'Acompanhamento familiar' })).toBeChecked();
      expect(screen.queryByText('Psicoterapia')).not.toBeInTheDocument();
    });
  });

  describe('observação', () => {
    it('mostra a que já existe e grava o que for digitado', async () => {
      const { usuaria, repositorio } = abrirPainel(repositorioCom(sessaoExemplo({ observacao: 'Trazer o caderno.' })));
      const campo = await screen.findByLabelText('Observação');
      expect(campo).toHaveValue('Trazer o caderno.');

      await usuaria.clear(campo);
      await usuaria.type(campo, '  Combinar a devolutiva.  ');
      await usuaria.click(screen.getByRole('button', { name: 'Salvar observação' }));

      expect(await screen.findByText('Observação salva.')).toBeInTheDocument();
      expect((await sessaoGravada(repositorio))?.observacao).toBe('Combinar a devolutiva.');
    });

    it('apagar o texto grava a observação como vazia', async () => {
      const { usuaria, repositorio } = abrirPainel(repositorioCom(sessaoExemplo({ observacao: 'Algo' })));

      await usuaria.clear(await screen.findByLabelText('Observação'));
      await usuaria.click(screen.getByRole('button', { name: 'Salvar observação' }));

      await screen.findByText('Observação salva.');
      expect((await sessaoGravada(repositorio))?.observacao).toBeNull();
    });

    it('avisa quando não foi possível salvar', async () => {
      const { usuaria, repositorio } = abrirPainel();
      vi.spyOn(repositorio, 'atualizarSessao').mockRejectedValue(new Error('sem rede'));

      await usuaria.type(await screen.findByLabelText('Observação'), 'Oi');
      await usuaria.click(screen.getByRole('button', { name: 'Salvar observação' }));

      expect(await screen.findByText('Não foi possível salvar a observação. Tente de novo.')).toBeInTheDocument();
      expect(screen.queryByText('Observação salva.')).not.toBeInTheDocument();
    });
  });
});
