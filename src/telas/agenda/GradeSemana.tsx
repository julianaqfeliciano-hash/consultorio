import type { ReactNode } from 'react';
import type { SessaoComPaciente } from '../../dados/repositorio';
import { ROTULO_DIA_SEMANA } from '../../dominio/rotulos';
import type { DataISO } from '../../dominio/tipos';
import { dataLocal, diaDaSemana, diaPorExtenso, hojeISO, somarDias } from '../../regras/datas';
import { CartaoSessao } from './CartaoSessao';

interface GradeSemanaProps {
  /** A segunda-feira da semana mostrada. */
  inicioSemana: DataISO;
  /** As sessões da semana; `undefined` enquanto não chegaram. */
  sessoes: SessaoComPaciente[] | undefined;
  /** No celular, o dia que está na tela. */
  diaSelecionado: DataISO;
  /** 1024 px ou mais: uma coluna por dia em vez de um dia por vez. */
  telaLarga: boolean;
  /** O que mostrar no lugar dos dias enquanto `sessoes` não chega (carregando ou falha). */
  semDados: ReactNode;
  aoEscolherDia: (dia: DataISO) => void;
  aoAbrirSessao: (sessao: SessaoComPaciente, gatilho: HTMLElement) => void;
}

/** 'Ter', 'Qua'… a partir do nome do dia. */
const abreviacao = (d: DataISO) => ROTULO_DIA_SEMANA[diaDaSemana(d)].slice(0, 3);
const numeroDoDia = (d: DataISO) => d.slice(8);

interface SeletorDeDiaProps {
  dias: DataISO[];
  selecionado: DataISO;
  hoje: DataISO;
  aoEscolher: (dia: DataISO) => void;
}

/** Seg 02, Ter 03…: um botão por dia, para escolher qual aparece no celular. */
function SeletorDeDia({ dias, selecionado, hoje, aoEscolher }: SeletorDeDiaProps) {
  return (
    <div role="group" aria-label="Dias da semana" className="flex gap-1">
      {dias.map((d) => (
        <button
          key={d}
          type="button"
          aria-pressed={d === selecionado}
          aria-current={d === hoje ? 'date' : undefined}
          onClick={() => aoEscolher(d)}
          className={[
            'flex min-h-14 min-w-11 flex-1 flex-col items-center justify-center rounded-lg border-2 border-petroleo leading-tight font-semibold',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleo',
            d === selecionado ? 'bg-petroleo text-creme' : 'bg-white text-petroleo',
          ].join(' ')}
        >
          <span>{abreviacao(d)}</span>{' '}
          <span className={d === hoje ? 'underline decoration-2 underline-offset-4' : ''}>{numeroDoDia(d)}</span>
        </button>
      ))}
    </div>
  );
}

interface ColunaDiaProps {
  dia: DataISO;
  sessoes: SessaoComPaciente[];
  hoje: DataISO;
  aoAbrirSessao: GradeSemanaProps['aoAbrirSessao'];
}

/** Um dia: o nome (com "Hoje" quando for) e os cartões das sessões em ordem de hora. */
function ColunaDia({ dia, sessoes, hoje, aoAbrirSessao }: ColunaDiaProps) {
  const idTitulo = `dia-${dia}`;
  return (
    <section aria-labelledby={idTitulo} className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-2">
        {/* Data em Nunito Sans: na Prata o "1" parece um "l" (11/11 vira "ll/ll"). */}
        <h2 id={idTitulo} className="font-texto text-lg font-semibold first-letter:uppercase lg:text-base">
          {diaPorExtenso(dia)}
        </h2>
        {dia === hoje && <span className="rounded-full bg-amarelo px-2 text-sm font-semibold">Hoje</span>}
      </div>
      {sessoes.length === 0 ? (
        <p className="text-sm">Sem sessões.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sessoes.map((s) => (
            <li key={s.id}>
              <CartaoSessao sessao={s} aoAbrir={aoAbrirSessao} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Os dias da semana (segunda a domingo). Abaixo de 1024 px (celular e iPad na vertical): o seletor Seg…Sáb e um
 * dia por vez; a partir de 1024 px: uma coluna por dia, todas visíveis (as colunas encolhem, sem rolagem lateral).
 * O domingo só entra quando tem sessão (no seletor, também quando é hoje ou o dia escolhido).
 */
export function GradeSemana({
  inicioSemana,
  sessoes,
  diaSelecionado,
  telaLarga,
  semDados,
  aoEscolherDia,
  aoAbrirSessao,
}: GradeSemanaProps) {
  const hoje = hojeISO();
  const semana = Array.from({ length: 7 }, (_, i) => somarDias(inicioSemana, i));
  const domingo = semana[6];

  const porDia = new Map<DataISO, SessaoComPaciente[]>();
  for (const s of sessoes ?? []) {
    const dia = dataLocal(s.inicio);
    porDia.set(dia, [...(porDia.get(dia) ?? []), s]);
  }

  const mostraDomingo = porDia.has(domingo) || (!telaLarga && (domingo === hoje || domingo === diaSelecionado));
  const dias = mostraDomingo ? semana : semana.slice(0, 6);
  const coluna = (d: DataISO) => (
    <ColunaDia key={d} dia={d} sessoes={porDia.get(d) ?? []} hoje={hoje} aoAbrirSessao={aoAbrirSessao} />
  );

  if (!telaLarga) {
    return (
      <div className="flex flex-col gap-4">
        <SeletorDeDia dias={dias} selecionado={diaSelecionado} hoje={hoje} aoEscolher={aoEscolherDia} />
        {sessoes === undefined ? semDados : coluna(diaSelecionado)}
      </div>
    );
  }
  if (sessoes === undefined) return semDados;
  // grid-cols-N = repeat(N, minmax(0, 1fr)): colunas iguais que encolhem até caber. Classes escritas por inteiro (Tailwind).
  return <div className={`grid gap-1.5 ${dias.length === 7 ? 'grid-cols-7' : 'grid-cols-6'}`}>{dias.map(coluna)}</div>;
}
