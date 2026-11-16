import { useEffect, useState } from 'react';
import { lookupCep } from '@/livrei/lib/cep';
import { loadPrivateData, savePrivateData, updateDisplayName } from '@/livrei/lib/account';
import {
  X,
  Settings,
  UserCog,
  MapPinned,
  Shield,
  LifeBuoy,
  Trash2,
  ChevronRight,
  LogOut,
  Camera,
  Check,
  Search,
  MessageCircle,
  Plus,
} from 'lucide-react';

interface Props {
  onOpenTerms: () => void;
  onClose: () => void;
  onSignOut: () => void;
  /** Present when signed in: profile and address are read from / saved to the account. */
  userId?: string | undefined;
  displayName?: string | undefined;
  onProfileChanged?: (name: string) => void;
}

interface MenuItem {
  icon: typeof Shield;
  label: string;
  hint: string;
  action: () => void;
  danger?: boolean;
}

type ModalType = 'profile' | 'address' | 'support' | null;

const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: 'Como ganho moedas no LIVREI?',
    a: 'Você ganha moedas enviando livros seus para outros leitores (resgate por moedas) e completando trocas. Cada livro enviado adiciona moedas ao seu saldo para resgatar novos livros.',
  },
  {
    q: 'Qual o prazo de entrega?',
    a: 'Para envios pelos Correios, você tem até 3 dias úteis para postar. Para Uber Flash local, o motoboy é chamado assim que você confirma disponibilidade.',
  },
  {
    q: 'Meu PIN e telefone são seguros?',
    a: 'Nunca escreva telefone ou PIN no pacote. Escreva apenas o Nome Completo do destinatário. O PIN de postagem é digital e fica protegido no app.',
  },
];

export function SettingsScreen({ onOpenTerms, onClose, onSignOut, userId, displayName, onProfileChanged }: Props) {
  const [openModal, setOpenModal] = useState<ModalType>(null);

  const [profileName, setProfileName] = useState(displayName ?? 'Marina Costa Oliveira');
  const [profileSaved, setProfileSaved] = useState(false);

  const [cep, setCep] = useState('');
  const [cepLoading, setCepLoading] = useState(false);
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [district, setDistrict] = useState('');
  const [cityUf, setCityUf] = useState('');
  const [addressSaved, setAddressSaved] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [priv, setPriv] = useState<Awaited<ReturnType<typeof loadPrivateData>>>(null);

  useEffect(() => {
    if (openModal !== 'address' || !userId) return;
    void loadPrivateData(userId).then((d) => setPriv(d));
  }, [openModal, userId]);

  const handleCepLookup = async (value = cep) => {
    if (value.replace(/\D/g, '').length !== 8) return;
    setCepError(null);
    setCepLoading(true);
    const addr = await lookupCep(value);
    setCepLoading(false);
    if (!addr) { setCepError('CEP não encontrado. Preencha manualmente.'); return; }
    setStreet(addr.street);
    setDistrict(addr.district);
    setCityUf(`${addr.city} - ${addr.uf}`);
  };

  const handleSaveAddress = async () => {
    setSaveError(null);
    const [cityPart, ufPart] = cityUf.split(/\s*[-/]\s*(?=[A-Za-z]{2}\s*$)/);
    if (cep.replace(/\D/g, '').length !== 8 || !street.trim() || !number.trim() || !district.trim() || !cityPart?.trim() || !ufPart) {
      setSaveError('Preencha CEP, rua, número, bairro e Cidade - UF.');
      return;
    }
    if (!userId) { setAddressSaved(true); return; }
    setSaving(true);
    const err = await savePrivateData(userId, {
      cpf: priv?.cpf ?? '',
      phone: priv?.phone ?? '',
      cep,
      street,
      number,
      district,
      city: cityPart.trim(),
      state: ufPart.trim().toUpperCase(),
      portariaOk: priv?.portaria_ok ?? false,
      reference: priv?.reference ?? '',
    });
    setSaving(false);
    if (err) { setSaveError(err); return; }
    setPriv(await loadPrivateData(userId));
    setAddressSaved(true);
  };

  const handleSaveProfile = async () => {
    if (!userId) { setProfileSaved(true); return; }
    if (profileName.trim().length < 3) return;
    const err = await updateDisplayName(userId, profileName);
    if (!err) { setProfileSaved(true); onProfileChanged?.(profileName.trim()); }
  };

  const items: MenuItem[] = [
    { icon: UserCog, label: 'Editar Perfil', hint: 'Nome, foto e dados pessoais', action: () => setOpenModal('profile') },
    { icon: MapPinned, label: 'Meus Endereços', hint: 'Gerenciar endereços de entrega', action: () => setOpenModal('address') },
    { icon: Shield, label: 'Termos de Uso e Segurança', hint: 'Regulamento e LGPD', action: onOpenTerms },
    { icon: LifeBuoy, label: 'Suporte / Ajuda', hint: 'Dúvidas e contato', action: () => setOpenModal('support') },
  ];

  const closeModal = () => {
    setOpenModal(null);
    setProfileSaved(false);
    setAddressSaved(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-purple-950">
      <div className="flex items-center justify-between px-4 py-4">
        <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-900 text-purple-200 active:scale-90" aria-label="Fechar">
          <X className="h-5 w-5" />
        </button>
        <h2 className="flex items-center gap-2 text-sm font-bold text-purple-50">
          <Settings className="h-4 w-4 text-mint-400" /> Configurações
        </h2>
        <div className="h-9 w-9" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 no-scrollbar">
        <div className="space-y-2.5">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                onClick={item.action}
                className="flex w-full items-center gap-3 rounded-2xl bg-purple-900/60 p-4 text-left transition active:scale-[0.98]"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-950">
                  <Icon className="h-5 w-5 text-mint-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-purple-50">{item.label}</p>
                  <p className="truncate text-xs text-purple-300">{item.hint}</p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-purple-500" />
              </button>
            );
          })}
        </div>

        <div className="mt-6 space-y-2.5">
          <button
            onClick={onSignOut}
            className="flex w-full items-center gap-3 rounded-2xl bg-purple-900/60 p-4 text-left transition active:scale-[0.98]"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-950">
              <LogOut className="h-5 w-5 text-purple-200" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-purple-100">Sair da conta</p>
              <p className="truncate text-xs text-purple-400">Encerrar sessão neste dispositivo</p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-purple-500" />
          </button>

          <button
            onClick={() => {}}
            className="flex w-full items-center gap-3 rounded-2xl bg-red-500/10 p-4 text-left transition active:scale-[0.98] ring-1 ring-red-500/30"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/20">
              <Trash2 className="h-5 w-5 text-red-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-red-400">Excluir Conta</p>
              <p className="truncate text-xs text-red-400/70">Remover permanentemente seus dados</p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-red-500/50" />
          </button>
        </div>

        <p className="mt-8 text-center text-[10px] text-purple-500">LIVREI v1.0 · Troca de Livros</p>
      </div>

      {/* === MODALS === */}
      {openModal && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-xs animate-fade-in" onClick={closeModal}>
          <div
            className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-purple-900 p-5 ring-1 ring-purple-700 no-scrollbar animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold text-purple-50">
                {openModal === 'profile' && 'Editar Perfil'}
                {openModal === 'address' && 'Meus Endereços'}
                {openModal === 'support' && 'Suporte / Ajuda'}
              </h3>
              <button onClick={closeModal} className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-950 text-purple-300 active:scale-90">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Profile modal */}
            {openModal === 'profile' && (
              <div className="space-y-4">
                {/* Profile photo */}
                <div className="flex flex-col items-center gap-2">
                  <div className="relative">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-purple-700 text-3xl">🦊</div>
                    <button className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-mint-400 text-purple-950 ring-2 ring-purple-900 active:scale-90">
                      <Camera className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <button className="text-[11px] font-semibold text-mint-400 underline underline-offset-2">Alterar foto</button>
                </div>

                {/* Name field */}
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-purple-400">Nome Completo</label>
                  <input
                    type="text"
                    value={profileName}
                    onChange={(e) => { setProfileName(e.target.value); setProfileSaved(false); }}
                    className="w-full rounded-xl bg-purple-950 px-3 py-3 text-sm text-purple-50 outline-hidden ring-1 ring-purple-700 focus:ring-mint-400"
                    placeholder="Seu nome completo"
                  />
                </div>

                {/* Save button */}
                <button
                  onClick={() => void handleSaveProfile()}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-mint-400 py-3.5 text-sm font-bold text-purple-950 shadow-lg shadow-mint-400/20 transition active:scale-95"
                >
                  {profileSaved ? (<><Check className="h-4 w-4" /> Alterações Salvas!</>) : 'Salvar Alterações'}
                </button>
              </div>
            )}

            {/* Address modal */}
            {openModal === 'address' && (
              <div className="space-y-4">
                {/* Current address */}
                <div className="rounded-2xl bg-purple-950/70 p-3 ring-1 ring-purple-700">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-mint-400">Endereço Principal</p>
                  {userId ? (
                    priv?.street ? (
                      <>
                        <p className="mt-1 text-sm font-bold text-purple-50">{displayName}</p>
                        <p className="mt-0.5 text-xs leading-snug text-purple-300">
                          {priv.street}, {priv.number} - {priv.district}<br />
                          {priv.city} - {priv.uf} · {priv.cep}
                        </p>
                      </>
                    ) : (
                      <p className="mt-1 text-xs text-purple-300">Nenhum endereço salvo ainda.</p>
                    )
                  ) : (
                    <>
                      <p className="mt-1 text-sm font-bold text-purple-50">Marina Costa Oliveira</p>
                      <p className="mt-0.5 text-xs leading-snug text-purple-300">Rua Exemplo, 123 - Centro<br />São Paulo - SP · 01234-567</p>
                    </>
                  )}
                </div>

                {/* Divider */}
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-purple-700" />
                  <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-purple-400">
                    <Plus className="h-3 w-3" /> Adicionar novo
                  </span>
                  <div className="h-px flex-1 bg-purple-700" />
                </div>

                {/* CEP with auto-lookup */}
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-purple-400">CEP</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={cep}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d{1,3})/, '$1-$2');
                        setCep(v);
                        setAddressSaved(false);
                        if (v.replace(/\D/g, '').length === 8) void handleCepLookup(v);
                      }}
                      inputMode="numeric"
                      maxLength={9}
                      className="flex-1 rounded-xl bg-purple-950 px-3 py-3 text-sm text-purple-50 outline-hidden ring-1 ring-purple-700 focus:ring-mint-400"
                      placeholder="00000-000"
                    />
                    <button
                      onClick={() => void handleCepLookup()}
                      disabled={cepLoading || cep.replace(/\D/g, '').length !== 8}
                      className="flex shrink-0 items-center gap-1.5 rounded-xl bg-purple-800 px-3 text-xs font-bold text-purple-100 ring-1 ring-purple-700 transition active:scale-95 disabled:opacity-50"
                    >
                      {cepLoading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-purple-400 border-t-transparent" /> : <Search className="h-4 w-4" />}
                      Buscar
                    </button>
                  </div>
                  {cepError && <p className="mt-1 text-[11px] text-amber-300">{cepError}</p>}
                </div>

                {/* Street */}
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-purple-400">Rua / Avenida</label>
                  <input
                    type="text"
                    value={street}
                    onChange={(e) => { setStreet(e.target.value); setAddressSaved(false); }}
                    className="w-full rounded-xl bg-purple-950 px-3 py-3 text-sm text-purple-50 outline-hidden ring-1 ring-purple-700 focus:ring-mint-400"
                    placeholder="Rua / Avenida"
                  />
                </div>

                {/* Number + District */}
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-purple-400">Número</label>
                    <input
                      type="text"
                      value={number}
                      onChange={(e) => { setNumber(e.target.value); setAddressSaved(false); }}
                      className="w-full rounded-xl bg-purple-950 px-3 py-3 text-sm text-purple-50 outline-hidden ring-1 ring-purple-700 focus:ring-mint-400"
                      placeholder="123"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-purple-400">Bairro</label>
                    <input
                      type="text"
                      value={district}
                      onChange={(e) => { setDistrict(e.target.value); setAddressSaved(false); }}
                      className="w-full rounded-xl bg-purple-950 px-3 py-3 text-sm text-purple-50 outline-hidden ring-1 ring-purple-700 focus:ring-mint-400"
                      placeholder="Bairro"
                    />
                  </div>
                </div>

                {/* City/UF */}
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-purple-400">Cidade / UF</label>
                  <input
                    type="text"
                    value={cityUf}
                    onChange={(e) => { setCityUf(e.target.value); setAddressSaved(false); }}
                    className="w-full rounded-xl bg-purple-950 px-3 py-3 text-sm text-purple-50 outline-hidden ring-1 ring-purple-700 focus:ring-mint-400"
                    placeholder="Cidade - UF"
                  />
                </div>

                {/* Save button */}
                {saveError && <p className="text-center text-xs font-medium text-red-300">{saveError}</p>}
                <button
                  onClick={() => void handleSaveAddress()}
                  disabled={saving}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-mint-400 py-3.5 text-sm font-bold text-purple-950 shadow-lg shadow-mint-400/20 transition active:scale-95"
                >
                  {addressSaved ? (<><Check className="h-4 w-4" /> Endereço Salvo!</>) : 'Salvar Endereço'}
                </button>
              </div>
            )}

            {/* Support modal */}
            {openModal === 'support' && (
              <div className="space-y-4">
                {/* FAQ */}
                <div className="space-y-2.5">
                  {FAQ_ITEMS.map((item, i) => (
                    <details key={i} className="group rounded-2xl bg-purple-950/70 p-3 ring-1 ring-purple-700">
                      <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold text-purple-50 list-none">
                        {item.q}
                        <ChevronRight className="h-4 w-4 shrink-0 text-purple-400 transition group-open:rotate-90" />
                      </summary>
                      <p className="mt-2 text-xs leading-relaxed text-purple-300">{item.a}</p>
                    </details>
                  ))}
                </div>

                {/* WhatsApp button */}
                <a
                  href="https://chat.whatsapp.com/FFmgfwRRxGuATdvlamCnM3"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-mint-400 py-3.5 text-sm font-bold text-purple-950 shadow-lg shadow-mint-400/20 transition active:scale-95"
                >
                  <MessageCircle className="h-4 w-4" /> Falar com o Suporte no WhatsApp
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
