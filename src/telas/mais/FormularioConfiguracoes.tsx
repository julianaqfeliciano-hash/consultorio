import { CircleAlert, CircleCheck } from 'lucide-react';
import { useState, type FormEvent, type InputHTMLAttributes } from 'react';
import { AreaDeTexto } from '../../componentes/AreaDeTexto';
import { Botao } from '../../componentes/Botao';
import { Campo } from '../../componentes/Campo';
import { useSalvarConfiguracoes } from '../../dados/useConfiguracoes';
import type { Configuracoes } from '../../dominio/tipos';
import { DURACAO_MAXIMA_MIN, SESSOES_PREVISTAS_MAXIMAS } from '../../regras/formularios';

type ChaveTexto =
  | 'nomeCompleto'
  | 'nomeExibicao'
  | 'titulo'
  | 'crp'
  | 'cpf'
  | 'telefone'
  | 'email'
  | 'endereco'
  | 'cidade'
  | 'instagram';
type ChaveNumero = 'duracaoPadraoMin' | 'sessoesAvaliacaoPadrao' | 'semanasGeradas';
type Valores = Record<ChaveTexto | ChaveNumero | 'mensagemWhatsapp', string>;
type Avisos = Partial<Record<keyof Valores, string>>;

/** Mais que isso enche a agenda de sessões que ninguém vai olhar (e o banco devolve no máximo 1000 linhas por consulta). */
const SEMANAS_GERADAS_MAXIMAS = 12;

/** Campos que não podem ficar em branco: o nome vai nos documentos e a mensagem é o lembrete do WhatsApp. */
const OBRIGATORIOS = ['nomeCompleto', 'mensagemWhatsapp'] as const;

const SEUS_DADOS: { chave: ChaveTexto; rotulo: string; entrada?: InputHTMLAttributes<HTMLInputElement> }[] = [
  { chave: 'nomeCompleto', rotulo: 'Nome completo' },
  { chave: 'nomeExibicao', rotulo: 'Nome de exibição' },
  { chave: 'titulo', rotulo: 'Título' },
  { chave: 'crp', rotulo: 'CRP' },
  { chave: 'cpf', rotulo: 'CPF', entrada: { inputMode: 'numeric' } },
  { chave: 'telefone', rotulo: 'Telefone', entrada: { type: 'tel', inputMode: 'tel' } },
  { chave: 'email', rotulo: 'E-mail', entrada: { type: 'email', inputMode: 'email', autoCapitalize: 'none', spellCheck: false } },
  { chave: 'endereco', rotulo: 'Endereço' },
  { chave: 'cidade', rotulo: 'Cidade' },
  { chave: 'instagram', rotulo: 'Instagram', entrada: { autoCapitalize: 'none', spellCheck: false } },
];

const NUMEROS: { chave: ChaveNumero; rotulo: string; ajuda: string; maximo: number }[] = [
  { chave: 'duracaoPadraoMin', rotulo: 'Duração padrão da sessão', ajuda: 'Em minutos.', maximo: DURACAO_MAXIMA_MIN },
  {
    chave: 'sessoesAvaliacaoPadrao',
    rotulo: 'Sessões da avaliação',
    ajuda: 'Quantas sessões uma avaliação nova prevê.',
    maximo: SESSOES_PREVISTAS_MAXIMAS,
  },
  {
    chave: 'semanasGeradas',
    rotulo: 'Semanas geradas',
    ajuda: 'Quantas semanas à frente a agenda é preenchida com os horários fixos.',
    maximo: SEMANAS_GERADAS_MAXIMAS,
  },
];

const CAMPOS_DA_MENSAGEM = ['{responsável}', '{paciente}', '{dia}', '{hora}'];

function paraValores(c: Configuracoes): Valores {
  return {
    nomeCompleto: c.nomeCompleto,
    nomeExibicao: c.nomeExibicao,
    titulo: c.titulo,
    crp: c.crp,
    cpf: c.cpf,
    telefone: c.telefone,
    email: c.email,
    endereco: c.endereco,
    cidade: c.cidade,
    instagram: c.instagram,
    mensagemWhatsapp: c.mensagemWhatsapp,
    duracaoPadraoMin: String(c.duracaoPadraoMin),
    sessoesAvaliacaoPadrao: String(c.sessoesAvaliacaoPadrao),
    semanasGeradas: String(c.semanasGeradas),
  };
}

function avisoDoNumero(texto: string, maximo: number): string | undefined {
  const numero = Number(texto);
  if (texto.trim() === '' || !(numero > 0)) return 'Informe um número maior que zero.';
  if (!Number.isInteger(numero)) return 'Informe um número inteiro.';
  if (numero > maximo) return `Use um número de 1 a ${maximo}.`;
  return undefined;
}

interface Props {
  /** As configurações gravadas: o formulário começa nelas e guarda por cima delas o que a tela não mostra. */
  config: Configuracoes;
}

/**
 * Os campos de "Seus dados" e "Agenda". Só grava com os números inteiros dentro dos limites
 * e com o nome completo e a mensagem do WhatsApp preenchidos.
 */
export function FormularioConfiguracoes({ config }: Props) {
  const [valores, setValores] = useState<Valores>(() => paraValores(config));
  const [avisos, setAvisos] = useState<Avisos>({});
  const salvar = useSalvarConfiguracoes();

  function alterar(chave: keyof Valores, valor: string) {
    setValores((anteriores) => ({ ...anteriores, [chave]: valor }));
    // O "salvas" (ou o erro) era sobre o que ela tinha antes de mexer.
    if (!salvar.isIdle) salvar.reset();
  }

  function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const novosAvisos: Avisos = {};
    for (const chave of OBRIGATORIOS) {
      if (valores[chave].trim() === '') novosAvisos[chave] = 'Preencha este campo.';
    }
    for (const { chave, maximo } of NUMEROS) {
      const aviso = avisoDoNumero(valores[chave], maximo);
      if (aviso) novosAvisos[chave] = aviso;
    }
    setAvisos(novosAvisos);
    if (Object.keys(novosAvisos).length > 0) return;

    salvar.mutate({
      ...config,
      nomeCompleto: valores.nomeCompleto.trim(),
      nomeExibicao: valores.nomeExibicao.trim(),
      titulo: valores.titulo.trim(),
      crp: valores.crp.trim(),
      cpf: valores.cpf.trim(),
      telefone: valores.telefone.trim(),
      email: valores.email.trim(),
      endereco: valores.endereco.trim(),
      cidade: valores.cidade.trim(),
      instagram: valores.instagram.trim(),
      mensagemWhatsapp: valores.mensagemWhatsapp.trim(),
      duracaoPadraoMin: Number(valores.duracaoPadraoMin),
      sessoesAvaliacaoPadrao: Number(valores.sessoesAvaliacaoPadrao),
      semanasGeradas: Number(valores.semanasGeradas),
    });
  }

  return (
    <form noValidate onSubmit={aoEnviar} className="flex w-full max-w-xl flex-col gap-6">
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 font-titulo text-2xl">Seus dados</legend>
        {SEUS_DADOS.map(({ chave, rotulo, entrada }) => (
          <Campo
            key={chave}
            rotulo={rotulo}
            value={valores[chave]}
            onChange={(e) => alterar(chave, e.target.value)}
            erro={avisos[chave]}
            {...entrada}
          />
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 font-titulo text-2xl">Agenda</legend>
        {NUMEROS.map(({ chave, rotulo, ajuda, maximo }) => (
          <Campo
            key={chave}
            rotulo={rotulo}
            ajuda={ajuda}
            type="number"
            inputMode="numeric"
            min={1}
            max={maximo}
            step={1}
            value={valores[chave]}
            onChange={(e) => alterar(chave, e.target.value)}
            erro={avisos[chave]}
          />
        ))}
        <AreaDeTexto
          rotulo="Mensagem do WhatsApp"
          rows={6}
          ajuda={
            <>
              Campos disponíveis:{' '}
              {CAMPOS_DA_MENSAGEM.map((campo, i) => (
                <span key={campo}>
                  {i > 0 && (i === CAMPOS_DA_MENSAGEM.length - 1 ? ' e ' : ', ')}
                  <code>{campo}</code>
                </span>
              ))}
              . Cada um é trocado pelo dado da sessão na hora do envio.
            </>
          }
          value={valores.mensagemWhatsapp}
          onChange={(e) => alterar('mensagemWhatsapp', e.target.value)}
          erro={avisos.mensagemWhatsapp}
        />
      </fieldset>

      <div className="flex flex-col items-start gap-3">
        <Botao type="submit" disabled={salvar.isPending}>
          {salvar.isPending ? 'Salvando…' : 'Salvar'}
        </Botao>
        {salvar.isSuccess && (
          <p role="status" className="flex items-center gap-2 font-semibold">
            <CircleCheck aria-hidden="true" className="size-5 shrink-0" />
            Configurações salvas.
          </p>
        )}
        {salvar.isError && (
          <p role="alert" className="flex items-start gap-2 rounded-lg bg-amarelo/30 p-3 font-semibold">
            <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
            Não foi possível salvar. Tente de novo.
          </p>
        )}
      </div>
    </form>
  );
}
