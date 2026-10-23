import { render } from '@testing-library/react';
import type { ComponentType, ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { RotasApp } from '../App';

export interface OpcoesRenderComRotas {
  /**
   * Provedores extras para envolver as rotas (repositório, autenticação,
   * QueryClient…). As próximas telas acrescentam aqui o que precisarem.
   */
  provedores?: ComponentType<{ children: ReactNode }>;
}

/** Monta as rotas do aplicativo num `MemoryRouter` começando em `caminho`. */
export function renderComRotas(caminho: string, opcoes: OpcoesRenderComRotas = {}) {
  const { provedores: Provedores } = opcoes;
  const rotas = (
    <MemoryRouter initialEntries={[caminho]}>
      <RotasApp />
    </MemoryRouter>
  );
  return render(Provedores ? <Provedores>{rotas}</Provedores> : rotas);
}
