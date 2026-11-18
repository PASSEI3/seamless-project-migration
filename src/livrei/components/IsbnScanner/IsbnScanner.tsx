import { useEffect, useRef, useState } from 'react';
import { Camera, ScanLine, Search, X } from 'lucide-react';
import { isValidIsbn, normalizeIsbn, type IsbnBook } from '@/livrei/lib/isbn';
import { findBookByIsbn } from '@/livrei/lib/isbnClient';

interface Props {
  onFound: (book: IsbnBook) => void;
  /** ISBN not found in Google Books, BrasilAPI nor Open Library: continue manually. */
  onNotFound: (isbn: string) => void;
  onCancel: () => void;
}

type CameraState = 'starting' | 'on' | 'denied' | 'unavailable';

/**
 * Reads the EAN-13 barcode with the rear camera on any mobile browser (ZXing, no
 * BarcodeDetector needed) or by typing the ISBN. ZXing is loaded only in the browser.
 */
export function IsbnScanner({ onFound, onNotFound, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [camera, setCamera] = useState<CameraState>('starting');
  const [attempt, setAttempt] = useState(0);
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
    const book = await findBookByIsbn(isbn);
    busy.current = false;
    setStatus('idle');
    if (book) onFound(book);
    else onNotFound(isbn);
  };

  useEffect(() => {
    let stopped = false;
    let controls: { stop: () => void } | undefined;
    setCamera('starting');
    void (async () => {
      if (!navigator.mediaDevices?.getUserMedia || !videoRef.current) { setCamera('unavailable'); return; }
      try {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import('@zxing/browser'),
          import('@zxing/library'),
        ]);
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13]);
        hints.set(DecodeHintType.TRY_HARDER, true);
        const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 150 });
        const c = await reader.decodeFromConstraints(
          { audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
          videoRef.current,
          (result, _err, ctl) => {
            if (!result || busy.current) return;
            const code = normalizeIsbn(result.getText());
            if (!isValidIsbn(code) || !/^97[89]/.test(code)) return;
            ctl.stop();
            setTyped(code);
            void search(code);
          },
        );
        controls = c;
        if (stopped) c.stop();
        else setCamera('on');
      } catch (e) {
        if (stopped) return;
        const name = (e as { name?: string } | null)?.name;
        setCamera(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable');
      }
    })();
    return () => {
      stopped = true;
      controls?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const cameraOn = camera === 'on';
  const headline =
    status === 'searching' ? 'Buscando dados do livro...'
    : cameraOn ? 'Enquadre o código de barras na moldura'
    : camera === 'starting' ? 'Abrindo a câmera traseira...'
    : camera === 'denied' ? 'Permita o acesso à câmera para escanear'
    : 'Digite o ISBN do livro';

  return (
    <div className="flex h-full flex-col items-center justify-center p-6 text-center">
      <button onClick={onCancel} className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-purple-800 text-purple-200 active:scale-90" aria-label="Cancelar">
        <X className="h-4 w-4" />
      </button>
      <div className="relative mb-5 aspect-[4/3] w-full max-w-xs overflow-hidden rounded-3xl border-2 border-mint-400 bg-purple-950">
        <video ref={videoRef} playsInline muted autoPlay className={`absolute inset-0 h-full w-full object-cover ${cameraOn ? '' : 'invisible'}`} />
        {!cameraOn && (
          <div className="absolute inset-0 flex items-center justify-center">
            <ScanLine className="h-14 w-14 text-mint-400" />
          </div>
        )}
        {/* Barcode frame */}
        <div className="pointer-events-none absolute inset-x-8 top-1/2 h-20 -translate-y-1/2 rounded-xl border-2 border-dashed border-mint-300/80" />
        <div className="absolute inset-x-0 top-0 h-1 bg-mint-400 shadow-[0_0_12px_2px] shadow-mint-400 animate-[scanline_1.5s_ease-in-out_infinite]" />
      </div>
      <p className="font-semibold text-mint-400">{headline}</p>
      <p className="mt-1 text-xs text-purple-400">Fica no verso, acima do código de barras (978...).</p>

      {(camera === 'denied' || camera === 'unavailable') && (
        <div className="mt-3 w-full max-w-xs">
          <p className="text-[11px] leading-relaxed text-purple-300">
            {camera === 'denied'
              ? 'A câmera foi bloqueada. Libere o acesso à câmera para este site nas configurações do navegador e toque abaixo.'
              : 'Não conseguimos abrir a câmera neste aparelho. Você pode digitar o ISBN abaixo.'}
          </p>
          <button
            onClick={() => setAttempt((n) => n + 1)}
            className="mx-auto mt-2 flex items-center gap-1.5 rounded-full bg-purple-800 px-4 py-2 text-xs font-bold text-purple-100 ring-1 ring-purple-700 active:scale-95"
          >
            <Camera className="h-3.5 w-3.5 text-mint-400" /> Tentar abrir a câmera
          </button>
        </div>
      )}

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
