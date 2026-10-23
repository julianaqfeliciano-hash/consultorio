interface LogoProps {
  variante: 'completa' | 'simbolo';
}

/** A imagem leva `alt=""` porque o nome já aparece em texto ao lado dela. */
export function Logo({ variante }: LogoProps) {
  const imagem = (
    <img src="/marca/logo.svg" alt="" height={40} className="h-10 w-auto shrink-0" />
  );

  if (variante === 'simbolo') return imagem;

  return (
    <div className="flex items-center gap-3">
      {imagem}
      <div className="flex flex-col leading-tight">
        <span className="font-titulo text-xl">Juliana Feliciano</span>
        <span className="font-texto text-[0.6875rem] tracking-[0.25em]">PSICÓLOGA INFANTIL</span>
      </div>
    </div>
  );
}
