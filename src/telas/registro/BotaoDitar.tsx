import { Mic, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Botao } from '../../componentes/Botao';

/** O mínimo da API de reconhecimento de voz do navegador que usamos (o lib.dom do TypeScript não a traz). */
interface Reconhecimento {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((evento: EventoDeReconhecimento) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}

interface EventoDeReconhecimento {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}

type ConstrutorDeReconhecimento = new () => Reconhecimento;

function construtor(): ConstrutorDeReconhecimento | undefined {
  const w = window as unknown as {
    SpeechRecognition?: ConstrutorDeReconhecimento;
    webkitSpeechRecognition?: ConstrutorDeReconhecimento;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

interface BotaoDitarProps {
  /** Recebe cada trecho final reconhecido (os provisórios são ignorados). */
  aoReconhecer: (texto: string) => void;
}

/** Liga e desliga o ditado por voz. Não aparece onde o navegador não sabe reconhecer voz. */
export function BotaoDitar({ aoReconhecer }: BotaoDitarProps) {
  const [ditando, setDitando] = useState(false);
  const reconhecimento = useRef<Reconhecimento | null>(null);
  const aoReconhecerAtual = useRef(aoReconhecer);
  useEffect(() => {
    aoReconhecerAtual.current = aoReconhecer;
  });
  useEffect(() => () => reconhecimento.current?.stop(), []);

  const Reconhecedor = construtor();
  if (!Reconhecedor) return null;

  function comecar() {
    if (!Reconhecedor) return;
    const r = new Reconhecedor();
    r.lang = 'pt-BR';
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (evento) => {
      for (let i = evento.resultIndex; i < evento.results.length; i++) {
        const resultado = evento.results[i]!;
        if (resultado.isFinal) {
          const texto = (resultado[0]?.transcript ?? '').trim();
          if (texto !== '') aoReconhecerAtual.current(texto);
        }
      }
    };
    r.onend = () => setDitando(false);
    r.onerror = () => setDitando(false);
    reconhecimento.current = r;
    r.start();
    setDitando(true);
  }

  function parar() {
    reconhecimento.current?.stop();
    setDitando(false);
  }

  return (
    <Botao variante="secundario" onClick={ditando ? parar : comecar}>
      {ditando ? <Square aria-hidden="true" className="size-5" /> : <Mic aria-hidden="true" className="size-5" />}
      {ditando ? 'Parar de ditar' : 'Ditar'}
    </Botao>
  );
}
