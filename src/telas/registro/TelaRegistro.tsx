import { ArrowLeft } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { AreaDeTexto } from '../../componentes/AreaDeTexto';
import { Aviso } from '../../componentes/Aviso';
import { Botao } from '../../componentes/Botao';
import { DialogoConfirmacao } from '../../componentes/DialogoConfirmacao';
import { FalhaAoCarregar } from '../../componentes/FalhaAoCarregar';
import { apagarRascunho, guardarRascunho, lerRascunho } from '../../dados/rascunhos';
import type { SessaoComPaciente } from '../../dados/repositorio';
import { ErroResumo, MENSAGEM_DO_RESUMO } from '../../dados/resumidor';
import { useFicha } from '../../dados/useFicha';
import { useRegistro, useResumir, useSalvarRegistro, useSessao } from '../../dados/useRegistro';
import type { CamposRegistro, RegistroSessao } from '../../dominio/tipos';
import { dataLocal, formatarData, horaLocal } from '../../regras/datas';
import { registroVazio } from '../../regras/registro';
import { BotaoDitar } from './BotaoDitar';

const ESPERA_DO_RASCUNHO_MS = 500;
const CAMPOS_VAZIOS: CamposRegistro = { comoChegou: '', trabalhado: '', observacoes: '', proximosPassos: '' };

const CAMPOS: { chave: keyof CamposRegistro; rotulo: string }[] = [
  { chave: 'comoChegou', rotulo: 'Como chegou' },
  { chave: 'trabalhado', rotulo: 'O que foi trabalhado' },
  { chave: 'observacoes', rotulo: 'Observações' },
  { chave: 'proximosPassos', rotulo: 'Próximos passos' },
];

function Voltar() {
  return (
    <Link to="/agenda" className="inline-flex min-h-11 items-center gap-2 font-semibold underline">
      <ArrowLeft aria-hidden="true" className="size-5" />
      Voltar para a agenda
    </Link>
  );
}

interface Estado {
  textoFalado: string;
  campos: CamposRegistro;
}

/** Rascunho do aparelho se houver (é o mais novo); senão o registro salvo; senão tudo vazio. */
function estadoInicial(sessaoId: string, registro: RegistroSessao | null) {
  const rascunho = lerRascunho(sessaoId);
  if (rascunho) return { estado: { textoFalado: rascunho.textoFalado, campos: rascunho.campos }, recuperado: true };
  if (registro) {
    const { textoFalado, comoChegou, trabalhado, observacoes, proximosPassos } = registro;
    return { estado: { textoFalado, campos: { comoChegou, trabalhado, observacoes, proximosPassos } }, recuperado: false };
  }
  return { estado: { textoFalado: '', campos: CAMPOS_VAZIOS }, recuperado: false };
}

function Formulario({ sessao, registro }: { sessao: SessaoComPaciente; registro: RegistroSessao | null }) {
  const sessaoId = sessao.id;
  const ficha = useFicha(sessao.pacienteId);
  const resumir = useResumir();
  const salvar = useSalvarRegistro();
  const [inicial] = useState(() => estadoInicial(sessaoId, registro));
  const [estado, setEstado] = useState<Estado>(inicial.estado);
  const [recuperado, setRecuperado] = useState(inicial.recuperado);
  const [salvo, setSalvo] = useState(false);
  const [recusaDeSalvar, setRecusaDeSalvar] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  // Guarda o rascunho 500 ms depois da última mudança; ao sair da tela, grava o que estiver pendente.
  const pendente = useRef<{ timer: ReturnType<typeof setTimeout>; estado: Estado } | null>(null);
  function descartarPendente() {
    if (pendente.current) clearTimeout(pendente.current.timer);
    pendente.current = null;
  }
  function mudar(novo: Estado) {
    setEstado(novo);
    setSalvo(false);
    setRecusaDeSalvar(false);
    descartarPendente();
    const timer = setTimeout(() => {
      pendente.current = null;
      guardarRascunho(sessaoId, novo);
    }, ESPERA_DO_RASCUNHO_MS);
    pendente.current = { timer, estado: novo };
  }
  useEffect(
    () => () => {
      if (pendente.current) {
        clearTimeout(pendente.current.timer);
        guardarRascunho(sessaoId, pendente.current.estado);
      }
    },
    [sessaoId],
  );

  // O ditado chama esta função de dentro do reconhecedor: ela lê sempre o estado mais novo.
  const estadoAtual = useRef(estado);
  useEffect(() => {
    estadoAtual.current = estado;
  });
  function acrescentar(texto: string) {
    const atual = estadoAtual.current;
    const junto = atual.textoFalado.trim() === '' ? texto : `${atual.textoFalado.replace(/\s+$/, '')} ${texto}`;
    const novo = { ...atual, textoFalado: junto };
    estadoAtual.current = novo;
    mudar(novo);
  }

  function executarResumo() {
    setConfirmando(false);
    resumir.mutate(
      {
        texto: estado.textoFalado,
        pessoas: {
          paciente: sessao.pacienteNome,
          responsaveis: (ficha.data?.responsaveis ?? []).map((r) => r.nome),
        },
      },
      { onSuccess: (campos) => mudar({ ...estadoAtual.current, campos }) },
    );
  }

  function pedirResumo() {
    if (registroVazio(estado.campos)) executarResumo();
    else setConfirmando(true);
  }

  function gravar() {
    if (estado.textoFalado.trim() === '' && registroVazio(estado.campos)) {
      setRecusaDeSalvar(true);
      return;
    }
    salvar.mutate(
      { sessaoId, pacienteId: sessao.pacienteId, textoFalado: estado.textoFalado, campos: estado.campos },
      {
        onSuccess: () => {
          descartarPendente();
          apagarRascunho(sessaoId);
          setRecuperado(false);
          setSalvo(true);
        },
      },
    );
  }

  const mensagemDoErro = resumir.isError
    ? MENSAGEM_DO_RESUMO[resumir.error instanceof ErroResumo ? resumir.error.codigo : 'falha']
    : null;

  return (
    <div className="flex w-full flex-col gap-6">
      {recuperado && <Aviso tipo="atencao">Rascunho recuperado deste aparelho.</Aviso>}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col items-start gap-3">
          <AreaDeTexto
            rotulo="O que aconteceu na sessão"
            ajuda="Você também pode usar o microfone do teclado."
            rows={12}
            className="w-full"
            value={estado.textoFalado}
            onChange={(e) => mudar({ ...estado, textoFalado: e.target.value })}
          />
          <div className="flex flex-wrap gap-3">
            <BotaoDitar aoReconhecer={acrescentar} />
            <Botao
              disabled={estado.textoFalado.trim() === '' || resumir.isPending || !ficha.data}
              onClick={pedirResumo}
            >
              {resumir.isPending ? 'Resumindo…' : 'Resumir'}
            </Botao>
          </div>
          {mensagemDoErro && (
            <>
              <Aviso tipo="erro">{mensagemDoErro}</Aviso>
              <Botao variante="secundario" disabled={resumir.isPending} onClick={executarResumo}>
                Tentar de novo
              </Botao>
            </>
          )}
        </div>
        <div className="flex flex-col gap-4">
          {CAMPOS.map(({ chave, rotulo }) => (
            <AreaDeTexto
              key={chave}
              rotulo={rotulo}
              rows={4}
              value={estado.campos[chave]}
              onChange={(e) => mudar({ ...estado, campos: { ...estado.campos, [chave]: e.target.value } })}
            />
          ))}
        </div>
      </div>
      {salvo && <Aviso tipo="sucesso">Registro salvo.</Aviso>}
      {recusaDeSalvar && <Aviso tipo="erro">Escreva o registro ou resuma o texto antes de salvar.</Aviso>}
      {salvar.isError && <Aviso tipo="erro">Não foi possível salvar o registro. Tente de novo.</Aviso>}
      <Botao disabled={salvar.isPending} onClick={gravar} className="self-start">
        {salvar.isPending ? 'Salvando…' : 'Salvar registro'}
      </Botao>
      {confirmando && (
        <DialogoConfirmacao
          titulo="Substituir o que está nos campos pelo resumo?"
          mensagem="Os quatro campos serão trocados pelo resumo do texto. O que você escreveu neles será perdido."
          rotuloConfirmar="Substituir"
          aoConfirmar={executarResumo}
          aoCancelar={() => setConfirmando(false)}
        />
      )}
    </div>
  );
}

/** Registro da sessão: o texto ditado, o resumo do Claude e os quatro campos, que ela revisa antes de salvar. */
export function TelaRegistro() {
  const { id = '' } = useParams();
  const sessao = useSessao(id);
  const registro = useRegistro(id);

  const falhou = sessao.isError || registro.isError;
  const carregando = sessao.data === undefined || registro.data === undefined;

  let corpo;
  if (falhou) {
    corpo = (
      <FalhaAoCarregar
        mensagem="Não foi possível carregar a sessão."
        aoTentarDeNovo={() => {
          void sessao.refetch();
          void registro.refetch();
        }}
      />
    );
  } else if (carregando) {
    corpo = <p role="status">Carregando…</p>;
  } else if (sessao.data === null) {
    corpo = <FalhaAoCarregar mensagem="Sessão não encontrada." aoTentarDeNovo={() => void sessao.refetch()} />;
  } else {
    const { inicio, pacienteNome } = sessao.data;
    corpo = (
      <>
        <header className="flex flex-col gap-1">
          <h1 className="text-3xl">Registro da sessão</h1>
          <p className="font-texto text-lg">
            <span className="font-semibold">{pacienteNome}</span> · {formatarData(dataLocal(inicio))} às {horaLocal(inicio)}
          </p>
        </header>
        <Formulario key={sessao.data.id} sessao={sessao.data} registro={registro.data} />
      </>
    );
  }

  return (
    <section className="flex w-full max-w-5xl flex-col items-start gap-6">
      {corpo}
      <Voltar />
    </section>
  );
}
