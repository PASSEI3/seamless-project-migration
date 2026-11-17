import { MapPin, Clock, Check, X, ShieldCheck, PenLine } from 'lucide-react';
import { useState } from 'react';
import type { MeetupPoint } from '@/livrei/types';
import { cityNameOf, customMeetupPoint, suggestMeetupPoints, CUSTOM_MEETUP_MIN_LENGTH } from '@/livrei/lib/meetup';

interface Props {
  /** Reader's city from the profile ("Cidade - UF"). */
  city: string;
  selected: MeetupPoint | null;
  onSelect: (point: MeetupPoint) => void;
  onClose: () => void;
}

const typeColor: Partial<Record<MeetupPoint['type'], string>> = {
  Shopping: 'bg-mint-400/20 text-mint-300',
  'Praça': 'bg-purple-400/20 text-purple-300',
  Livraria: 'bg-purple-500/20 text-purple-200',
  'Local escolhido': 'bg-mint-400/20 text-mint-300',
};

export function MeetupPopupModal({ city, selected, onSelect, onClose }: Props) {
  const suggestions = suggestMeetupPoints(city);
  const [choice, setChoice] = useState<MeetupPoint | null>(selected);
  const [custom, setCustom] = useState(selected?.id === 'custom' ? selected.name : '');
  const customPoint = customMeetupPoint(custom, city);
  const usingCustom = choice?.id === 'custom';
  const finalChoice = usingCustom ? customPoint : choice;
  const cityName = cityNameOf(city);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-purple-950/85 p-4 backdrop-blur-xs">
      <div className="animate-scale-in flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-4xl bg-purple-900 ring-1 ring-purple-700">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-purple-800 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-purple-50">Encontro Presencial</h2>
            <p className="truncate text-xs text-purple-400">
              {cityName ? `Sugestões em ${city}` : 'Sugestões para a sua cidade'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-800 text-purple-300 active:scale-90"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Segurança banner */}
        <div className="flex items-center gap-2 bg-mint-400/10 px-5 py-2.5">
          <ShieldCheck className="h-4 w-4 shrink-0 text-mint-400" />
          <p className="text-xs text-mint-200">Escolha sempre um local público, movimentado e de dia.</p>
        </div>

        {/* Lista rolável */}
        <div className="flex-1 space-y-2.5 overflow-y-auto p-5 no-scrollbar">
          {suggestions.map((p) => {
            const isSel = choice?.id === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setChoice(p)}
                className={`flex w-full items-start gap-3 rounded-2xl p-3.5 text-left ring-1 transition active:scale-[0.98] ${
                  isSel ? 'bg-mint-400/15 ring-mint-400' : 'bg-purple-800/50 ring-purple-700'
                }`}
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-950 text-xl">
                  {p.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${typeColor[p.type] ?? 'bg-purple-400/20 text-purple-300'}`}>
                      {p.type}
                    </span>
                    {isSel && <Check className="h-4 w-4 text-mint-400" />}
                  </div>
                  <h3 className="mt-1 text-sm font-bold text-purple-50">{p.name}</h3>
                  <p className="mt-0.5 flex items-start gap-1 text-xs text-purple-300">
                    <MapPin className="mt-0.5 h-3 w-3 shrink-0" /> {p.address}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-purple-400">
                    <Clock className="h-3 w-3" /> {p.hours}
                  </p>
                </div>
              </button>
            );
          })}

          {/* Campo livre */}
          <div
            className={`rounded-2xl p-3.5 ring-1 transition ${
              usingCustom ? 'bg-mint-400/15 ring-mint-400' : 'bg-purple-800/50 ring-purple-700'
            }`}
          >
            <label htmlFor="meetup-custom" className="flex items-center gap-2 text-sm font-bold text-purple-50">
              <PenLine className="h-4 w-4 text-mint-400" /> Outro ponto público
            </label>
            <p className="mt-0.5 text-xs text-purple-300">Digite o local que vocês escolheram.</p>
            <input
              id="meetup-custom"
              value={custom}
              maxLength={120}
              onFocus={() => setChoice({ id: 'custom' } as MeetupPoint)}
              onChange={(e) => {
                setCustom(e.target.value);
                setChoice({ id: 'custom' } as MeetupPoint);
              }}
              placeholder="Ex: Biblioteca Pública Estadual, entrada principal"
              className="mt-2 w-full rounded-xl bg-purple-950 px-3 py-2.5 text-sm text-purple-50 placeholder:text-purple-500 outline-hidden ring-1 ring-purple-700 focus:ring-mint-400"
            />
            {usingCustom && !customPoint && (
              <p className="mt-1.5 text-[11px] text-amber-400">
                Digite pelo menos {CUSTOM_MEETUP_MIN_LENGTH} letras.
              </p>
            )}
          </div>
        </div>

        {/* Rodapé */}
        <div className="border-t border-purple-800 px-5 py-4">
          <button
            disabled={!finalChoice}
            onClick={() => finalChoice && onSelect(finalChoice)}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-mint-400 py-3.5 font-bold text-purple-950 disabled:opacity-40 active:scale-95"
          >
            {finalChoice ? 'Confirmar local' : 'Escolha ou digite um local'}
          </button>
        </div>
      </div>
    </div>
  );
}
