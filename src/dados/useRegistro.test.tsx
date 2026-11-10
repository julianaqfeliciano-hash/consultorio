import { useQueryClient } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { CamposRegistro } from '../dominio/tipos';
import { Provedores } from '../Provedores';
import { sessaoExemplo } from '../testes/fabricas';
import { resumidorFalso } from '../testes/resumidorFalso';
import { criarRepositorioMemoria } from './memoria';
import type { Repositorio } from './repositorio';
import type { Resumidor } from './resumidor';
import { useRegistro, useResumir, useSalvarRegistro, useSessao, useSessoesComRegistro } from './useRegistro';

const CAMPOS: CamposRegistro = { comoChegou: 'a', trabalhado: 'b', observacoes: 'c', proximosPassos: 'd' };

function montar<T>(hook: () => T, opcoes: { repositorio?: Repositorio; resumidor?: Resumidor } = {}) {
  const repositorio = opcoes.repositorio ?? criarRepositorioMemoria();
  const Envoltorio = ({ children }: { children: ReactNode }) => (
    <Provedores repositorio={repositorio} resumidor={opcoes.resumidor ?? resumidorFalso()} semNovasTentativas>
      {children}
    </Provedores>
  );
  return { repositorio, ...renderHook(hook, { wrapper: Envoltorio }) };
}

describe('useResumir', () => {
  const pessoas = { paciente: 'Ana Souza', responsaveis: ['Marcos Souza'] };

  it('nunca envia o nome ao resumidor', async () => {
    const resumir = vi.fn(async () => CAMPOS);
    const { result } = montar(() => useResumir(), { resumidor: { resumir } });
    await result.current.mutateAsync({ texto: 'Ana chegou com o Marcos, pai da Ana Souza.', pessoas });
    expect(resumir).toHaveBeenCalledTimes(1);
    const enviado = (resumir.mock.calls[0] as unknown as [string])[0];
    expect(enviado).not.toContain('Ana');
    expect(enviado).not.toContain('Marcos');
    expect(enviado).toContain('[P]');
    expect(enviado).toContain('[R1]');
  });

  it('os nomes voltam no resultado, como foram escritos', async () => {
    const resumidor: Resumidor = {
      resumir: async () => ({ ...CAMPOS, comoChegou: '[P] chegou com [R1].', trabalhado: '[R9] fica como está' }),
    };
    const { result } = montar(() => useResumir(), { resumidor });
    const campos = await result.current.mutateAsync({ texto: 'Ana chegou com Marcos.', pessoas });
    expect(campos.comoChegou).toBe('Ana chegou com Marcos.');
    expect(campos.trabalhado).toBe('[R9] fica como está');
  });
});

describe('registro', () => {
  it('useSessao, useRegistro e useSessoesComRegistro leem do repositório', async () => {
    const repositorio = criarRepositorioMemoria();
    const sessao = sessaoExemplo({ id: 's-1', pacienteId: 'p-1' });
    vi.spyOn(repositorio, 'obterSessao').mockResolvedValue({ ...sessao, pacienteNome: 'Ana', responsavelPrincipal: null });
    vi.spyOn(repositorio, 'obterRegistro').mockResolvedValue({ ...CAMPOS, sessaoId: 's-1', textoFalado: 't', atualizadoEm: 'x' });
    vi.spyOn(repositorio, 'listarSessoesComRegistro').mockResolvedValue(['s-1']);
    const { result } = montar(
      () => ({ s: useSessao('s-1'), r: useRegistro('s-1'), l: useSessoesComRegistro('p-1') }),
      { repositorio },
    );
    await waitFor(() => expect(result.current.s.data?.pacienteNome).toBe('Ana'));
    await waitFor(() => expect(result.current.r.data?.textoFalado).toBe('t'));
    await waitFor(() => expect(result.current.l.data).toEqual(['s-1']));
  });

  it('useSalvarRegistro grava e invalida registro e sessoesComRegistro em onSettled, mesmo se falhar', async () => {
    const repositorio = criarRepositorioMemoria();
    const salvar = vi.spyOn(repositorio, 'salvarRegistro');
    const { result } = montar(() => ({ c: useQueryClient(), m: useSalvarRegistro() }), { repositorio });
    const invalidar = vi.spyOn(result.current.c, 'invalidateQueries');
    const chaves = () => invalidar.mock.calls.map(([f]) => f?.queryKey);

    salvar.mockResolvedValueOnce({ ...CAMPOS, sessaoId: 's-1', textoFalado: 't', atualizadoEm: 'x' });
    await result.current.m.mutateAsync({ sessaoId: 's-1', pacienteId: 'p-1', textoFalado: 't', campos: CAMPOS });
    expect(salvar).toHaveBeenCalledWith('s-1', { ...CAMPOS, textoFalado: 't' });
    await waitFor(() => expect(chaves()).toEqual(expect.arrayContaining([['registro', 's-1'], ['sessoesComRegistro', 'p-1']])));

    invalidar.mockClear();
    salvar.mockRejectedValueOnce(new Error('falhou'));
    await expect(
      result.current.m.mutateAsync({ sessaoId: 's-1', pacienteId: 'p-1', textoFalado: 't', campos: CAMPOS }),
    ).rejects.toThrow('falhou');
    await waitFor(() => expect(chaves()).toEqual(expect.arrayContaining([['registro', 's-1'], ['sessoesComRegistro', 'p-1']])));
  });
});
