import { ChevronRight, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Campo } from '../../componentes/Campo';
import { FalhaAoCarregar } from '../../componentes/FalhaAoCarregar';
import { LinkBotao } from '../../componentes/LinkBotao';
import { usePacientes } from '../../dados/usePacientes';
import { agruparPacientes } from '../../regras/pacientes';

/** Lista de pacientes em quatro grupos (avaliação, psicoterapia, lista de espera, alta), com busca pelo nome. */
export function TelaPacientes() {
  const pacientes = usePacientes();
  const [busca, setBusca] = useState('');
  const grupos = useMemo(() => agruparPacientes(pacientes.data ?? [], busca), [pacientes.data, busca]);
  const encontrados = grupos.reduce((total, g) => total + g.pacientes.length, 0);

  return (
    <section className="flex flex-col items-start gap-6">
      <div className="flex w-full max-w-xl flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Pacientes</h1>
        <LinkBotao to="/pacientes/novo">
          <Plus aria-hidden="true" className="size-5" />
          Novo paciente
        </LinkBotao>
      </div>

      <div className="w-full max-w-xl">
        <Campo rotulo="Buscar paciente" type="search" autoComplete="off" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>

      {pacientes.data === undefined && pacientes.isPending && <p role="status">Carregando…</p>}
      {pacientes.data === undefined && pacientes.isError && (
        <FalhaAoCarregar mensagem="Não foi possível carregar os pacientes." aoTentarDeNovo={() => void pacientes.refetch()} />
      )}

      {pacientes.data && pacientes.data.length === 0 && <p>Nenhum paciente cadastrado ainda.</p>}
      {pacientes.data && pacientes.data.length > 0 && encontrados === 0 && <p>Nenhum paciente encontrado.</p>}

      {pacientes.data && encontrados > 0 && (
        <div className="flex w-full max-w-xl flex-col gap-6">
          {grupos.map((grupo) => (
            <section key={grupo.id} aria-labelledby={`grupo-${grupo.id}`} className="flex flex-col gap-2">
              <h2 id={`grupo-${grupo.id}`} className="text-xl">
                {`${grupo.rotulo} (${grupo.pacientes.length})`}
              </h2>
              {grupo.pacientes.length > 0 && (
                <ul className="flex flex-col gap-2">
                  {grupo.pacientes.map((p) => (
                    <li key={p.id}>
                      <Link
                        to={`/pacientes/${p.id}`}
                        className="flex min-h-14 items-center gap-3 rounded-lg border-2 border-verde-claro bg-white px-4 py-3 hover:bg-verde-claro/50"
                      >
                        <span className="flex flex-1 flex-col">
                          <span className="font-semibold">{p.nome}</span>
                          {(p.escola || p.serie) && (
                            <span className="text-sm">{[p.escola, p.serie].filter(Boolean).join(' · ')}</span>
                          )}
                        </span>
                        <ChevronRight aria-hidden="true" className="size-5 shrink-0" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
