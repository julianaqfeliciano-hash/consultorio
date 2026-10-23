interface EmConstrucaoProps {
  titulo?: string;
}

export function EmConstrucao({ titulo }: EmConstrucaoProps) {
  return (
    <section className="flex flex-col gap-2">
      {titulo && <h1 className="text-3xl">{titulo}</h1>}
      <p className="font-semibold">Em construção</p>
      <p>Esta parte do sistema chega nas próximas etapas.</p>
    </section>
  );
}
