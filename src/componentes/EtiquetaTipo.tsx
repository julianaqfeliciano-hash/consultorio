import { CLASSE_FUNDO_TIPO, ROTULO_TIPO, type TipoVisual } from '../dominio/rotulos';

interface EtiquetaTipoProps {
  tipo: TipoVisual;
  /** Texto no lugar do nome do tipo (ex.: "Avaliação · sessão 4 de 10"). */
  texto?: string;
}

/** Bolinha na cor do tipo (amarelo, laranja, azul-claro) mais o nome em texto. A cor sozinha nunca diz o tipo. */
export function EtiquetaTipo({ tipo, texto }: EtiquetaTipoProps) {
  return (
    <span className="inline-flex items-center gap-2 font-semibold">
      <span aria-hidden="true" className={`size-3 shrink-0 rounded-full ${CLASSE_FUNDO_TIPO[tipo]}`} />
      {texto ?? ROTULO_TIPO[tipo]}
    </span>
  );
}
