import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BotaoDitar } from './BotaoDitar';

class ReconhecimentoFalso {
  static ultimo: ReconhecimentoFalso | null = null;
  lang = '';
  continuous = false;
  interimResults = false;
  onresult: ((e: unknown) => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn(() => this.onend?.());
  constructor() {
    ReconhecimentoFalso.ultimo = this;
  }
}

/** Um evento de resultado: cada item é [texto, final?]. */
function evento(itens: [string, boolean][], resultIndex = 0) {
  return {
    resultIndex,
    results: itens.map(([transcript, isFinal]) => Object.assign([{ transcript }], { isFinal })),
  };
}

afterEach(() => {
  delete (window as { SpeechRecognition?: unknown }).SpeechRecognition;
  delete (window as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
  ReconhecimentoFalso.ultimo = null;
});

describe('BotaoDitar', () => {
  it('sem SpeechRecognition não aparece', () => {
    const { container } = render(<BotaoDitar aoReconhecer={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('com o falso, Ditar começa em pt-BR e acrescenta só resultados finais', async () => {
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition = ReconhecimentoFalso;
    const aoReconhecer = vi.fn();
    render(<BotaoDitar aoReconhecer={aoReconhecer} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Ditar' }));

    const r = ReconhecimentoFalso.ultimo!;
    expect(r.lang).toBe('pt-BR');
    expect(r.continuous).toBe(true);
    expect(r.start).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Parar de ditar' })).toBeInTheDocument();

    act(() => r.onresult?.(evento([['olá tudo', false]])));
    expect(aoReconhecer).not.toHaveBeenCalled();
    act(() => r.onresult?.(evento([['olá tudo bem', true], ['ele brincou', false]])));
    expect(aoReconhecer).toHaveBeenCalledTimes(1);
    expect(aoReconhecer).toHaveBeenCalledWith('olá tudo bem');
  });

  it('Parar de ditar encerra', async () => {
    (window as unknown as Record<string, unknown>).SpeechRecognition = ReconhecimentoFalso;
    render(<BotaoDitar aoReconhecer={vi.fn()} />);
    const usuaria = userEvent.setup();
    await usuaria.click(screen.getByRole('button', { name: 'Ditar' }));
    await usuaria.click(screen.getByRole('button', { name: 'Parar de ditar' }));
    expect(ReconhecimentoFalso.ultimo!.stop).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Ditar' })).toBeInTheDocument();
  });
});
