import { useState, useEffect, useRef } from 'react';
import {
  User, Crown, Wallet, ArrowDownLeft, ArrowUpRight,
  Headphones, LogOut, ChevronRight, Clock, Check,
  Copy, MessageCircle, Lock, X, Receipt, Ban,
  ExternalLink, Plus, Send, MousePointerClick,
  DollarSign, Calendar, Gift,
} from 'lucide-react';
import Layout from '../components/Layout';
import { trpc } from '@/providers/trpc';
import { VIP_TABLE } from '../store';

type ActionView = 'main' | 'deposit' | 'withdraw' | 'support' | 'history';
type HistoryTab = 'deposits' | 'withdrawals' | 'bonuses';

// Wallet addresses are fetched from API now

export default function Account() {
  const [view, setView] = useState<ActionView>('main');
  const [historyTab, setHistoryTab] = useState<HistoryTab>('withdrawals');
  const [showLogout, setShowLogout] = useState(false);

  const { data: profile } = trpc.profile.me.useQuery(undefined, {
    staleTime: 1000 * 30,
    retry: false,
  });
  const { data: walletAddresses = [] } = trpc.walletAddress.list.useQuery(undefined, {
    staleTime: 1000 * 60,
  });
  const { data: deposits = [] } = trpc.deposit.list.useQuery(undefined, {
    staleTime: 1000 * 30,
    retry: false,
  });
  const { data: withdrawals = [] } = trpc.withdrawal.list.useQuery(undefined, {
    staleTime: 1000 * 30,
    retry: false,
  });
  const { data: tickets = [] } = trpc.ticket.list.useQuery(undefined, {
    staleTime: 1000 * 30,
    retry: false,
  });
  const { data: wheelHistory = [] } = trpc.wheel.list.useQuery(undefined, {
    staleTime: 1000 * 30,
    retry: false,
  });

  // Withdrawal eligibility
  const { data: canWithdrawData } = trpc.withdrawal.canWithdraw.useQuery(undefined, {
    staleTime: 5000,
    retry: false,
    enabled: view === 'withdraw',
  });
  const [feePreview, setFeePreview] = useState<{ gross: number; fee: number; net: number; feePercent: number; isFirstFree: boolean } | null>(null);
  const calculateFeePreview = (amount: number, isFirstFree: boolean, feePercent: number) => {
    const fee = isFirstFree ? 0 : (amount * feePercent) / 100;
    return { gross: amount, fee, net: amount - fee, feePercent, isFirstFree };
  };

  const utils = trpc.useUtils();

  // Deposit mutations
  const depositMutation = trpc.deposit.create.useMutation({
    onSuccess: () => {
      utils.deposit.list.invalidate();
      setDepositStatus('checking');
    },
  });

  // Withdrawal mutations
  const withdrawMutation = trpc.withdrawal.create.useMutation({
    onSuccess: () => {
      utils.withdrawal.list.invalidate();
      utils.profile.me.invalidate();
      setWithdrawSuccess(true);
      setTimeout(() => {
        setWithdrawSuccess(false);
        setWithdrawAmount('');
        setWalletAddress('');
        setWithdrawEmail('');
        setView('main');
      }, 2000);
    },
  });
  const cancelWithdrawMutation = trpc.withdrawal.cancel.useMutation({
    onSuccess: () => {
      utils.withdrawal.list.invalidate();
      utils.profile.me.invalidate();
    },
  });

  // Ticket mutations
  const createTicketMutation = trpc.ticket.create.useMutation({
    onSuccess: () => {
      utils.ticket.list.invalidate();
      setNewSubject('');
      setShowNewTicket(false);
    },
  });
  const addMessageMutation = trpc.ticket.addMessage.useMutation({
    onSuccess: () => {
      utils.ticket.list.invalidate();
      setNewMessage('');
    },
  });
  const closeTicketMutation = trpc.ticket.close.useMutation({
    onSuccess: () => {
      utils.ticket.list.invalidate();
    },
  });

  // Deposit
  const [depositAmount, setDepositAmount] = useState('');
  const [depositEmail, setDepositEmail] = useState('');
  const [depositCrypto, setDepositCrypto] = useState('trc20');
  const [depositStatus, setDepositStatus] = useState<'idle' | 'checking'>('idle');
  const [copied, setCopied] = useState(false);

  // Withdraw
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawEmail, setWithdrawEmail] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);

  // Support
  const [activeTicket, setActiveTicket] = useState<number | null>(null);
  const [newSubject, setNewSubject] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [showNewTicket, setShowNewTicket] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const currentTicket = tickets.find((t: any) => t.id === activeTicket);

  const selectedCrypto = walletAddresses.find((c: any) => c.key === depositCrypto) || walletAddresses[0] || { key: 'trc20', label: 'USDT (TRC20)', address: '', color: '#FF060A' };

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(selectedCrypto.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDeposit = () => {
    if (!depositAmount || Number(depositAmount) <= 0 || !depositEmail.trim()) return;
    depositMutation.mutate({
      amount: Number(depositAmount),
      email: depositEmail.trim(),
      cryptoType: depositCrypto as 'trc20' | 'sol' | 'trx' | 'eth',
    });
  };

  const handleWithdraw = () => {
    if (!withdrawAmount || Number(withdrawAmount) <= 0 || !walletAddress || !withdrawEmail) return;
    if (!profile) return;
    withdrawMutation.mutate({
      amount: Number(withdrawAmount),
      email: withdrawEmail,
      wallet: walletAddress,
    });
  };

  const handleCancelWithdraw = (id: number) => {
    cancelWithdrawMutation.mutate({ id });
  };

  const handleCreateTicket = () => {
    if (!newSubject.trim()) return;
    createTicketMutation.mutate({ subject: newSubject });
  };

  const handleSendMessage = () => {
    if (!newMessage.trim() || !activeTicket) return;
    const ticket = tickets.find((tk: any) => tk.id === activeTicket);
    if (!ticket || ticket.status === 'closed') return;
    addMessageMutation.mutate({ ticketId: activeTicket, text: newMessage });
  };

  const handleCloseTicket = (ticketId: number) => {
    closeTicketMutation.mutate({ ticketId });
  };

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [tickets, activeTicket]);

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/';
  };

  const statusLabel = (status: string) => {
    const map: Record<string, { text: string; color: string; bg: string }> = {
      pending: { text: 'Beklemede', color: '#FFD700', bg: 'rgba(255,215,0,0.12)' },
      approved: { text: 'Onaylandı', color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
      rejected: { text: 'Reddedildi', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
      cancelled: { text: 'İptal Edildi', color: '#5a6a7a', bg: 'rgba(90,106,122,0.15)' },
      open: { text: 'Beklemede', color: '#FFD700', bg: 'rgba(255,215,0,0.12)' },
      resolved: { text: 'Çözüldü', color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
      closed: { text: 'Kapatıldı', color: '#5a6a7a', bg: 'rgba(90,106,122,0.15)' },
    };
    const s = map[status] || map.pending;
    return <span className="text-[10px] font-extrabold px-2 py-1 rounded-full" style={{ background: s.bg, color: s.color }}>{s.text}</span>;
  };

  if (!profile) return null;

  const userId = (profile as any).userId ?? 0;
  const investment = Number(profile.investment);
  let vipLevel = 0;
  for (let i = VIP_TABLE.length - 1; i >= 0; i--) {
    if (investment >= VIP_TABLE[i].min) { vipLevel = VIP_TABLE[i].level; break; }
  }

  // ─── DEPOSIT VIEW ───
  if (view === 'deposit') {
    return (
      <Layout>
        <div className="grid gap-3 animate-fade-in">
          <div className="flex items-center gap-3 mb-2">
            <button onClick={() => { setView('main'); setDepositStatus('idle'); setDepositAmount(''); }} className="btn-secondary" style={{ width: '36px', minHeight: '36px', padding: 0 }}><ArrowDownLeft size={16} style={{ transform: 'rotate(90deg)' }} /></button>
            <h1 className="text-xl font-bold text-white">Para Yatır</h1>
          </div>
          {depositStatus === 'checking' ? (
            <div className="glass-card text-center py-10">
              <div className="mx-auto mb-4 grid place-items-center rounded-full animate-pulse" style={{ width: '64px', height: '64px', background: 'rgba(255,215,0,0.1)' }}><Clock size={32} style={{ color: '#FFD700' }} /></div>
              <p className="text-base font-bold text-white mb-2">İşleminiz Kontrol Ediliyor</p>
              <p className="text-sm" style={{ color: '#8fa5b8' }}>Bu işlem yaklaşık 15-20 dakika sürmektedir.</p>
              <button onClick={() => setView('main')} className="btn-secondary mt-4">Tamam</button>
            </div>
          ) : (
            <div className="grid gap-3">
              {/* Email (required) */}
              <div className="glass-card">
                <label className="label-text block mb-2">E-posta Adresiniz <span style={{ color: '#ef4444' }}>*</span></label>
                <input type="email" value={depositEmail} onChange={(e) => setDepositEmail(e.target.value)} placeholder="E-posta adresinizi girin" className="glass-input" style={{ minHeight: '46px' }} required />
              </div>

              {/* Crypto Selector */}
              <div className="glass-card">
                <label className="label-text block mb-2">Kripto Para Seçimi</label>
                {walletAddresses.length === 0 ? (
                  <p className="text-xs" style={{ color: '#5a6a7a' }}>Cuzdan adresleri yukleniyor...</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {walletAddresses.map((c: any) => (
                      <button key={c.key} onClick={() => setDepositCrypto(c.key)} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-all" style={{ background: depositCrypto === c.key ? `${c.color}18` : 'rgba(255,255,255,0.03)', border: depositCrypto === c.key ? `1px solid ${c.color}40` : '1px solid rgba(248,251,255,0.06)' }}>
                        <div className="rounded-full shrink-0" style={{ width: '10px', height: '10px', background: c.color }} />
                        <span className="text-xs font-bold" style={{ color: depositCrypto === c.key ? c.color : '#8fa5b8' }}>{c.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Deposit Amount */}
              <div className="glass-card">
                <label className="label-text block mb-2">Yatırım Miktarı ($)</label>
                <input type="number" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="Örn: 100" className="glass-input" style={{ minHeight: '46px' }} />
              </div>

              {/* Wallet Address */}
              <div className="glass-card" style={{ border: `1px solid ${selectedCrypto.color}30`, background: `${selectedCrypto.color}08` }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="rounded-full" style={{ width: '10px', height: '10px', background: selectedCrypto.color }} />
                  <span className="text-sm font-bold" style={{ color: selectedCrypto.color }}>{selectedCrypto.label}</span>
                </div>
                <p className="text-xs mb-3" style={{ color: '#8fa5b8' }}>Aşağıdaki adrese gönderim yapın:</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 text-xs font-mono truncate rounded-xl px-3 py-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(248,251,255,0.1)', color: '#c8d6e5' }}>{selectedCrypto.address}</div>
                  <button onClick={handleCopyAddress} className="btn-secondary" style={{ minHeight: '42px', width: '42px', padding: 0 }}>{copied ? <Check size={16} /> : <Copy size={16} />}</button>
                </div>
                {copied && <p className="text-xs mt-2 text-center" style={{ color: '#10b981' }}>Kopyalandı!</p>}
              </div>

              {/* Warning Message */}
              <div className="rounded-xl p-3" style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)' }}>
                <p className="text-xs font-bold text-center" style={{ color: '#FFD700' }}>
                  Yukaridaki adreslerden birine gonderim yaptiktan sonra "Yatirimi Onayla" butonuna tiklayiniz.
                </p>
              </div>

              <button onClick={handleDeposit} className="btn-primary" disabled={!depositAmount || Number(depositAmount) <= 0 || !depositEmail.trim()} style={{ opacity: (!depositAmount || Number(depositAmount) <= 0 || !depositEmail.trim()) ? 0.4 : 1 }}>
                Yatirimi Onayla
              </button>
            </div>
          )}
        </div>
      </Layout>
    );
  }

  // ─── WITHDRAW VIEW ───
  if (view === 'withdraw') {
    const isAllowed = (canWithdrawData as any)?.allowed ?? false;
    const consecutiveClicks = (canWithdrawData as any)?.consecutiveClicks ?? 0;
    const lastWithdrawalAt = (canWithdrawData as any)?.lastWithdrawalAt as Date | null;
    const hoursRemaining = lastWithdrawalAt
      ? Math.max(0, 72 - (Date.now() - new Date(lastWithdrawalAt).getTime()) / (1000 * 60 * 60))
      : 0;
    const clicksDone = Math.min(consecutiveClicks, 5);
    const clicksPercent = (clicksDone / 5) * 100;
    const monthlyCount = (canWithdrawData as any)?.monthlyCount ?? 0;
    const isFirstFree = (canWithdrawData as any)?.isFirstFree ?? false;
    const feePercent = (canWithdrawData as any)?.feePercent ?? 0;
    const daysSinceJoin = (canWithdrawData as any)?.daysSinceJoin ?? 0;
    const daysUntil30 = (canWithdrawData as any)?.daysUntil30 ?? 0;
    const is30DaysPassed = (canWithdrawData as any)?.is30DaysPassed ?? false;

    return (
      <Layout>
        <div className="grid gap-3 animate-fade-in">
          <div className="flex items-center gap-3 mb-2">
            <button onClick={() => setView('main')} className="btn-secondary" style={{ width: '36px', minHeight: '36px', padding: 0 }}><ArrowUpRight size={16} style={{ transform: 'rotate(-90deg)' }} /></button>
            <h1 className="text-xl font-bold text-white">Para Çek</h1>
          </div>

          {/* Restriction Cards */}
          <div className="grid gap-2">
            {/* 30 Days Free Withdrawal Info */}
            <div className="glass-card" style={{ background: is30DaysPassed ? 'rgba(16,185,129,0.06)' : 'rgba(255,215,0,0.04)', border: is30DaysPassed ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(255,215,0,0.15)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Calendar size={14} style={{ color: is30DaysPassed ? '#10b981' : '#FFD700' }} />
                <span className="text-xs font-bold" style={{ color: is30DaysPassed ? '#10b981' : '#FFD700' }}>Ücretsiz Çekim Durumu</span>
                {is30DaysPassed && <Check size={14} style={{ color: '#10b981' }} />}
              </div>
              <div className="flex items-center gap-2 mb-1">
                <div className="flex-1 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.min((daysSinceJoin / 30) * 100, 100)}%`, background: is30DaysPassed ? '#10b981' : '#FFD700' }} />
                </div>
                <span className="text-xs font-bold" style={{ color: is30DaysPassed ? '#10b981' : '#FFD700' }}>{daysSinceJoin}/30</span>
              </div>
              <p className="text-[10px]" style={{ color: '#8fa5b8' }}>
                {is30DaysPassed ? 'Aylık ilk çekiminiz ÜCRETSİZ! Sonrakilerde %5 kesinti.' : `İlk ücretsiz çekim için ${daysUntil30} gün kaldı. Şu anki çekimlerde %5 kesinti.`}
              </p>
            </div>

            {/* 5 Clicks */}
            <div className="glass-card" style={{ background: consecutiveClicks >= 5 ? 'rgba(16,185,129,0.06)' : 'rgba(255,215,0,0.04)', border: consecutiveClicks >= 5 ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(255,215,0,0.15)' }}>
              <div className="flex items-center gap-2 mb-2">
                <MousePointerClick size={14} style={{ color: consecutiveClicks >= 5 ? '#10b981' : '#FFD700' }} />
                <span className="text-xs font-bold" style={{ color: consecutiveClicks >= 5 ? '#10b981' : '#FFD700' }}>5 Gün Tıklama Şartı</span>
                {consecutiveClicks >= 5 && <Check size={14} style={{ color: '#10b981' }} />}
              </div>
              <div className="flex items-center gap-2 mb-1">
                <div className="flex-1 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${clicksPercent}%`, background: consecutiveClicks >= 5 ? '#10b981' : '#FFD700' }} />
                </div>
                <span className="text-xs font-bold" style={{ color: consecutiveClicks >= 5 ? '#10b981' : '#FFD700' }}>{clicksDone}/5</span>
              </div>
            </div>

            {/* 72h Cooldown */}
            {lastWithdrawalAt && hoursRemaining > 0 && (
              <div className="glass-card" style={{ background: 'rgba(255,215,0,0.04)', border: '1px solid rgba(255,215,0,0.15)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={14} style={{ color: '#FFD700' }} />
                  <span className="text-xs font-bold" style={{ color: '#FFD700' }}>72 Saat (3 Gün) Bekleme</span>
                </div>
                <p className="text-xs" style={{ color: '#8fa5b8' }}>Son çekimden sonra <strong style={{ color: '#FFD700' }}>{Math.ceil(hoursRemaining)} saat</strong> daha beklemelisiniz.</p>
              </div>
            )}

            {/* Monthly fee info */}
            <div className="glass-card" style={{ background: isFirstFree ? 'rgba(16,185,129,0.06)' : 'rgba(255,215,0,0.04)', border: isFirstFree ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(255,215,0,0.15)' }}>
              <div className="flex items-center gap-2 mb-1">
                <DollarSign size={14} style={{ color: isFirstFree ? '#10b981' : '#FFD700' }} />
                <span className="text-xs font-bold" style={{ color: isFirstFree ? '#10b981' : '#FFD700' }}>Aylık Çekim</span>
              </div>
              <p className="text-[10px]" style={{ color: '#8fa5b8' }}>Bu ay <strong style={{ color: '#FFD700' }}>{monthlyCount}</strong> çekim yapıldı.</p>
              <p className="text-[10px]" style={{ color: isFirstFree ? '#10b981' : '#ef4444' }}>{isFirstFree ? 'Bu ayki ilk çekiminiz ÜCRETSİZ!' : `Sonraki çekimlerde %${feePercent} kesinti.`}</p>
            </div>
          </div>

          <div className="glass-card">
            {withdrawSuccess ? (
              <div className="text-center py-6">
                <div className="mx-auto mb-3 grid place-items-center rounded-full" style={{ width: '56px', height: '56px', background: 'rgba(16,185,129,0.15)' }}><Check size={28} style={{ color: '#10b981' }} /></div>
                <p className="text-base font-bold text-white">Çekim talebiniz alındı!</p>
              </div>
            ) : (
              <>
                <div className="mb-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(248,251,255,0.08)' }}>
                  <span className="text-xs" style={{ color: '#8fa5b8' }}>Mevcut Bakiye</span>
                  <span className="text-lg font-extrabold text-white block">${Number(profile.balance).toFixed(2)}</span>
                </div>
                <div className="mb-3">
                  <label className="label-text block mb-2">E-posta Adresiniz</label>
                  <input type="email" value={withdrawEmail} onChange={(e) => setWithdrawEmail(e.target.value)} placeholder="E-posta adresinizi girin" className="glass-input" style={{ minHeight: '46px' }} required />
                </div>
                <div className="mb-3">
                  <label className="label-text block mb-2">Çekim Miktarı ($) <span className="text-[10px] font-normal" style={{ color: '#5a6a7a' }}>(Max: 20.000$)</span></label>
                  <input type="number" value={withdrawAmount} onChange={(e) => { const val = e.target.value; const n = Number(val); if (n > 20000) { setWithdrawAmount('20000'); const f = (canWithdrawData as any)?.feePercent ?? 5; const ff = (canWithdrawData as any)?.isFirstFree ?? false; setFeePreview(calculateFeePreview(20000, ff, f)); return; } setWithdrawAmount(val); const f = (canWithdrawData as any)?.feePercent ?? 5; const ff = (canWithdrawData as any)?.isFirstFree ?? false; if (n > 0) setFeePreview(calculateFeePreview(n, ff, f)); else setFeePreview(null); }} placeholder="Çekilecek miktar" max={20000} className="glass-input" style={{ minHeight: '46px' }} required />
                </div>
                {feePreview && feePreview.fee > 0 && (
                  <div className="mb-3 p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                    <div className="flex justify-between text-xs mb-1"><span style={{ color: '#8fa5b8' }}>Çekim Tutarı</span><span className="font-bold text-white">${feePreview.gross.toFixed(2)}</span></div>
                    <div className="flex justify-between text-xs mb-1"><span style={{ color: '#ef4444' }}>Kesinti (%{feePreview.feePercent})</span><span className="font-bold" style={{ color: '#ef4444' }}>-${feePreview.fee.toFixed(2)}</span></div>
                    <div className="h-px my-1" style={{ background: 'rgba(255,255,255,0.1)' }} />
                    <div className="flex justify-between text-xs"><span style={{ color: '#10b981' }}>Net Ödeme</span><span className="font-bold" style={{ color: '#10b981' }}>${feePreview.net.toFixed(2)}</span></div>
                  </div>
                )}
                {feePreview && feePreview.isFirstFree && (
                  <div className="mb-3 p-3 rounded-xl" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
                    <p className="text-xs font-bold" style={{ color: '#10b981' }}>Bu ayki ilk çekiminiz ÜCRETSİZ! Toplam: ${feePreview.gross.toFixed(2)}</p>
                  </div>
                )}
                <div className="mb-5">
                  <label className="label-text block mb-2">TRC20 Cüzdan Adresi</label>
                  <input type="text" value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)} placeholder="USDT (TRC20) adresi" className="glass-input" style={{ minHeight: '46px' }} required />
                </div>
                <button onClick={handleWithdraw} className="btn-primary" style={{ opacity: isAllowed ? 1 : 0.4 }} disabled={!isAllowed}>
                  {isAllowed ? 'Çekim Talebi Gönder' : 'Çekim Kısıtlı'}
                </button>
                {!isAllowed && <p className="text-xs mt-2 text-center" style={{ color: '#ef4444' }}>{(canWithdrawData as any)?.reason || 'Çekim şartlarını tamamlayın.'}</p>}
              </>
            )}
          </div>
        </div>
      </Layout>
    );
  }

  // ─── SUPPORT VIEW ───
  if (view === 'support') {
    if (activeTicket && currentTicket) {
      const isClosed = currentTicket.status === 'closed';
      return (
        <Layout>
          <div className="grid gap-3 animate-fade-in">
            <div className="flex items-center gap-3">
              <button onClick={() => setActiveTicket(null)} className="btn-secondary" style={{ width: '36px', minHeight: '36px', padding: 0 }}><ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} /></button>
              <div className="flex-1 min-w-0">
                <h1 className="text-base font-bold text-white truncate">{currentTicket.subject}</h1>
                <div className="flex items-center gap-2">{statusLabel(currentTicket.status)}<span className="text-[10px]" style={{ color: '#5a6a7a' }}>#{currentTicket.id}</span></div>
              </div>
              {currentTicket.status !== 'closed' && <button onClick={() => { handleCloseTicket(currentTicket.id); setActiveTicket(null); }} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}><X size={12} />Kapat</button>}
            </div>
            <div className="glass-card flex flex-col" style={{ minHeight: '300px', maxHeight: '400px' }}>
              <div className="flex-1 overflow-y-auto space-y-3 pr-1" style={{ maxHeight: '340px' }}>
                {currentTicket.messages.map((msg: any, i: number) => (
                  <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className="max-w-[80%] rounded-2xl px-4 py-2.5" style={{ background: msg.sender === 'user' ? 'linear-gradient(135deg, #FFD700, #FFA500)' : 'rgba(255,255,255,0.08)', color: msg.sender === 'user' ? '#04070d' : '#c8d6e5', borderBottomRightRadius: msg.sender === 'user' ? '4px' : '16px', borderBottomLeftRadius: msg.sender === 'admin' ? '4px' : '16px' }}>
                      <p className="text-sm">{msg.text}</p><span className="text-[10px] opacity-60 block mt-1">{msg.time}</span>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
            </div>
            {isClosed ? (
              <div className="glass-card text-center py-4">
                <Lock size={20} style={{ color: '#5a6a7a', margin: '0 auto' }} />
                <p className="text-sm mt-2" style={{ color: '#5a6a7a' }}>Bu destek talebi kapatılmıştır.</p>
              </div>
            ) : (
              <div className="flex gap-2"><input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} placeholder="Mesajınızı yazın..." className="glass-input flex-1" style={{ minHeight: '46px' }} /><button onClick={handleSendMessage} className="btn-primary" style={{ width: '46px', minHeight: '46px', padding: 0 }}><Send size={16} /></button></div>
            )}
          </div>
        </Layout>
      );
    }

    return (
      <Layout>
        <div className="grid gap-3 animate-fade-in">
          <div className="flex items-center gap-3 mb-2">
            <button onClick={() => setView('main')} className="btn-secondary" style={{ width: '36px', minHeight: '36px', padding: 0 }}><Headphones size={16} /></button>
            <h1 className="text-xl font-bold text-white">Destek</h1>
          </div>
          <div className="glass-card text-center py-6 cursor-pointer" style={{ background: 'rgba(0,136,204,0.08)', border: '1px solid rgba(0,136,204,0.2)' }} onClick={() => window.open('https://t.me/corevestsupport', '_blank')}>
            <div className="mx-auto mb-3 grid place-items-center rounded-full" style={{ width: '56px', height: '56px', background: 'rgba(0,136,204,0.15)' }}><ExternalLink size={24} style={{ color: '#0088CC' }} /></div>
            <p className="text-base font-bold text-white mb-1">Telegram Destek</p>
            <p className="text-sm" style={{ color: '#8fa5b8' }}>@corevestsupport</p>
          </div>
          <div className="flex items-center gap-3"><div className="flex-1 h-px" style={{ background: 'rgba(248,251,255,0.08)' }} /><span className="text-xs" style={{ color: '#5a6a7a' }}>veya</span><div className="flex-1 h-px" style={{ background: 'rgba(248,251,255,0.08)' }} /></div>
          {showNewTicket ? (
            <div className="glass-card">
              <div className="flex items-center justify-between mb-3"><h2 className="text-sm font-bold text-white">Yeni Destek Talebi</h2><button onClick={() => setShowNewTicket(false)} className="btn-secondary" style={{ minHeight: '32px', width: '32px', padding: 0 }}><X size={14} /></button></div>
              <div className="flex gap-2"><input type="text" value={newSubject} onChange={(e) => setNewSubject(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreateTicket()} placeholder="Sorununuzu kısaca yazın..." className="glass-input flex-1" style={{ minHeight: '44px' }} autoFocus /><button onClick={handleCreateTicket} className="btn-primary" style={{ width: '44px', minHeight: '44px', padding: 0 }}><Send size={16} /></button></div>
            </div>
          ) : (
            <button onClick={() => setShowNewTicket(true)} className="glass-card flex items-center gap-3 text-left transition-all w-full" style={{ background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.15)' }}>
              <div className="grid place-items-center rounded-xl" style={{ width: '42px', height: '42px', background: 'rgba(255,215,0,0.1)', color: '#FFD700' }}><Plus size={20} /></div>
              <div className="flex-1"><span className="text-sm font-bold text-white block">Yeni Destek Talebi Oluştur</span><span className="text-xs" style={{ color: '#8fa5b8' }}>Sorununuzu bizimle paylaşın</span></div>
              <ChevronRight size={16} style={{ color: '#5a6a7a' }} />
            </button>
          )}
          {tickets.length > 0 && <h3 className="text-xs font-bold mt-2" style={{ color: '#8fa5b8' }}>TALEPLERİNİZ</h3>}
          {tickets.map((ticket: any) => (
            <button key={ticket.id} onClick={() => setActiveTicket(ticket.id)} className="glass-card flex items-center gap-3 text-left w-full transition-all hover:bg-white/5" style={{ padding: '14px 16px' }}>
              <div className="grid place-items-center rounded-lg shrink-0" style={{ width: '42px', height: '42px', background: ticket.status === 'open' ? 'rgba(255,215,0,0.1)' : ticket.status === 'resolved' ? 'rgba(16,185,129,0.1)' : 'rgba(90,106,122,0.1)', color: ticket.status === 'open' ? '#FFD700' : ticket.status === 'resolved' ? '#10b981' : '#5a6a7a' }}>{ticket.status === 'closed' ? <Lock size={18} /> : <MessageCircle size={18} />}</div>
              <div className="flex-1 min-w-0"><span className="text-sm font-bold text-white block truncate">{ticket.subject}</span><div className="flex items-center gap-2">{statusLabel(ticket.status)}<span className="text-xs" style={{ color: '#5a6a7a' }}>{ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString() : ''}</span></div></div>
              <ChevronRight size={16} style={{ color: '#5a6a7a' }} />
            </button>
          ))}
          {tickets.length === 0 && !showNewTicket && <p className="text-sm text-center py-4" style={{ color: '#5a6a7a' }}>Henüz destek talebiniz bulunmuyor.</p>}
        </div>
      </Layout>
    );
  }

  // ─── HISTORY VIEW ───
  if (view === 'history') {
    return (
      <Layout>
        <div className="grid gap-3 animate-fade-in">
          <div className="flex items-center gap-3 mb-2">
            <button onClick={() => setView('main')} className="btn-secondary" style={{ width: '36px', minHeight: '36px', padding: 0 }}><Receipt size={16} /></button>
            <h1 className="text-xl font-bold text-white">Finansal Geçmiş</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setHistoryTab('withdrawals')} className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all" style={{ background: historyTab === 'withdrawals' ? 'rgba(255,215,0,0.12)' : 'rgba(255,255,255,0.04)', border: historyTab === 'withdrawals' ? '1px solid rgba(255,215,0,0.2)' : '1px solid rgba(248,251,255,0.06)', color: historyTab === 'withdrawals' ? '#FFD700' : '#8fa5b8' }}>Çekim Taleplerim</button>
            <button onClick={() => setHistoryTab('deposits')} className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all" style={{ background: historyTab === 'deposits' ? 'rgba(255,215,0,0.12)' : 'rgba(255,255,255,0.04)', border: historyTab === 'deposits' ? '1px solid rgba(255,215,0,0.2)' : '1px solid rgba(248,251,255,0.06)', color: historyTab === 'deposits' ? '#FFD700' : '#8fa5b8' }}>Yatırım İşlemlerim</button>
            <button onClick={() => setHistoryTab('bonuses')} className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all" style={{ background: historyTab === 'bonuses' ? 'rgba(255,215,0,0.12)' : 'rgba(255,255,255,0.04)', border: historyTab === 'bonuses' ? '1px solid rgba(255,215,0,0.2)' : '1px solid rgba(248,251,255,0.06)', color: historyTab === 'bonuses' ? '#FFD700' : '#8fa5b8' }}>Bonuslar</button>
          </div>

          {historyTab === 'withdrawals' && (
            <div className="grid gap-2">
              {withdrawals.length === 0 ? <p className="text-sm text-center py-8" style={{ color: '#5a6a7a' }}>Henüz çekim talebiniz bulunmuyor.</p> : withdrawals.map((w: any) => (
                <div key={w.id} className="glass-card" style={{ padding: '14px 16px' }}>
                  <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2"><span className="text-sm font-bold text-white">${Number(w.amount).toFixed(2)}</span>{statusLabel(w.status)}</div><span className="text-xs" style={{ color: '#5a6a7a' }}>{w.createdAt ? new Date(w.createdAt).toLocaleDateString() : ''}</span></div>
                  <p className="text-xs font-mono mb-2" style={{ color: '#8fa5b8' }}>{w.wallet}</p>
                  {w.status === 'pending' && <button onClick={() => handleCancelWithdraw(w.id)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}><Ban size={12} />İptal Et</button>}
                </div>
              ))}
            </div>
          )}

          {historyTab === 'deposits' && (
            <div className="grid gap-2">
              {deposits.length === 0 ? <p className="text-sm text-center py-8" style={{ color: '#5a6a7a' }}>Henüz yatırım işleminiz bulunmuyor.</p> : deposits.map((d: any) => (
                <div key={d.id} className="glass-card flex items-center gap-3" style={{ padding: '14px 16px' }}>
                  <div className="grid place-items-center rounded-lg shrink-0" style={{ width: '38px', height: '38px', background: 'rgba(16,185,129,0.1)', color: '#10b981' }}><ArrowDownLeft size={16} /></div>
                  <div className="flex-1 min-w-0"><div className="flex items-center gap-2"><span className="text-sm font-bold text-white">${Number(d.amount).toFixed(2)}</span>{statusLabel(d.status)}</div><span className="text-xs font-mono" style={{ color: '#8fa5b8' }}>{d.txid}</span>{d.userNote && <p className="text-[10px] mt-0.5" style={{ color: '#5a6a7a' }}>Not: {d.userNote}</p>}</div>
                  <span className="text-xs shrink-0" style={{ color: '#5a6a7a' }}>{d.createdAt ? new Date(d.createdAt).toLocaleDateString() : ''}</span>
                </div>
              ))}
            </div>
          )}

          {historyTab === 'bonuses' && (
            <div className="grid gap-2">
              {wheelHistory.length === 0 ? <p className="text-sm text-center py-8" style={{ color: '#5a6a7a' }}>Henüz çark bonusunuz bulunmuyor.</p> : wheelHistory.map((spin: any) => (
                <div key={spin.id} className="glass-card flex items-center gap-3" style={{ padding: '14px 16px' }}>
                  <div className="grid place-items-center rounded-lg shrink-0" style={{ width: '38px', height: '38px', background: 'rgba(255,215,0,0.1)', color: '#FFD700' }}><Gift size={16} /></div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-bold text-white block">Çark Ödülü</span>
                    <span className="text-xs" style={{ color: '#8fa5b8' }}>{spin.createdAt ? new Date(spin.createdAt).toLocaleDateString() : ''}</span>
                  </div>
                  <span className="text-sm font-extrabold" style={{ color: '#FFD700' }}>+${Number(spin.prize).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Layout>
    );
  }

  // ─── MAIN VIEW ───
  return (
    <Layout>
      <div className="grid gap-3">
        {/* User ID Card */}
        <div className="glass-card text-center py-6">
          <div className="mx-auto mb-3 grid place-items-center rounded-full" style={{ width: '72px', height: '72px', background: 'linear-gradient(135deg, #FFD70020, #FFA50020)', border: '2px solid rgba(255,215,0,0.2)' }}>
            <User size={32} style={{ color: '#FFD700' }} />
          </div>
          <h1 className="text-xl font-bold text-white mb-1">Hesabım</h1>
          {/* USER ID - matches admin panel */}
          <p className="text-sm font-mono font-bold" style={{ color: '#FFD700' }}>ID: {userId}</p>
          <p className="text-xs mt-1" style={{ color: '#5a6a7a' }}>Üyelik: {profile.joinDate ? new Date(profile.joinDate).toLocaleDateString() : ''}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="glass-card">
            <div className="flex items-center gap-2 mb-2"><div className="grid place-items-center rounded-xl" style={{ width: '38px', height: '38px', color: '#FFD700', background: 'rgba(255,215,0,0.1)' }}><Crown size={18} /></div></div>
            <span className="text-xs font-medium" style={{ color: '#8fa5b8' }}>VIP Seviyesi</span>
            <strong className="block text-xl mt-1" style={{ color: '#FFD700' }}>VIP {vipLevel}</strong>
          </div>
          <div className="glass-card">
            <div className="flex items-center gap-2 mb-2"><div className="grid place-items-center rounded-xl" style={{ width: '38px', height: '38px', color: '#FFD700', background: 'rgba(255,215,0,0.1)' }}><Wallet size={18} /></div></div>
            <span className="text-xs font-medium" style={{ color: '#8fa5b8' }}>Bakiye</span>
            <strong className="block text-xl text-white mt-1">${Number(profile.balance).toFixed(2)}</strong>
          </div>
        </div>

        <div className="glass-card flex items-center gap-3">
          <div className="grid place-items-center rounded-xl" style={{ width: '42px', height: '42px', color: '#FFD700', background: 'rgba(255,215,0,0.1)' }}><ArrowDownLeft size={20} /></div>
          <div className="flex-1"><span className="text-xs font-medium" style={{ color: '#8fa5b8' }}>Toplam Yatırım</span><strong className="block text-base text-white">${Number(profile.investment).toLocaleString()}</strong></div>
        </div>

        <div className="glass-card">
          <h2 className="text-base font-bold text-white mb-4">İşlemler</h2>
          <div className="grid gap-2">
            {[
              { key: 'deposit', label: 'Para Yatır', icon: ArrowDownLeft, color: '#10b981', onClick: () => setView('deposit') },
              { key: 'withdraw', label: 'Para Çek', icon: ArrowUpRight, color: '#FFD700', onClick: () => setView('withdraw') },
              { key: 'history', label: 'Finansal Geçmiş', icon: Receipt, color: '#8b5cf6', onClick: () => setView('history') },
              { key: 'support', label: 'Destek', icon: Headphones, color: '#35d7ff', onClick: () => setView('support') },
              { key: 'logout', label: 'Çıkış Yap', icon: LogOut, color: '#ef4444', onClick: () => setShowLogout(true) },
            ].map((action) => {
              const Icon = action.icon;
              return (
                <button key={action.key} onClick={action.onClick} className="flex items-center gap-3 rounded-xl px-4 py-3.5 text-left transition-all hover:bg-white/5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(248,251,255,0.05)' }}>
                  <div className="grid place-items-center rounded-lg shrink-0" style={{ width: '40px', height: '40px', background: `${action.color}15`, color: action.color }}><Icon size={18} /></div>
                  <span className="flex-1 text-sm font-bold text-white">{action.label}</span>
                  <ChevronRight size={16} style={{ color: '#5a6a7a' }} />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {showLogout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-sm animate-fade-in" style={{ background: 'rgba(5, 9, 20, 0.95)', border: '1px solid rgba(248,251,255,0.1)', borderRadius: '22px', padding: '24px', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
            <div className="text-center mb-5"><div className="mx-auto mb-3 grid place-items-center rounded-full" style={{ width: '56px', height: '56px', background: 'rgba(239,68,68,0.12)' }}><LogOut size={28} style={{ color: '#ef4444' }} /></div><h3 className="text-lg font-bold text-white mb-1">Çıkış Yap</h3><p className="text-sm" style={{ color: '#8fa5b8' }}>Çıkış yapmak istediğinize emin misiniz?</p></div>
            <div className="flex gap-3"><button onClick={() => setShowLogout(false)} className="btn-secondary flex-1">İptal</button><button onClick={handleLogout} className="flex-1 inline-flex items-center justify-center gap-2 font-extrabold text-sm rounded-xl text-white" style={{ minHeight: '46px', background: 'rgba(239,68,68,0.85)' }}><LogOut size={16} />Çıkış Yap</button></div>
          </div>
        </div>
      )}
    </Layout>
  );
}
