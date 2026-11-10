// Edge Function `resumir-sessao`: recebe o relato da sessão (já com os nomes
// trocados por marcadores) e devolve os quatro campos do registro, escritos
// pelo Claude. Arquivo único, para colar no editor de funções do Supabase.
// A própria função confere o login: manda o token ao Supabase Auth
// (`auth.getUser`), que só reconhece o token de quem entrou no sistema. A chave
// pública do app, um token vencido ou forjado e a falta do token dão 401. Assim
// a proteção não depende da opção "Verify JWT" do painel. Como o cadastro de
// contas é fechado, só a dona tem um login.
import Anthropic from 'npm:@anthropic-ai/sdk@1.3.0';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0';

// Tipo mínimo de `Deno`, só o que este arquivo usa.
declare const Deno: {
  env: { get(nome: string): string | undefined };
  serve(tratador: (req: Request) => Response | Promise<Response>): unknown;
};

type Codigo =
  | 'texto_vazio'
  | 'texto_longo'
  | 'sem_chave'
  | 'recusa'
  | 'falha_claude'
  | 'metodo'
  | 'nao_autorizado';

const STATUS: Record<Codigo, number> = {
  texto_vazio: 400,
  texto_longo: 413,
  sem_chave: 500,
  recusa: 422,
  falha_claude: 502,
  metodo: 405,
  nao_autorizado: 401,
};

const LIMITE_TEXTO = 20000;
const MODELO_PADRAO = 'claude-opus-5-5';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PROMPT = `Você organiza o registro de uma sessão de psicologia infantojuvenil, a partir do relato ditado pela psicóloga depois da sessão.
Os nomes foram trocados por marcadores: [P] é a criança ou o adolescente atendido, [R1], [R2]… são os responsáveis e [F] quer dizer a família: escreva "a [F]" (por exemplo, "a [F] trouxe…"). Use os marcadores exatamente como estão.
Escreva em português do Brasil, em terceira pessoa, com frases curtas e linguagem técnica e respeitosa.
Use somente o que está no relato. Não invente, não deduza diagnósticos e não acrescente interpretações que a psicóloga não fez. Se o relato não falar de um dos campos, deixe esse campo vazio.
Campos:
- como_chegou: como a criança chegou à sessão (humor, disposição, o que trouxe, quem acompanhou).
- trabalhado: o que foi trabalhado na sessão (atividades, temas, técnicas, recursos).
- observacoes: observações clínicas relevantes que a psicóloga relatou.
- proximos_passos: o que fica para as próximas sessões ou para combinar com a família ou a escola.`;

const SCHEMA = {
  type: 'object',
  properties: {
    como_chegou: { type: 'string' },
    trabalhado: { type: 'string' },
    observacoes: { type: 'string' },
    proximos_passos: { type: 'string' },
  },
  required: ['como_chegou', 'trabalhado', 'observacoes', 'proximos_passos'],
  additionalProperties: false,
};

function json(corpo: unknown, status: number): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function erro(codigo: Codigo): Response {
  return json({ erro: codigo }, STATUS[codigo]);
}

/** Diz se o token é de alguém com login no projeto. */
export type VerificarUsuario = (token: string) => Promise<boolean>;

/** A verificação pelo Supabase Auth: vale só o token que o `getUser` aceita e que traz um usuário. */
export function verificarComGetUser(auth: Pick<SupabaseClient['auth'], 'getUser'>): VerificarUsuario {
  return async (token) => {
    const { data, error } = await auth.getUser(token);
    return !error && data.user !== null;
  };
}

function tokenDoPedido(req: Request): string | null {
  const m = /^Bearer\s+(\S+)$/i.exec(req.headers.get('Authorization') ?? '');
  return m ? m[1] : null;
}

/** Cliente do Claude: 1 nova tentativa e 120 s de espera, para caber no limite de tempo da função. */
export function criarClienteClaude(apiKey: string): Anthropic {
  return new Anthropic({ apiKey, maxRetries: 1, timeout: 120_000 });
}

export async function tratar(
  req: Request,
  deps: { cliente: Pick<Anthropic, 'beta'> | null; modelo: string; verificarUsuario: VerificarUsuario },
): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return erro('metodo');

  const token = tokenDoPedido(req);
  if (!token) return erro('nao_autorizado');
  let logada = false;
  try {
    logada = await deps.verificarUsuario(token);
  } catch {
    // Sem resposta do Auth não há como saber quem é: não passa.
  }
  if (!logada) return erro('nao_autorizado');

  let texto = '';
  try {
    const corpo: unknown = await req.json();
    const valor = (corpo as { texto?: unknown } | null)?.texto;
    if (typeof valor === 'string') texto = valor;
  } catch {
    // corpo ilegível: tratado como texto vazio
  }
  if (texto.trim() === '') return erro('texto_vazio');
  if (texto.length > LIMITE_TEXTO) return erro('texto_longo');
  if (!deps.cliente) return erro('sem_chave');

  const fallbacks =
    deps.modelo === MODELO_PADRAO
      ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }
      : {};

  try {
    const resposta = await deps.cliente.beta.messages.create({
      model: deps.modelo,
      max_tokens: 16000,
      system: PROMPT,
      messages: [{ role: 'user', content: texto }],
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
      ...fallbacks,
    });

    if (resposta.stop_reason === 'refusal') return erro('recusa');
    if (resposta.stop_reason === 'max_tokens') {
      console.error('resumir-sessao: max_tokens');
      return erro('falha_claude');
    }

    const bloco = resposta.content.find((b) => b.type === 'text');
    if (!bloco || bloco.type !== 'text') return erro('falha_claude');
    const dados = JSON.parse(bloco.text) as Record<string, unknown>;
    const { como_chegou, trabalhado, observacoes, proximos_passos } = dados;
    if (
      typeof como_chegou !== 'string' ||
      typeof trabalhado !== 'string' ||
      typeof observacoes !== 'string' ||
      typeof proximos_passos !== 'string'
    ) {
      return erro('falha_claude');
    }
    return json(
      { comoChegou: como_chegou, trabalhado, observacoes, proximosPassos: proximos_passos },
      200,
    );
  } catch (e) {
    // Só a classe do erro e o status vão para o log; nunca o texto.
    const status = (e as { status?: unknown } | null)?.status;
    console.error('resumir-sessao:', e instanceof Error ? e.constructor.name : typeof e, status ?? '');
    // Erro do SDK, de conexão ou JSON inválido. Nada do SDK vai para a resposta
    // e o texto da sessão nunca é registrado em log.
    return erro('falha_claude');
  }
}

if (typeof Deno !== 'undefined') {
  const chave = Deno.env.get('ANTHROPIC_API_KEY');
  const modelo = Deno.env.get('CLAUDE_MODELO') || MODELO_PADRAO;
  const cliente = chave ? criarClienteClaude(chave) : null;
  // O Supabase põe sozinho estas duas variáveis em toda Edge Function.
  const url = Deno.env.get('SUPABASE_URL');
  const chaveAnon = Deno.env.get('SUPABASE_ANON_KEY');
  const verificarUsuario: VerificarUsuario =
    url && chaveAnon
      ? verificarComGetUser(
          createClient(url, chaveAnon, { auth: { persistSession: false, autoRefreshToken: false } }).auth,
        )
      : async () => false;
  Deno.serve((req) => tratar(req, { cliente, modelo, verificarUsuario }));
}
