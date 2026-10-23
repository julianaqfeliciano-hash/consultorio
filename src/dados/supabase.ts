import type { SupabaseClient } from '@supabase/supabase-js';
import type { DataISO, HorarioComPaciente, Id, StatusPaciente, TipoAtendimento } from '../dominio/tipos';
import { instanteDe, somarDias } from '../regras/datas';
import {
  avaliacaoParaLinha,
  bloqueioParaLinha,
  configuracoesParaLinha,
  horarioParaLinha,
  linhaParaAvaliacao,
  linhaParaBloqueio,
  linhaParaConfiguracoes,
  linhaParaHorario,
  linhaParaPaciente,
  linhaParaParceiro,
  linhaParaResponsavel,
  linhaParaSessao,
  mudancasSessaoParaLinha,
  pacienteParaLinha,
  parceiroParaLinha,
  responsavelParaLinha,
  sessaoParaLinha,
  type LinhaAvaliacao,
  type LinhaBloqueio,
  type LinhaConfiguracoes,
  type LinhaHorario,
  type LinhaPaciente,
  type LinhaParceiro,
  type LinhaResponsavel,
  type LinhaSessao,
} from './mapeamento';
import type { FichaPaciente, Repositorio, SessaoComPaciente } from './repositorio';

/** Quantos ids vão de uma vez num filtro `in (...)`, para a URL não ficar enorme. */
const IDS_POR_PEDIDO = 100;

const FORMATO_DATA = /^\d{4}-\d{2}-\d{2}$/;

interface Resposta {
  data: unknown;
  error: { message: string } | null;
}

/** Devolve os dados da resposta ou lança o erro do Supabase. */
function dados<T>(resposta: Resposta): T {
  if (resposta.error) throw new Error(resposta.error.message, { cause: resposta.error });
  return resposta.data as T;
}

/** Datas entram em filtros de texto (`or(...)`); só passam no formato esperado. */
function exigirData(d: DataISO): DataISO {
  if (!FORMATO_DATA.test(d)) throw new Error(`Data inválida: ${d}`);
  return d;
}

type LinhaSessaoComPaciente = LinhaSessao & {
  pacientes: {
    nome: string;
    responsaveis: { nome: string; telefone: string | null; principal: boolean }[];
  } | null;
};

type LinhaHorarioComPaciente = LinhaHorario & {
  pacientes: {
    status: StatusPaciente;
    tipo: TipoAtendimento;
    avaliacoes: { id: string; inicio: string }[];
  } | null;
};

/**
 * Repositório de produção: fala com o Supabase como a usuária que está logada.
 * `dono` e `criado_em` ficam por conta do banco (defaults + RLS); aqui nunca vão no envio.
 */
export function criarRepositorioSupabase(cliente: SupabaseClient): Repositorio {
  return {
    async obterConfiguracoes() {
      const linha = dados<LinhaConfiguracoes | null>(await cliente.from('configuracoes').select('*').maybeSingle());
      return linha ? linhaParaConfiguracoes(linha) : null;
    },
    async salvarConfiguracoes(c) {
      // A chave primária é `dono` (o banco preenche com auth.uid()): uma linha por usuária.
      dados(await cliente.from('configuracoes').upsert(configuracoesParaLinha(c), { onConflict: 'dono' }));
    },

    async listarParceiros() {
      const linhas = dados<LinhaParceiro[]>(await cliente.from('parceiros').select('*').order('nome'));
      return linhas.map(linhaParaParceiro);
    },
    async salvarParceiro(p) {
      const linha = dados<LinhaParceiro>(await cliente.from('parceiros').upsert(parceiroParaLinha(p)).select().single());
      return linhaParaParceiro(linha);
    },
    async removerParceiro(id) {
      // pacientes.parceiro_id é "on delete set null": os pacientes ficam sem parceiro.
      dados(await cliente.from('parceiros').delete().eq('id', id));
    },

    async listarPacientes() {
      const linhas = dados<LinhaPaciente[]>(await cliente.from('pacientes').select('*').order('nome'));
      return linhas.map(linhaParaPaciente);
    },
    async obterFicha(pacienteId): Promise<FichaPaciente | null> {
      const [paciente, responsaveis, horarios, avaliacoes] = await Promise.all([
        cliente.from('pacientes').select('*').eq('id', pacienteId).maybeSingle(),
        cliente
          .from('responsaveis')
          .select('*')
          .eq('paciente_id', pacienteId)
          .order('principal', { ascending: false })
          .order('criado_em'),
        cliente
          .from('horarios_fixos')
          .select('*')
          .eq('paciente_id', pacienteId)
          .order('valido_de')
          .order('dia_semana')
          .order('hora'),
        cliente
          .from('avaliacoes')
          .select('*')
          .eq('paciente_id', pacienteId)
          .order('inicio', { ascending: false })
          .limit(1),
      ]);
      const linhaPaciente = dados<LinhaPaciente | null>(paciente);
      if (!linhaPaciente) return null;
      const maisRecente = dados<LinhaAvaliacao[]>(avaliacoes)[0];
      return {
        paciente: linhaParaPaciente(linhaPaciente),
        responsaveis: dados<LinhaResponsavel[]>(responsaveis).map(linhaParaResponsavel),
        horarios: dados<LinhaHorario[]>(horarios).map(linhaParaHorario),
        avaliacao: maisRecente ? linhaParaAvaliacao(maisRecente) : null,
      };
    },
    async salvarPaciente(p) {
      const linha = dados<LinhaPaciente>(await cliente.from('pacientes').upsert(pacienteParaLinha(p)).select().single());
      return linhaParaPaciente(linha);
    },
    async salvarResponsavel(r) {
      // O banco só admite um principal por paciente (índice único parcial): primeiro
      // desmarca os outros, depois grava. Se a gravação falhar, devolve a marca ao anterior.
      let desmarcados: Id[] = [];
      if (r.principal) {
        let desmarcar = cliente
          .from('responsaveis')
          .update({ principal: false })
          .eq('paciente_id', r.pacienteId)
          .eq('principal', true);
        if (r.id !== undefined) desmarcar = desmarcar.neq('id', r.id);
        desmarcados = dados<{ id: Id }[]>(await desmarcar.select('id')).map((x) => x.id);
      }
      const resposta = await cliente.from('responsaveis').upsert(responsavelParaLinha(r)).select().single();
      if (resposta.error && desmarcados.length > 0) {
        await cliente.from('responsaveis').update({ principal: true }).in('id', desmarcados);
      }
      return linhaParaResponsavel(dados<LinhaResponsavel>(resposta));
    },
    async removerResponsavel(id) {
      dados(await cliente.from('responsaveis').delete().eq('id', id));
    },
    async salvarHorario(h) {
      const linha = dados<LinhaHorario>(await cliente.from('horarios_fixos').upsert(horarioParaLinha(h)).select().single());
      return linhaParaHorario(linha);
    },
    async salvarAvaliacao(a) {
      const linha = dados<LinhaAvaliacao>(await cliente.from('avaliacoes').upsert(avaliacaoParaLinha(a)).select().single());
      return linhaParaAvaliacao(linha);
    },

    async listarHorariosVigentes(de, ate) {
      exigirData(de);
      exigirData(ate);
      const linhas = dados<LinhaHorarioComPaciente[]>(
        await cliente
          .from('horarios_fixos')
          .select('*, pacientes(status, tipo, avaliacoes(id, inicio))')
          .lte('valido_de', ate)
          .or(`valido_ate.is.null,valido_ate.gte.${de}`)
          .order('dia_semana')
          .order('hora'),
      );
      const vigentes: HorarioComPaciente[] = [];
      for (const { pacientes, ...linha } of linhas) {
        if (!pacientes) continue;
        // Se houver mais de uma avaliação, vale a de início mais recente.
        const maisRecente = [...pacientes.avaliacoes].sort((a, b) => b.inicio.localeCompare(a.inicio))[0];
        vigentes.push({
          ...linhaParaHorario(linha),
          statusPaciente: pacientes.status,
          tipoPaciente: pacientes.tipo,
          avaliacaoId: maisRecente?.id ?? null,
        });
      }
      return vigentes;
    },
    async listarSessoes(de, ate) {
      // Os dias são os do consultório: da meia-noite local de `de` até a meia-noite local depois de `ate`.
      const linhas = dados<LinhaSessaoComPaciente[]>(
        await cliente
          .from('sessoes')
          .select('*, pacientes(nome, responsaveis(nome, telefone, principal))')
          .gte('inicio', instanteDe(de, '00:00'))
          .lt('inicio', instanteDe(somarDias(ate, 1), '00:00'))
          .order('inicio'),
      );
      return linhas.map(({ pacientes, ...linha }): SessaoComPaciente => {
        const principal = pacientes?.responsaveis.find((r) => r.principal);
        return {
          ...linhaParaSessao(linha),
          pacienteNome: pacientes?.nome ?? '',
          responsavelPrincipal: principal ? { nome: principal.nome, telefone: principal.telefone ?? '' } : null,
        };
      });
    },
    async listarSessoesDoPaciente(pacienteId) {
      const linhas = dados<LinhaSessao[]>(
        await cliente.from('sessoes').select('*').eq('paciente_id', pacienteId).order('inicio'),
      );
      return linhas.map(linhaParaSessao);
    },
    async inserirOcorrencias(novas) {
      if (novas.length === 0) return 0;
      // `ignoreDuplicates` = "on conflict do nothing": só volta (e só conta) o que entrou de fato.
      const entraram = dados<{ id: Id }[]>(
        await cliente
          .from('sessoes')
          .upsert(novas.map(sessaoParaLinha), {
            onConflict: 'horario_fixo_id,data_ocorrencia',
            ignoreDuplicates: true,
          })
          .select('id'),
      );
      return entraram.length;
    },
    async criarSessao(nova) {
      const linha = dados<LinhaSessao>(await cliente.from('sessoes').insert(sessaoParaLinha(nova)).select().single());
      return linhaParaSessao(linha);
    },
    async atualizarSessao(id, mudancas) {
      const colunas = mudancasSessaoParaLinha(mudancas);
      // Um update sem colunas não é um pedido válido: só relê a sessão.
      const resposta =
        Object.keys(colunas).length === 0
          ? await cliente.from('sessoes').select('*').eq('id', id).single()
          : await cliente.from('sessoes').update(colunas).eq('id', id).select().single();
      return linhaParaSessao(dados<LinhaSessao>(resposta));
    },
    async removerSessoes(ids) {
      for (let i = 0; i < ids.length; i += IDS_POR_PEDIDO) {
        dados(await cliente.from('sessoes').delete().in('id', ids.slice(i, i + IDS_POR_PEDIDO)));
      }
    },

    async listarBloqueios() {
      const linhas = dados<LinhaBloqueio[]>(
        await cliente.from('bloqueios').select('*').order('inicio').order('fim'),
      );
      return linhas.map(linhaParaBloqueio);
    },
    async salvarBloqueio(b) {
      const linha = dados<LinhaBloqueio>(await cliente.from('bloqueios').upsert(bloqueioParaLinha(b)).select().single());
      return linhaParaBloqueio(linha);
    },
    async removerBloqueio(id) {
      dados(await cliente.from('bloqueios').delete().eq('id', id));
    },
  };
}
