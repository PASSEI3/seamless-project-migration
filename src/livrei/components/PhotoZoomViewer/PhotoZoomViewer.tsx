import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from 'lucide-react';
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';

interface Props {
  photos: string[];
  labels: string[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}

/** Fullscreen photo with pinch, double-tap and button zoom — enough to read a photographed back-cover synopsis. */
export default function PhotoZoomViewer({ photos, labels, index, onIndex, onClose }: Props) {
  const label = labels[index] ?? `Foto ${index + 1}`;
  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-purple-950 animate-fade-in" role="dialog" aria-label={label}>
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-sm font-semibold text-purple-100">{label}</p>
        <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-800 text-purple-200 active:scale-90" aria-label="Fechar foto">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="relative min-h-0 flex-1">
        <TransformWrapper key={index} initialScale={1} minScale={1} maxScale={6} centerOnInit doubleClick={{ mode: 'toggle', step: 1.5 }} wheel={{ step: 0.2 }}>
          {({ zoomIn, zoomOut }) => (
            <>
              <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ width: '100%', height: '100%' }}>
                <img src={photos[index]} alt={label} className="h-full w-full object-contain" draggable={false} />
              </TransformComponent>
              <div className="absolute bottom-4 right-4 flex flex-col gap-2">
                <button onClick={() => zoomIn(0.6)} className="flex h-11 w-11 items-center justify-center rounded-full bg-purple-800/90 text-purple-50 ring-1 ring-purple-600 active:scale-90" aria-label="Aumentar zoom">
                  <ZoomIn className="h-5 w-5" />
                </button>
                <button onClick={() => zoomOut(0.6)} className="flex h-11 w-11 items-center justify-center rounded-full bg-purple-800/90 text-purple-50 ring-1 ring-purple-600 active:scale-90" aria-label="Diminuir zoom">
                  <ZoomOut className="h-5 w-5" />
                </button>
              </div>
            </>
          )}
        </TransformWrapper>
        {index > 0 && (
          <button onClick={() => onIndex(index - 1)} className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-purple-900/80 text-purple-100" aria-label="Foto anterior">
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        {index < photos.length - 1 && (
          <button onClick={() => onIndex(index + 1)} className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-purple-900/80 text-purple-100" aria-label="Próxima foto">
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
      </div>
      <p className="shrink-0 px-4 pb-4 pt-2 text-center text-[11px] font-medium text-purple-400">
        Use dois dedos (pinça) ou toque duas vezes para ampliar · arraste para mover
      </p>
    </div>
  );
}
