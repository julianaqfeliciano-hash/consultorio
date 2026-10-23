import { render } from '@testing-library/react';
import type { ComponentType, ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { RotasApp } from '../App';
import { criarAutenticacaoDemo, type Autenticacao } from '../dados/autenticacao';
import { criarRepositorioMemoria } from '../dados/memoria';
import type { Repositorio } from '../dados/repositorio';
import { Provedores } from '../Provedores';

export interface OpcoesRenderComRotas {
  /**
   * Repositório da tela sob teste. Sem este, cada render ganha um repositório
   * em memória vazio e novo.
   */
  repositorio?: Repositorio;
  /**
   * Autenticação do teste. Sem esta, a usuária já está logada (`criarAutenticacaoDemo()`),
   * então as telas internas aparecem sem passar pelo login. Os testes de login passam uma falsa.
   */
  autenticacao?: Autenticacao;
  /** Liga a faixa amarela de demonstração (e esconde o "Sair"). Padrão: desligado. */
  modoDemonstracao?: boolean;
  /**
   * Provedores extras para envolver as rotas. Ficam DENTRO dos provedores padrão,
   * então podem sobrescrevê-los (ex.: outro repositório).
   */
  provedores?: ComponentType<{ children: ReactNode }>;
}

/**
 * Monta as rotas do aplicativo num `MemoryRouter` começando em `caminho`, com os
 * mesmos provedores do app (consultas, repositório e autenticação). Devolve o resultado do
 * `render` e o `repositorio` usado, para o teste conferir o que foi gravado.
 */
export function renderComRotas(caminho: string, opcoes: OpcoesRenderComRotas = {}) {
  const {
    provedores: Extras,
    repositorio = criarRepositorioMemoria(),
    autenticacao = criarAutenticacaoDemo(),
    modoDemonstracao = false,
  } = opcoes;
  const rotas = (
    <MemoryRouter initialEntries={[caminho]}>
      <RotasApp />
    </MemoryRouter>
  );
  const resultado = render(
    <Provedores
      repositorio={repositorio}
      autenticacao={autenticacao}
      modoDemonstracao={modoDemonstracao}
      semNovasTentativas
    >
      {Extras ? <Extras>{rotas}</Extras> : rotas}
    </Provedores>,
  );
  return { ...resultado, repositorio };
}
