import { screen, waitFor, within } from '@testing-library/react';
import { criarRepositorioMemoria } from '../../dados/memoria';
import { garantirAgenda } from '../../servicos/agenda';
import { horarioExemplo, pacienteExemplo } from '../../testes/fabricas';
import { abrirFicha, ANA, HOJE, PEDRO, repositorioDemo, secao, usarHojeFixo } from '../../testes/ficha';

usarHojeFixo();

describe('SecaoAtendimento', () => {
  it('"Quem encaminhou" lista os parceiros e mostra o escolhido; trocar grava', async () => {
    const { repositorio, usuaria } = abrirFicha(PEDRO);
    const atendimento = await screen.findByRole('region', { name: 'Atendimento' });
    const quem = within(atendimento).getByLabelText('Quem encaminhou');

    // Em ordem alfabética, como o repositório entrega.
    await within(quem).findByRole('option', { name: 'Dra. Camila Rocha' });
    expect(within(quem).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Não informado',
      'Dr. Rafael Nogueira',
      'Dra. Camila Rocha',
    ]);
    expect(quem).toHaveValue('demo-parceiro-camila');

    await usuaria.selectOptions(quem, 'Dr. Rafael Nogueira');
    await usuaria.click(within(atendimento).getByRole('button', { name: 'Salvar atendimento' }));

    expect(await within(atendimento).findByText('Atendimento salvo.')).toBeInTheDocument();
    expect((await repositorio.obterFicha(PEDRO))?.paciente.parceiroId).toBe('demo-parceiro-rafael');

    await usuaria.selectOptions(quem, 'Não informado');
    await usuaria.click(within(atendimento).getByRole('button', { name: 'Salvar atendimento' }));
    await waitFor(async () => expect((await repositorio.obterFicha(PEDRO))?.paciente.parceiroId).toBeNull());
  });

  it('a data de entrada pode ser corrigida', async () => {
    const { repositorio, usuaria } = abrirFicha(ANA);
    const atendimento = await screen.findByRole('region', { name: 'Atendimento' });

    await usuaria.clear(within(atendimento).getByLabelText('Data de entrada'));
    await usuaria.type(within(atendimento).getByLabelText('Data de entrada'), '2026-08-03');
    await usuaria.click(within(atendimento).getByRole('button', { name: 'Salvar atendimento' }));

    expect(await within(atendimento).findByText('Atendimento salvo.')).toBeInTheDocument();
    expect((await repositorio.obterFicha(ANA))?.paciente.dataEntrada).toBe('2026-08-03');
  });

  describe('mudar o tipo', () => {
    it('de Avaliação para Psicoterapia pede confirmação e só então chama mudarTipo', async () => {
      const repositorio = repositorioDemo();
      await garantirAgenda(repositorio, HOJE, 4);
      const { usuaria } = abrirFicha(PEDRO, repositorio);
      const atendimento = await screen.findByRole('region', { name: 'Atendimento' });

      const gatilho = within(atendimento).getByRole('button', { name: 'Mudar para psicoterapia' });
      await usuaria.click(gatilho);
      const dialogo = await screen.findByRole('dialog', { name: 'Mudar para psicoterapia?' });
      expect(dialogo).toHaveTextContent('Pedro Henrique Lima');
      // Nada mudou só por abrir a pergunta.
      expect((await repositorio.obterFicha(PEDRO))?.paciente.tipo).toBe('avaliacao');

      await usuaria.click(within(dialogo).getByRole('button', { name: 'Mudar tipo' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect((await repositorio.obterFicha(PEDRO))?.paciente.tipo).toBe('psicoterapia');
      // As sessões que ainda estão agendadas passam para psicoterapia; o histórico fica como era.
      const sessoes = await repositorio.listarSessoesDoPaciente(PEDRO);
      const futuras = sessoes.filter((s) => s.situacao === 'agendada');
      expect(futuras.length).toBeGreaterThan(0);
      expect(futuras.every((s) => s.tipo === 'psicoterapia' && s.avaliacaoId === null)).toBe(true);
      expect(sessoes.filter((s) => s.situacao === 'compareceu').every((s) => s.tipo === 'avaliacao')).toBe(true);
      // A ficha acompanha: cabeçalho de psicoterapia e sem a seção Avaliação.
      await waitFor(() => expect(screen.queryByRole('region', { name: 'Avaliação' })).not.toBeInTheDocument());
      expect(screen.queryByText(/sessão \d+ de \d+/)).not.toBeInTheDocument();
      expect(within(atendimento).getByRole('button', { name: 'Mudar para avaliação' })).toBeInTheDocument();
    });

    it('Cancelar (ou Esc) não muda nada', async () => {
      const { repositorio, usuaria } = abrirFicha(PEDRO);
      const atendimento = await screen.findByRole('region', { name: 'Atendimento' });

      await usuaria.click(within(atendimento).getByRole('button', { name: 'Mudar para psicoterapia' }));
      await usuaria.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancelar' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      await usuaria.click(within(atendimento).getByRole('button', { name: 'Mudar para psicoterapia' }));
      await screen.findByRole('dialog');
      await usuaria.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      expect((await repositorio.obterFicha(PEDRO))?.paciente.tipo).toBe('avaliacao');
    });

    it('de Psicoterapia para Avaliação abre uma avaliação nova, com as 5 etapas', async () => {
      const { repositorio, usuaria } = abrirFicha(ANA);
      const atendimento = await screen.findByRole('region', { name: 'Atendimento' });

      await usuaria.click(within(atendimento).getByRole('button', { name: 'Mudar para avaliação' }));
      await usuaria.click(within(await screen.findByRole('dialog', { name: 'Mudar para avaliação?' })).getByRole('button', { name: 'Mudar tipo' }));

      expect(await screen.findByText('Avaliação · sessão 1 de 10')).toBeInTheDocument();
      expect(within(secao('Avaliação')).getAllByRole('checkbox')).toHaveLength(5);
      const ficha = await repositorio.obterFicha(ANA);
      expect(ficha?.paciente.tipo).toBe('avaliacao');
      expect(ficha?.avaliacao?.inicio).toBe(HOJE);
    });

    it('se a troca falhar no meio, a ficha mostra o tipo já gravado e a pergunta continua sendo a mesma (não vira "mudar de volta")', async () => {
      const base = repositorioDemo();
      // O tipo é gravado primeiro; tirar as sessões antigas da agenda é uma etapa seguinte e falha.
      const removerSessoes = vi.fn().mockRejectedValueOnce(new Error('sem rede')).mockImplementation(base.removerSessoes);
      const { repositorio, usuaria } = abrirFicha(PEDRO, { ...base, removerSessoes });
      const atendimento = await screen.findByRole('region', { name: 'Atendimento' });

      await usuaria.click(within(atendimento).getByRole('button', { name: 'Mudar para psicoterapia' }));
      const dialogo = await screen.findByRole('dialog', { name: 'Mudar para psicoterapia?' });
      await usuaria.click(within(dialogo).getByRole('button', { name: 'Mudar tipo' }));

      expect(await within(dialogo).findByRole('alert')).toHaveTextContent('Não foi possível mudar o tipo. Tente de novo.');
      expect((await repositorio.obterFicha(PEDRO))?.paciente.tipo).toBe('psicoterapia');
      // A ficha já mostra o que foi gravado.
      await waitFor(() => expect(screen.queryByRole('region', { name: 'Avaliação' })).not.toBeInTheDocument());
      expect(screen.getByText('Psicoterapia')).toBeInTheDocument();
      // A pergunta continua sendo para psicoterapia, e repetir conclui sem desfazer a troca.
      expect(screen.getByRole('dialog', { name: 'Mudar para psicoterapia?' })).toBeInTheDocument();
      await usuaria.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Mudar tipo' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect((await repositorio.obterFicha(PEDRO))?.paciente.tipo).toBe('psicoterapia');
    });

    it('se falhar, o diálogo continua aberto com o aviso', async () => {
      const base = repositorioDemo();
      const salvarPaciente = vi.fn().mockRejectedValue(new Error('sem rede'));
      const { usuaria } = abrirFicha(ANA, { ...base, salvarPaciente });
      const atendimento = await screen.findByRole('region', { name: 'Atendimento' });

      await usuaria.click(within(atendimento).getByRole('button', { name: 'Mudar para avaliação' }));
      const dialogo = await screen.findByRole('dialog');
      await usuaria.click(within(dialogo).getByRole('button', { name: 'Mudar tipo' }));

      expect(await within(dialogo).findByRole('alert')).toHaveTextContent('Não foi possível mudar o tipo. Tente de novo.');
    });
  });

  describe('dar alta', () => {
    it('pede a data e a confirmação; o paciente vai para o grupo Alta', async () => {
      const { repositorio, usuaria } = abrirFicha(ANA);
      const atendimento = await screen.findByRole('region', { name: 'Atendimento' });

      await usuaria.click(within(atendimento).getByRole('button', { name: 'Dar alta' }));
      // A data já vem preenchida com hoje.
      const data = within(atendimento).getByLabelText('Data da alta');
      expect(data).toHaveValue(HOJE);
      await usuaria.clear(data);
      await usuaria.type(data, '2026-11-06');
      await usuaria.click(within(atendimento).getByRole('button', { name: 'Continuar' }));

      const dialogo = await screen.findByRole('dialog', { name: 'Dar alta?' });
      expect(dialogo).toHaveTextContent('Ana Clara Souza');
      expect(dialogo).toHaveTextContent('06/11/2026');
      // Ainda nada gravado.
      expect((await repositorio.obterFicha(ANA))?.paciente.status).toBe('ativo');

      await usuaria.click(within(dialogo).getByRole('button', { name: 'Confirmar alta' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      const ficha = await repositorio.obterFicha(ANA);
      expect(ficha?.paciente).toMatchObject({ status: 'alta', dataAlta: '2026-11-06' });
      expect(ficha?.horarios.every((h) => h.validoAte === '2026-11-06')).toBe(true);
      expect(await screen.findByText('Alta em 06/11/2026')).toBeInTheDocument();
      // Sem ações de atendimento para quem já teve alta.
      expect(within(atendimento).queryByRole('button', { name: 'Dar alta' })).not.toBeInTheDocument();
      expect(within(atendimento).queryByRole('button', { name: /Mudar para/ })).not.toBeInTheDocument();

      await usuaria.click(screen.getByRole('link', { name: 'Voltar para Pacientes' }));
      const grupoAlta = (await screen.findByRole('heading', { name: 'Alta (1)' })).closest('section') as HTMLElement;
      expect(within(grupoAlta).getByRole('link', { name: /Ana Clara Souza/ })).toBeInTheDocument();
    });

    it('se a alta falhar no meio, a ficha mostra a alta já gravada e avisa que a agenda precisa ser conferida', async () => {
      const base = repositorioDemo();
      // A data da alta é gravada primeiro; tirar as sessões agendadas da agenda vem depois e falha.
      const removerSessoes = vi.fn().mockRejectedValue(new Error('sem rede'));
      const { repositorio, usuaria } = abrirFicha(ANA, { ...base, removerSessoes });
      const atendimento = await screen.findByRole('region', { name: 'Atendimento' });

      await usuaria.click(within(atendimento).getByRole('button', { name: 'Dar alta' }));
      await usuaria.click(within(atendimento).getByRole('button', { name: 'Continuar' }));
      await usuaria.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirmar alta' }));

      expect(await screen.findByText('Alta em 02/11/2026')).toBeInTheDocument();
      expect(await within(atendimento).findByRole('alert')).toHaveTextContent(
        'A alta foi registrada, mas não foi possível atualizar os horários e as sessões agendadas. Confira a agenda.',
      );
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect((await repositorio.obterFicha(ANA))?.paciente).toMatchObject({ status: 'alta', dataAlta: HOJE });
      expect(within(atendimento).queryByRole('button', { name: 'Dar alta' })).not.toBeInTheDocument();
    });

    it('Cancelar em qualquer passo não dá alta', async () => {
      const { repositorio, usuaria } = abrirFicha(ANA);
      const atendimento = await screen.findByRole('region', { name: 'Atendimento' });

      await usuaria.click(within(atendimento).getByRole('button', { name: 'Dar alta' }));
      await usuaria.click(within(atendimento).getByRole('button', { name: 'Cancelar' }));
      expect(within(atendimento).queryByLabelText('Data da alta')).not.toBeInTheDocument();

      await usuaria.click(within(atendimento).getByRole('button', { name: 'Dar alta' }));
      await usuaria.click(within(atendimento).getByRole('button', { name: 'Continuar' }));
      await usuaria.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancelar' }));

      expect((await repositorio.obterFicha(ANA))?.paciente.status).toBe('ativo');
    });

    it('a data da alta é obrigatória', async () => {
      const { usuaria } = abrirFicha(ANA);
      const atendimento = await screen.findByRole('region', { name: 'Atendimento' });

      await usuaria.click(within(atendimento).getByRole('button', { name: 'Dar alta' }));
      await usuaria.clear(within(atendimento).getByLabelText('Data da alta'));
      await usuaria.click(within(atendimento).getByRole('button', { name: 'Continuar' }));

      expect(await within(atendimento).findByText('Informe a data da alta.')).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('as sessões ainda agendadas depois da alta saem da agenda; o histórico fica', async () => {
      const repositorio = repositorioDemo();
      await garantirAgenda(repositorio, HOJE, 4);
      const { usuaria } = abrirFicha(PEDRO, repositorio);
      const atendimento = await screen.findByRole('region', { name: 'Atendimento' });

      await usuaria.click(within(atendimento).getByRole('button', { name: 'Dar alta' }));
      await usuaria.click(within(atendimento).getByRole('button', { name: 'Continuar' }));
      await usuaria.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirmar alta' }));

      await waitFor(async () => expect((await repositorio.obterFicha(PEDRO))?.paciente.status).toBe('alta'));
      const sessoes = await repositorio.listarSessoesDoPaciente(PEDRO);
      expect(sessoes.filter((s) => s.situacao === 'agendada')).toEqual([]);
      expect(sessoes.filter((s) => s.situacao === 'compareceu')).toHaveLength(3);
    });
  });

  describe('lista de espera', () => {
    it('"Iniciar atendimento" ativa o paciente e a agenda passa a gerar as sessões dele', async () => {
      const repositorio = criarRepositorioMemoria({
        pacientes: [pacienteExemplo({ status: 'lista_espera', dataEntrada: null })],
        horarios: [horarioExemplo({ validoDe: HOJE })],
      });
      const { usuaria } = abrirFicha('p1', repositorio);
      const atendimento = await screen.findByRole('region', { name: 'Atendimento' });
      expect(screen.getByText('Na lista de espera')).toBeInTheDocument();
      expect(await repositorio.listarSessoesDoPaciente('p1')).toEqual([]);

      await usuaria.click(within(atendimento).getByRole('button', { name: 'Iniciar atendimento' }));

      await waitFor(async () => expect((await repositorio.obterFicha('p1'))?.paciente.status).toBe('ativo'));
      const sessoes = await repositorio.listarSessoesDoPaciente('p1');
      expect(sessoes.map((s) => s.dataOcorrencia)).toEqual(['2026-11-03', '2026-11-10', '2026-11-17', '2026-11-24']);
      await waitFor(() => expect(screen.queryByText('Na lista de espera')).not.toBeInTheDocument());
      expect(within(atendimento).queryByRole('button', { name: 'Iniciar atendimento' })).not.toBeInTheDocument();
    });

    it('se a agenda falhar depois de ativar o paciente, a ficha mostra o atendimento iniciado e avisa', async () => {
      const base = criarRepositorioMemoria({
        pacientes: [pacienteExemplo({ status: 'lista_espera', dataEntrada: null })],
        horarios: [horarioExemplo({ validoDe: HOJE })],
      });
      const inserirOcorrencias = vi.fn().mockRejectedValueOnce(new Error('sem rede')).mockImplementation(base.inserirOcorrencias);
      const { usuaria } = abrirFicha('p1', { ...base, inserirOcorrencias });
      const atendimento = await screen.findByRole('region', { name: 'Atendimento' });

      await usuaria.click(within(atendimento).getByRole('button', { name: 'Iniciar atendimento' }));

      expect(await within(atendimento).findByRole('alert')).toHaveTextContent(
        'O atendimento foi iniciado, mas não foi possível completar a agenda. Abra a agenda para completar as sessões.',
      );
      expect((await base.obterFicha('p1'))?.paciente.status).toBe('ativo');
      await waitFor(() => expect(screen.queryByText('Na lista de espera')).not.toBeInTheDocument());
      expect(within(atendimento).queryByRole('button', { name: 'Iniciar atendimento' })).not.toBeInTheDocument();
    });

    it('quem já está em atendimento não vê "Iniciar atendimento"', async () => {
      abrirFicha(ANA);
      const atendimento = await screen.findByRole('region', { name: 'Atendimento' });

      expect(within(atendimento).queryByRole('button', { name: 'Iniciar atendimento' })).not.toBeInTheDocument();
    });
  });
});
