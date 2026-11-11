import { useEffect, useRef, useState } from 'react';
import { ScanLine, Search, X } from 'lucide-react';
import { isValidIsbn, lookupIsbn, normalizeIsbn, type IsbnBook } from '@/livrei/lib/isbn';

interface Props {
  onFound: (book: IsbnBook) => void;
  /** ISBN not found in Google Books nor Open Library: continue manually. */
  onNotFound: (isbn: string) => void;
  onCancel: () => void;
}

type Detector = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> };

/** Reads the barcode with the camera (when the phone supports it) or by typing the ISBN. */
export function IsbnScanner({ onFound, onNotFound, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [typed, setTyped] = useState('');
  const [status, setStatus] = useState<'idle' | 'searching'>('idle');
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const search = async (raw: string) => {
    if (busy.current) return;
    const isbn = normalizeIsbn(raw);
    if (!isValidIsbn(isbn)) { setError('ISBN inválido. Confira os 10 ou 13 números.'); return; }
    busy.current = true;
    setError(null);
    setStatus('searching');
    const book = await lookupIsbn(isbn);
    busy.current = false;
    setStatus('idle');
    if (book) onFound(book);
    else onNotFound(isbn);
  };

  useEffect(() => {
    const BD = (globalThis as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
    if (!BD || !navigator.mediaDevices?.getUserMedia) return;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    let stopped = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (stopped || !videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraOn(true);
        const detector = new BD({ formats: ['ean_13', 'isbn_13', 'isbn_10'].filter(Boolean) });
        timer = setInterval(async () => {
          if (!videoRef.current || busy.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const hit = codes.map((c) => normalizeIsbn(c.rawValue)).find((c) => isValidIsbn(c) && /^97[89]/.test(c));
            if (hit) void search(hit);
          } catch {
            // keep scanning
          }
        }, 400);
      } catch {
        setCameraOn(false);
      }
    })();
    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-full flex-col items-center justify-center p-6 text-center">
      <button onClick={onCancel} className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-purple-800 text-purple-200 active:scale-90" aria-label="Cancelar">
        <X className="h-4 w-4" />
      </button>
      <div className="relative mb-5 flex h-40 w-56 items-center justify-center overflow-hidden rounded-3xl border-2 border-mint-400 bg-purple-950">
        <video ref={videoRef} playsInline muted className={`absolute inset-0 h-full w-full object-cover ${cameraOn ? '' : 'hidden'}`} />
        {!cameraOn && <ScanLine className="h-14 w-14 text-mint-400" />}
        <div className="absolute inset-x-0 top-0 h-1 bg-mint-400 shadow-[0_0_12px_2px] shadow-mint-400 animate-[scanline_1.5s_ease-in-out_infinite]" />
      </div>
      <p className="font-semibold text-mint-400">
        {status === 'searching' ? 'Buscando dados do livro...' : cameraOn ? 'Aponte para o código de barras' : 'Digite o ISBN do livro'}
      </p>
      <p className="mt-1 text-xs text-purple-400">Fica no verso, acima do código de barras (978...).</p>

      <form
        className="mt-5 flex w-full max-w-xs gap-2"
        onSubmit={(e) => { e.preventDefault(); void search(typed); }}
      >
        <input
          value={typed}
          onChange={(e) => { setTyped(e.target.value); setError(null); }}
          placeholder="978..."
          inputMode="numeric"
          aria-label="ISBN"
          className="flex-1 rounded-xl bg-purple-950/60 px-3 py-2.5 text-sm font-medium text-purple-50 placeholder:text-purple-500 outline-hidden ring-1 ring-purple-700 focus:ring-2 focus:ring-mint-400"
        />
        <button
          type="submit"
          disabled={status === 'searching' || normalizeIsbn(typed).length < 10}
          className="flex items-center gap-1 rounded-xl bg-mint-400 px-3 text-xs font-bold text-purple-950 active:scale-95 disabled:opacity-40"
        >
          <Search className="h-4 w-4" /> Buscar
        </button>
      </form>
      {error && <p className="mt-2 text-xs font-medium text-red-300">{error}</p>}
    </div>
  );
}
