import type Anthropic from 'npm:@anthropic-ai/sdk@1.3.0';
import { describe, expect, it, vi } from 'vitest';
import { tratar } from './index.ts';

const CAMPOS = {
  como_chegou: 'A criança [P] chegou animada.',
  trabalhado: 'Jogo de tabuleiro.',
  observacoes: 'Boa atenção.',
  proximos_passos: 'Conversar com [R1].',
};

function resposta(extra: Record<string, unknown> = {}) {
  return {
    stop_reason: 'end_turn',
    content: [{ type: 'text', text: JSON.stringify(CAMPOS) }],
    ...extra,
  };
}

function montar(retorno: unknown = resposta()) {
  const create = vi.fn(async () => retorno);
  const cliente = { beta: { messages: { create } } } as unknown as Pick<Anthropic, 'beta'>;
  return { create, cliente };
}

function post(texto: unknown) {
  return new Request('http://x/resumir-sessao', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ texto }),
  });
}

const MODELO = 'claude-opus-5-5';

describe('resumir-sessao', () => {
  it('OPTIONS devolve 204 com CORS', async () => {
    const { cliente } = montar();
    const r = await tratar(new Request('http://x', { method: 'OPTIONS' }), { cliente, modelo: MODELO });
    expect(r.status).toBe(204);
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(r.headers.get('Access-Control-Allow-Headers')).toBe(
      'authorization, x-client-info, apikey, content-type',
    );
  });

  it('GET devolve 405', async () => {
    const { cliente } = montar();
    const r = await tratar(new Request('http://x', { method: 'GET' }), { cliente, modelo: MODELO });
    expect(r.status).toBe(405);
    expect(await r.json()).toEqual({ erro: 'metodo' });
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('texto vazio ou só espaços devolve 400 texto_vazio sem chamar o Claude', async () => {
    const { cliente, create } = montar();
    for (const t of ['', '   \n ']) {
      const r = await tratar(post(t), { cliente, modelo: MODELO });
      expect(r.status).toBe(400);
      expect(await r.json()).toEqual({ erro: 'texto_vazio' });
    }
    expect(create).not.toHaveBeenCalled();
  });

  it('texto com 20001 caracteres devolve 413', async () => {
    const { cliente, create } = montar();
    const r = await tratar(post('a'.repeat(20001)), { cliente, modelo: MODELO });
    expect(r.status).toBe(413);
    expect(await r.json()).toEqual({ erro: 'texto_longo' });
    expect(create).not.toHaveBeenCalled();
  });

  it('sem chave devolve 500 sem_chave', async () => {
    const r = await tratar(post('relato'), { cliente: null, modelo: MODELO });
    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ erro: 'sem_chave' });
  });

  it('devolve os quatro campos em camelCase', async () => {
    const { cliente } = montar();
    const r = await tratar(post('relato'), { cliente, modelo: MODELO });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({
      comoChegou: CAMPOS.como_chegou,
      trabalhado: CAMPOS.trabalhado,
      observacoes: CAMPOS.observacoes,
      proximosPassos: CAMPOS.proximos_passos,
    });
  });

  it('envia o modelo, effort medium, o schema e fallbacks default com claude-opus-5-5', async () => {
    const { cliente, create } = montar();
    await tratar(post('relato'), { cliente, modelo: MODELO });
    const arg = (create.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(arg).toMatchObject({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      messages: [{ role: 'user', content: 'relato' }],
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: {
        effort: 'medium',
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['como_chegou', 'trabalhado', 'observacoes', 'proximos_passos'],
            properties: {
              como_chegou: { type: 'string' },
              trabalhado: { type: 'string' },
              observacoes: { type: 'string' },
              proximos_passos: { type: 'string' },
            },
          },
        },
      },
    });
    expect(arg).not.toHaveProperty('thinking');
    expect(arg).not.toHaveProperty('temperature');
  });

  it('com CLAUDE_MODELO claude-haiku-5-5 não envia fallbacks', async () => {
    const { cliente, create } = montar();
    await tratar(post('relato'), { cliente, modelo: 'claude-haiku-5-5' });
    const arg = (create.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(arg.model).toBe('claude-haiku-5-5');
    expect(arg).not.toHaveProperty('fallbacks');
    expect(arg).not.toHaveProperty('betas');
  });

  it('stop_reason refusal devolve 422 recusa', async () => {
    const { cliente } = montar(resposta({ stop_reason: 'refusal', content: [] }));
    const r = await tratar(post('relato'), { cliente, modelo: MODELO });
    expect(r.status).toBe(422);
    expect(await r.json()).toEqual({ erro: 'recusa' });
  });

  it('stop_reason max_tokens devolve 502 falha_claude', async () => {
    const { cliente } = montar(resposta({ stop_reason: 'max_tokens' }));
    const r = await tratar(post('relato'), { cliente, modelo: MODELO });
    expect(r.status).toBe(502);
    expect(await r.json()).toEqual({ erro: 'falha_claude' });
  });

  it('JSON inválido devolve 502 falha_claude', async () => {
    const { cliente } = montar(resposta({ content: [{ type: 'text', text: 'não é json' }] }));
    const r = await tratar(post('relato'), { cliente, modelo: MODELO });
    expect(r.status).toBe(502);
    expect(await r.json()).toEqual({ erro: 'falha_claude' });
  });

  it('erro do SDK devolve 502 falha_claude', async () => {
    const { cliente, create } = montar();
    create.mockRejectedValueOnce(new Error('segredo do SDK'));
    const r = await tratar(post('relato'), { cliente, modelo: MODELO });
    expect(r.status).toBe(502);
    const corpo = await r.text();
    expect(JSON.parse(corpo)).toEqual({ erro: 'falha_claude' });
    expect(corpo).not.toContain('segredo');
  });
});
