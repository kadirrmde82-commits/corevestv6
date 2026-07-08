import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  User, Users, Crown, Wallet, ArrowDownLeft, ArrowUpRight,
  Headphones, LogOut, ChevronRight, Clock, Check,
  Copy, MessageCircle, Lock, X, Receipt, Ban,
  ExternalLink, Plus, Send, MousePointerClick,
  DollarSign, Calendar, Gift, Download, AlertCircle,
} from 'lucide-react';
import Layout from '../components/Layout';
import { trpc } from '@/providers/trpc';

type ActionView = 'main' | 'deposit' | 'withdraw' | 'support' | 'history';
type HistoryTab = 'deposits' | 'withdrawals' | 'clicks' | 'bonuses' | 'referrals';
const MIN_WITHDRAWAL_AMOUNT = 50;
const MAX_WITHDRAWAL_AMOUNT = 20000;
const MIN_DEPOSIT_AMOUNT = 50;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

// Wallet addresses are fetched from API now

export default function Account() {
  const { t } = useTranslation();
  const [view, setView] = useState<ActionView>('main');
  const [historyTab, setHistoryTab] = useState<HistoryTab>('withdrawals');
  const [showLogout, setShowLogout] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [installMessage, setInstallMessage] = useState('');

  const { data: profile } = trpc.profile.me.useQuery(undefined, {
    staleTime: 1000 * 10,
    refetchInterval: 1000 * 30,
    retry: false,
  });
  const { data: walletAddresses = [] } = trpc.walletAddress.list.useQuery(undefined, {
    staleTime: 1000 * 60,
    retry: 2,
  });
  const { data: deposits = [] } = trpc.deposit.list.useQuery(undefined, {
    staleTime: 1000 * 10,
    refetchInterval: view === 'deposit' || historyTab === 'deposits' ? 1000 * 30 : false,
    retry: false,
  });
  const { data: withdrawals = [] } = trpc.withdrawal.list.useQuery(undefined, {
    staleTime: 1000 * 10,
    refetchInterval: view === 'withdraw' || historyTab === 'withdrawals' ? 1000 * 30 : false,
    retry: false,
  });
  const { data: tickets = [] } = trpc.ticket.list.useQuery(undefined, {
    staleTime: 1000 * 10,
    refetchInterval: view === 'support' ? 1000 * 20 : false,
    retry: false,
  });
  const { data: wheelHistory = [] } = trpc.wheel.list.useQuery(undefined, {
    staleTime: 1000 * 10,
    refetchInterval: historyTab === 'bonuses' ? 1000 * 30 : false,
    retry: false,
  });
  const { data: referralEarnings = [] } = trpc.referral.earningsList.useQuery(undefined, {
    staleTime: 1000 * 10,
    refetchInterval: historyTab === 'referrals' ? 1000 * 30 : false,
    retry: false,
  });
  const { data: clickEarnings = [] } = trpc.click.history.useQuery(undefined, {
    staleTime: 1000 * 10,
    refetchInterval: historyTab === 'clicks' ? 1000 * 30 : false,
    retry: false,
  });

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setInstallMessage(t('accountExtra.appInstalled'));
      setShowInstallHelp(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [t]);

  const isStandaloneApp = () => {
    return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  };

  const isIosDevice = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);

  const handleInstallApp = async () => {
    setInstallMessage('');

    if (isStandaloneApp()) {
      setInstallMessage(t('accountExtra.appInstalled'));
      return;
    }

    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setInstallMessage(t('accountExtra.appInstalled'));
      }
      setInstallPrompt(null);
      return;
    }

    setShowInstallHelp(true);
  };

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
    onMutate: async (input) => {
      await utils.deposit.list.cancel();
      const previousDeposits = utils.deposit.list.getData();
      const tempId = -Date.now();
      const ownPublicId = Number((profile as any)?.publicId ?? (profile as any)?.userId ?? 0);
      const isOwnDeposit = !input.targetPublicId || input.targetPublicId === ownPublicId;

      if (isOwnDeposit) utils.deposit.list.setData(undefined, (current) => [{
        id: tempId,
        amount: String(input.amount),
        txid: 'Gönderiliyor...',
        email: input.email,
        cryptoType: input.cryptoType,
        status: 'pending',
        createdAt: new Date(),
      } as any, ...(current ?? [])]);

      setDepositStatus('checking');
      return { previousDeposits, tempId };
    },
    onSuccess: (result, _variables, context) => {
      if (context?.tempId) {
        utils.deposit.list.setData(undefined, (current) => (current ?? []).map((item: any) => (
          item.id === context.tempId ? { ...item, id: result.id, txid: result.txid } : item
        )));
      }
    },
    onError: (error, _variables, context) => {
      if (context?.previousDeposits) utils.deposit.list.setData(undefined, context.previousDeposits);
      setDepositStatus('idle');
      setDepositError(error.message || 'Hatalı bilgi girdiniz. Lütfen bilgileri kontrol edip tekrar deneyin.');
      alert(error.message || 'Yatırım talebi gönderilemedi. Lütfen tekrar deneyin.');
    },
    onSettled: () => {
      utils.deposit.list.invalidate();
    },
  });

  // Withdrawal mutations
  const withdrawMutation = trpc.withdrawal.create.useMutation({
    onMutate: async (input) => {
      await Promise.all([
        utils.withdrawal.list.cancel(),
        utils.profile.me.cancel(),
      ]);

      const previousWithdrawals = utils.withdrawal.list.getData();
      const previousProfile = utils.profile.me.getData();
      const tempId = -Date.now();
      const feePercent = feePreview?.feePercent ?? 0;
      const totalDeduction = (feePreview?.isFirstFree ?? false) ? input.amount : input.amount + (input.amount * feePercent) / 100;

      utils.withdrawal.list.setData(undefined, (current) => [{
        id: tempId,
        amount: String(input.amount),
        email: input.email,
        wallet: input.wallet,
        status: 'pending',
        createdAt: new Date(),
      } as any, ...(current ?? [])]);

      utils.profile.me.setData(undefined, (current: any) => current ? {
        ...current,
        balance: String(Math.max(0, Number(current.balance || 0) - totalDeduction)),
        consecutiveClicks: 0,
      } : current);

      setWithdrawSuccess(true);
      setTimeout(() => {
        setWithdrawSuccess(false);
        setWithdrawAmount('');
        setWalletAddress('');
        setWithdrawEmail('');
        setView('main');
      }, 2000);

      return { previousWithdrawals, previousProfile, tempId };
    },
    onSuccess: (result, _variables, context) => {
      if (context?.tempId) {
        utils.withdrawal.list.setData(undefined, (current) => (current ?? []).map((item: any) => (
          item.id === context.tempId ? { ...item, id: result.id } : item
        )));
      }
    },
    onError: (error, _variables, context) => {
      if (context?.previousWithdrawals) utils.withdrawal.list.setData(undefined, context.previousWithdrawals);
      if (context?.previousProfile) utils.profile.me.setData(undefined, context.previousProfile);
      setWithdrawSuccess(false);
      alert(error.message || 'Çekim talebi gönderilemedi. Lütfen tekrar deneyin.');
    },
    onSettled: () => {
      utils.withdrawal.list.invalidate();
      utils.profile.me.invalidate();
    },
  });
  const cancelWithdrawMutation = trpc.withdrawal.cancel.useMutation({
    onMutate: async ({ id }) => {
      await Promise.all([
        utils.withdrawal.list.cancel(),
        utils.profile.me.cancel(),
      ]);

      const previousWithdrawals = utils.withdrawal.list.getData();
      const previousProfile = utils.profile.me.getData();
      const withdrawal = previousWithdrawals?.find((item: any) => item.id === id);

      if (withdrawal?.status === 'pending') {
        utils.withdrawal.list.setData(undefined, (current) => (current ?? []).map((item: any) => (
          item.id === id ? { ...item, status: 'cancelled' } : item
        )));

        utils.profile.me.setData(undefined, (current: any) => current ? {
          ...current,
          balance: String(Number(current.balance || 0) + Number(withdrawal.amount || 0)),
        } : current);
      }

      return { previousWithdrawals, previousProfile };
    },
    onError: (error, _variables, context) => {
      if (context?.previousWithdrawals) utils.withdrawal.list.setData(undefined, context.previousWithdrawals);
      if (context?.previousProfile) utils.profile.me.setData(undefined, context.previousProfile);
      alert(error.message || 'Çekim iptal edilemedi. Lütfen tekrar deneyin.');
    },
    onSettled: () => {
      utils.withdrawal.list.invalidate();
      utils.profile.me.invalidate();
    },
  });

  // Ticket mutations
  const createTicketMutation = trpc.ticket.create.useMutation({
    onMutate: async (input) => {
      await utils.ticket.list.cancel();
      const previousTickets = utils.ticket.list.getData();
      const tempId = -Date.now();
      utils.ticket.list.setData(undefined, (current) => [{
        id: tempId,
        subject: input.subject,
        status: 'open',
        createdAt: new Date(),
        messages: [{
          id: tempId,
          sender: 'user',
          text: input.subject,
          time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' }),
          createdAt: new Date(),
        }],
      } as any, ...(current ?? [])]);
      setNewSubject('');
      setShowNewTicket(false);
      return { previousTickets, tempId };
    },
    onSuccess: (result, _variables, context) => {
      if (context?.tempId) {
        utils.ticket.list.setData(undefined, (current) => (current ?? []).map((ticket: any) => (
          ticket.id === context.tempId ? { ...ticket, id: result.id, messages: ticket.messages.map((message: any) => ({ ...message, id: result.id })) } : ticket
        )));
      }
    },
    onError: (error, _variables, context) => {
      if (context?.previousTickets) utils.ticket.list.setData(undefined, context.previousTickets);
      alert(error.message || 'Destek talebi oluşturulamadı. Lütfen tekrar deneyin.');
    },
    onSettled: () => {
      utils.ticket.list.invalidate();
    },
  });
  const addMessageMutation = trpc.ticket.addMessage.useMutation({
    onMutate: async (input) => {
      await utils.ticket.list.cancel();
      const previousTickets = utils.ticket.list.getData();
      const tempId = -Date.now();
      utils.ticket.list.setData(undefined, (current) => (current ?? []).map((ticket: any) => (
        ticket.id === input.ticketId
          ? {
              ...ticket,
              messages: [...(ticket.messages ?? []), {
                id: tempId,
                sender: 'user',
                text: input.text,
                time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' }),
                createdAt: new Date(),
              }],
            }
          : ticket
      )));
      setNewMessage('');
      return { previousTickets };
    },
    onError: (error, _variables, context) => {
      if (context?.previousTickets) utils.ticket.list.setData(undefined, context.previousTickets);
      alert(error.message || 'Mesaj gönderilemedi. Lütfen tekrar deneyin.');
    },
    onSettled: () => {
      utils.ticket.list.invalidate();
    },
  });
  const closeTicketMutation = trpc.ticket.close.useMutation({
    onMutate: async ({ ticketId }) => {
      await utils.ticket.list.cancel();
      const previousTickets = utils.ticket.list.getData();
      utils.ticket.list.setData(undefined, (current) => (current ?? []).map((ticket: any) => (
        ticket.id === ticketId ? { ...ticket, status: 'closed' } : ticket
      )));
      return { previousTickets };
    },
    onError: (error, _variables, context) => {
      if (context?.previousTickets) utils.ticket.list.setData(undefined, context.previousTickets);
      alert(error.message || 'Destek talebi kapatılamadı. Lütfen tekrar deneyin.');
    },
    onSettled: () => {
      utils.ticket.list.invalidate();
    },
  });

  // Deposit
  const [depositAmount, setDepositAmount] = useState('');
  const [depositEmail, setDepositEmail] = useState('');
  const [depositTargetId, setDepositTargetId] = useState('');
  const [depositError, setDepositError] = useState('');
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
  const hasDepositAddress = Boolean(selectedCrypto?.address);
  const currentPublicId = String((profile as any)?.publicId ?? (profile as any)?.userId ?? '');

  useEffect(() => {
    if (currentPublicId && !depositTargetId) {
      setDepositTargetId(currentPublicId);
    }
  }, [currentPublicId, depositTargetId]);

  const handleCopyAddress = () => {
    if (!selectedCrypto.address) return;
    navigator.clipboard.writeText(selectedCrypto.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDeposit = () => {
    setDepositError('');
    const emailValue = depositEmail.trim();
    const amountValue = Number(depositAmount);
    const targetPublicId = Number(depositTargetId || currentPublicId);
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue);

    if (!amountValue || amountValue < MIN_DEPOSIT_AMOUNT) {
      setDepositError('Minimum yatırım tutarı 50$ olmalıdır.');
      return;
    }

    if (!amountValue || amountValue < MIN_DEPOSIT_AMOUNT) {
      setDepositError('Lütfen geçerli bir yatırım tutarı yazın.');
      return;
    }
    if (!emailValid) {
      setDepositError('E-posta adresi hatalı. Lütfen doğru e-posta yazıp tekrar deneyin.');
      return;
    }
    if (!Number.isInteger(targetPublicId) || targetPublicId <= 0) {
      setDepositError('Üye ID hatalı. Lütfen Hesabım bölümündeki ID formatında tekrar yazın.');
      return;
    }
    if (!hasDepositAddress) {
      setDepositError('YatÄ±rÄ±m adresi bulunamadÄ±. LÃ¼tfen daha sonra tekrar deneyin veya destek ile iletiÅŸime geÃ§in.');
      return;
    }
    if (depositMutation.isPending) return;

    setDepositStatus('checking');
    depositMutation.mutate({
      amount: amountValue,
      email: emailValue,
      cryptoType: depositCrypto as 'trc20' | 'sol' | 'trx' | 'eth',
      targetPublicId,
    });
  };

  const handleWithdraw = () => {
    if (!withdrawAmount || Number(withdrawAmount) < MIN_WITHDRAWAL_AMOUNT || !walletAddress || !withdrawEmail) return;
    if (!profile) return;
    withdrawMutation.mutate({
      amount: Number(withdrawAmount),
      email: withdrawEmail,
      wallet: walletAddress,
    });
  };

  const handleCancelWithdraw = (id: number) => {
    if (cancelWithdrawMutation.isPending) return;
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
      pending: { text: t('accountExtra.status.pending'), color: '#FFD700', bg: 'rgba(255,215,0,0.12)' },
      approved: { text: t('accountExtra.status.approved'), color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
      rejected: { text: t('accountExtra.status.rejected'), color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
      cancelled: { text: t('accountExtra.status.cancelled'), color: '#5a6a7a', bg: 'rgba(90,106,122,0.15)' },
      open: { text: t('accountExtra.status.pending'), color: '#FFD700', bg: 'rgba(255,215,0,0.12)' },
      resolved: { text: t('accountExtra.status.resolved'), color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
      closed: { text: t('accountExtra.status.closed'), color: '#5a6a7a', bg: 'rgba(90,106,122,0.15)' },
    };
    const s = map[status] || map.pending;
    return <span className="text-[10px] font-extrabold px-2 py-1 rounded-full" style={{ background: s.bg, color: s.color }}>{s.text}</span>;
  };

  if (!profile) return null;

  const userId = (profile as any).publicId ?? (profile as any).userId ?? 0;
  const userEmail = (profile as any).email ?? '';
  const earningsSummary = (profile as any).earningsSummary ?? { today: 0, yesterday: 0, total: Number(profile.totalEarned || 0) };
  const vipLevel = Number((profile as any).vipLevel || 0);

  // ─── DEPOSIT VIEW ───
  if (view === 'deposit') {
    return (
      <Layout>
        <div className="grid gap-3 animate-fade-in">
          <div className="flex items-center gap-3 mb-2">
            <button onClick={() => { setView('main'); setDepositStatus('idle'); setDepositAmount(''); setDepositError(''); setDepositTargetId(currentPublicId); }} className="btn-secondary" style={{ width: '36px', minHeight: '36px', padding: 0 }}><ArrowDownLeft size={16} style={{ transform: 'rotate(90deg)' }} /></button>
            <h1 className="text-xl font-bold text-white">{t('accountExtra.deposit.title')}</h1>
          </div>
          {depositStatus === 'checking' ? (
            <div className="glass-card text-center py-10">
              <div className="mx-auto mb-4 grid place-items-center rounded-full animate-pulse" style={{ width: '64px', height: '64px', background: 'rgba(255,215,0,0.1)' }}><Clock size={32} style={{ color: '#FFD700' }} /></div>
              <p className="text-base font-bold text-white mb-2">{t('accountExtra.deposit.checkingTitle')}</p>
              <p className="text-sm" style={{ color: '#8fa5b8' }}>{t('accountExtra.deposit.checkingText')}</p>
              <button onClick={() => { setView('main'); setDepositAmount(''); setDepositEmail(''); setDepositError(''); setDepositTargetId(currentPublicId); setDepositStatus('idle'); }} className="btn-secondary mt-4">{t('accountExtra.ok')}</button>
            </div>
          ) : (
            <div className="grid gap-3">
              {/* Email (required) */}
              <div className="glass-card">
                <label className="label-text block mb-2">{t('accountExtra.emailAddress')} <span style={{ color: '#ef4444' }}>*</span></label>
                <input type="email" value={depositEmail} onChange={(e) => { setDepositEmail(e.target.value); setDepositError(''); }} placeholder={t('accountExtra.emailPlaceholder')} className="glass-input" style={{ minHeight: '46px' }} required />
              </div>

              {/* Target Member ID */}
              <div className="glass-card">
                <label className="label-text block mb-2">Yatırım yapılacak üye ID <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  type="number"
                  value={depositTargetId}
                  onChange={(e) => { setDepositTargetId(e.target.value.replace(/\D/g, '')); setDepositError(''); }}
                  placeholder={currentPublicId || 'Üye ID'}
                  className="glass-input"
                  style={{ minHeight: '46px' }}
                  required
                />
                <p className="text-[10px] mt-2" style={{ color: '#8fa5b8' }}>
                  Kendi ID'niz: #{currentPublicId}. Başka bir üyeye yatırım yapmak için onun ID'sini yazabilirsiniz.
                </p>
              </div>

              {/* Crypto Selector */}
              <div className="glass-card">
                <label className="label-text block mb-2">{t('accountExtra.deposit.cryptoSelect')}</label>
                {walletAddresses.length === 0 ? (
                  <div className="rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)' }}>
                    <p className="text-xs font-bold" style={{ color: '#ef4444' }}>
                      YatÄ±rÄ±m adresi bulunamadÄ±. Admin panelinden CÃ¼zdan Adresleri bÃ¶lÃ¼mÃ¼ne en az 1 aktif adres eklenmelidir.
                    </p>
                  </div>
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
                <label className="label-text block mb-2">{t('accountExtra.deposit.amount')} ($) <span className="text-[10px] font-normal" style={{ color: '#5a6a7a' }}>(Min: 50$)</span></label>
                <input type="number" value={depositAmount} onChange={(e) => { setDepositAmount(e.target.value); setDepositError(''); }} placeholder="Minimum 50" min={MIN_DEPOSIT_AMOUNT} className="glass-input" style={{ minHeight: '46px' }} />
              </div>

              {/* Wallet Address */}
              <div className="glass-card" style={{ border: `1px solid ${selectedCrypto.color}30`, background: `${selectedCrypto.color}08` }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="rounded-full" style={{ width: '10px', height: '10px', background: selectedCrypto.color }} />
                  <span className="text-sm font-bold" style={{ color: selectedCrypto.color }}>{selectedCrypto.label}</span>
                </div>
                <p className="text-xs mb-3" style={{ color: '#8fa5b8' }}>{t('accountExtra.deposit.sendToAddress')}</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 text-xs font-mono truncate rounded-xl px-3 py-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(248,251,255,0.1)', color: '#c8d6e5' }}>{selectedCrypto.address}</div>
                  <button onClick={handleCopyAddress} className="btn-secondary" style={{ minHeight: '42px', width: '42px', padding: 0 }}>{copied ? <Check size={16} /> : <Copy size={16} />}</button>
                </div>
                {copied && <p className="text-xs mt-2 text-center" style={{ color: '#10b981' }}>{t('accountExtra.copied')}</p>}
              </div>

              {/* Warning Message */}
              <div className="rounded-xl p-3" style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)' }}>
                <p className="text-xs font-bold text-center" style={{ color: '#FFD700' }}>
                  {t('accountExtra.deposit.warning')}
                </p>
              </div>

              {depositError && (
                <div className="rounded-xl p-3 flex items-start gap-2" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.22)' }}>
                  <AlertCircle size={16} style={{ color: '#ef4444', flexShrink: 0, marginTop: 1 }} />
                  <p className="text-xs font-bold" style={{ color: '#ef4444' }}>{depositError}</p>
                </div>
              )}

              <button onClick={handleDeposit} className="btn-primary" disabled={!depositAmount || !depositEmail.trim() || !depositTargetId || !hasDepositAddress || depositMutation.isPending} style={{ opacity: (!depositAmount || !depositEmail.trim() || !depositTargetId || !hasDepositAddress || depositMutation.isPending) ? 0.4 : 1 }}>
                {depositMutation.isPending ? t('accountExtra.deposit.sending') : t('accountExtra.deposit.confirm')}
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
            <h1 className="text-xl font-bold text-white">{t('accountExtra.withdraw.title')}</h1>
          </div>

          {/* Restriction Cards */}
          <div className="grid gap-2">
            {/* 30 Days Free Withdrawal Info */}
            <div className="glass-card" style={{ background: is30DaysPassed ? 'rgba(16,185,129,0.06)' : 'rgba(255,215,0,0.04)', border: is30DaysPassed ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(255,215,0,0.15)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Calendar size={14} style={{ color: is30DaysPassed ? '#10b981' : '#FFD700' }} />
                <span className="text-xs font-bold" style={{ color: is30DaysPassed ? '#10b981' : '#FFD700' }}>{t('accountExtra.withdraw.freeStatus')}</span>
                {is30DaysPassed && <Check size={14} style={{ color: '#10b981' }} />}
              </div>
              <div className="flex items-center gap-2 mb-1">
                <div className="flex-1 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.min((daysSinceJoin / 30) * 100, 100)}%`, background: is30DaysPassed ? '#10b981' : '#FFD700' }} />
                </div>
                <span className="text-xs font-bold" style={{ color: is30DaysPassed ? '#10b981' : '#FFD700' }}>{daysSinceJoin}/30</span>
              </div>
              <p className="text-[10px]" style={{ color: '#8fa5b8' }}>
                {is30DaysPassed ? t('accountExtra.withdraw.freeReady') : t('accountExtra.withdraw.freeWait', { days: daysUntil30 })}
              </p>
            </div>

            {/* 5 Clicks */}
            <div className="glass-card" style={{ background: consecutiveClicks >= 5 ? 'rgba(16,185,129,0.06)' : 'rgba(255,215,0,0.04)', border: consecutiveClicks >= 5 ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(255,215,0,0.15)' }}>
              <div className="flex items-center gap-2 mb-2">
                <MousePointerClick size={14} style={{ color: consecutiveClicks >= 5 ? '#10b981' : '#FFD700' }} />
                <span className="text-xs font-bold" style={{ color: consecutiveClicks >= 5 ? '#10b981' : '#FFD700' }}>{t('accountExtra.withdraw.clickRequirement')}</span>
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
                  <span className="text-xs font-bold" style={{ color: '#FFD700' }}>{t('accountExtra.withdraw.cooldownTitle')}</span>
                </div>
                <p className="text-xs" style={{ color: '#8fa5b8' }}>{t('accountExtra.withdraw.cooldownText', { hours: Math.ceil(hoursRemaining) })}</p>
              </div>
            )}

            {/* Monthly fee info */}
            <div className="glass-card" style={{ background: isFirstFree ? 'rgba(16,185,129,0.06)' : 'rgba(255,215,0,0.04)', border: isFirstFree ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(255,215,0,0.15)' }}>
              <div className="flex items-center gap-2 mb-1">
                <DollarSign size={14} style={{ color: isFirstFree ? '#10b981' : '#FFD700' }} />
                <span className="text-xs font-bold" style={{ color: isFirstFree ? '#10b981' : '#FFD700' }}>{t('accountExtra.withdraw.monthlyWithdrawal')}</span>
              </div>
              <p className="text-[10px]" style={{ color: '#8fa5b8' }}>{t('accountExtra.withdraw.monthlyCount', { count: monthlyCount })}</p>
              <p className="text-[10px]" style={{ color: isFirstFree ? '#10b981' : '#ef4444' }}>{isFirstFree ? t('accountExtra.withdraw.firstFree') : t('accountExtra.withdraw.nextFee', { percent: feePercent })}</p>
            </div>
          </div>

          <div className="glass-card">
            {withdrawSuccess ? (
              <div className="text-center py-6">
                <div className="mx-auto mb-3 grid place-items-center rounded-full" style={{ width: '56px', height: '56px', background: 'rgba(16,185,129,0.15)' }}><Check size={28} style={{ color: '#10b981' }} /></div>
                <p className="text-base font-bold text-white">{t('accountExtra.withdraw.success')}</p>
              </div>
            ) : (
              <>
                <div className="mb-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(248,251,255,0.08)' }}>
                  <span className="text-xs" style={{ color: '#8fa5b8' }}>{t('accountExtra.currentBalance')}</span>
                  <span className="text-lg font-extrabold text-white block">${Number(profile.balance).toFixed(2)}</span>
                </div>
                <div className="mb-3">
                  <label className="label-text block mb-2">{t('accountExtra.emailAddress')}</label>
                  <input type="email" value={withdrawEmail} onChange={(e) => setWithdrawEmail(e.target.value)} placeholder={t('accountExtra.emailPlaceholder')} className="glass-input" style={{ minHeight: '46px' }} required />
                </div>
                <div className="mb-3">
                  <label className="label-text block mb-2">{t('accountExtra.withdraw.amount')} ($) <span className="text-[10px] font-normal" style={{ color: '#5a6a7a' }}>{t('accountExtra.withdraw.minMax')}</span></label>
                  <input type="number" value={withdrawAmount} onChange={(e) => { const val = e.target.value; const n = Number(val); if (n > MAX_WITHDRAWAL_AMOUNT) { setWithdrawAmount(String(MAX_WITHDRAWAL_AMOUNT)); const f = (canWithdrawData as any)?.feePercent ?? 5; const ff = (canWithdrawData as any)?.isFirstFree ?? false; setFeePreview(calculateFeePreview(MAX_WITHDRAWAL_AMOUNT, ff, f)); return; } setWithdrawAmount(val); const f = (canWithdrawData as any)?.feePercent ?? 5; const ff = (canWithdrawData as any)?.isFirstFree ?? false; if (n >= MIN_WITHDRAWAL_AMOUNT) setFeePreview(calculateFeePreview(n, ff, f)); else setFeePreview(null); }} placeholder={t('accountExtra.withdraw.amountPlaceholder')} min={MIN_WITHDRAWAL_AMOUNT} max={MAX_WITHDRAWAL_AMOUNT} className="glass-input" style={{ minHeight: '46px' }} required />
                  {withdrawAmount && Number(withdrawAmount) < MIN_WITHDRAWAL_AMOUNT && (
                    <p className="text-xs mt-2" style={{ color: '#ef4444' }}>{t('accountExtra.withdraw.minError')}</p>
                  )}
                </div>
                {feePreview && feePreview.fee > 0 && (
                  <div className="mb-3 p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                    <div className="flex justify-between text-xs mb-1"><span style={{ color: '#8fa5b8' }}>{t('accountExtra.withdraw.grossAmount')}</span><span className="font-bold text-white">${feePreview.gross.toFixed(2)}</span></div>
                    <div className="flex justify-between text-xs mb-1"><span style={{ color: '#ef4444' }}>{t('accountExtra.withdraw.fee', { percent: feePreview.feePercent })}</span><span className="font-bold" style={{ color: '#ef4444' }}>-${feePreview.fee.toFixed(2)}</span></div>
                    <div className="h-px my-1" style={{ background: 'rgba(255,255,255,0.1)' }} />
                    <div className="flex justify-between text-xs"><span style={{ color: '#10b981' }}>{t('accountExtra.withdraw.netPayment')}</span><span className="font-bold" style={{ color: '#10b981' }}>${feePreview.net.toFixed(2)}</span></div>
                  </div>
                )}
                {feePreview && feePreview.isFirstFree && (
                  <div className="mb-3 p-3 rounded-xl" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
                    <p className="text-xs font-bold" style={{ color: '#10b981' }}>{t('accountExtra.withdraw.firstFreeTotal', { amount: feePreview.gross.toFixed(2) })}</p>
                  </div>
                )}
                <div className="mb-5">
                  <label className="label-text block mb-2">{t('accountExtra.withdraw.address')}</label>
                  <input type="text" value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)} placeholder={t('accountExtra.withdraw.addressPlaceholder')} className="glass-input" style={{ minHeight: '46px' }} required />
                </div>
                <button onClick={handleWithdraw} className="btn-primary" style={{ opacity: isAllowed && Number(withdrawAmount || 0) >= MIN_WITHDRAWAL_AMOUNT ? 1 : 0.4 }} disabled={!isAllowed || Number(withdrawAmount || 0) < MIN_WITHDRAWAL_AMOUNT}>
                  {isAllowed ? t('accountExtra.withdraw.confirm') : t('accountExtra.withdraw.restricted')}
                </button>
                {!isAllowed && <p className="text-xs mt-2 text-center" style={{ color: '#ef4444' }}>{(canWithdrawData as any)?.reason || t('accountExtra.withdraw.completeConditions')}</p>}
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
              {currentTicket.status !== 'closed' && <button onClick={() => { handleCloseTicket(currentTicket.id); setActiveTicket(null); }} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}><X size={12} />{t('accountExtra.close')}</button>}
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
                <p className="text-sm mt-2" style={{ color: '#5a6a7a' }}>{t('accountExtra.supportClosed')}</p>
              </div>
            ) : (
              <div className="flex gap-2"><input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} placeholder={t('accountExtra.messagePlaceholder')} className="glass-input flex-1" style={{ minHeight: '46px' }} /><button onClick={handleSendMessage} className="btn-primary" style={{ width: '46px', minHeight: '46px', padding: 0 }}><Send size={16} /></button></div>
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
            <h1 className="text-xl font-bold text-white">{t('accountExtra.support')}</h1>
          </div>
          <div className="glass-card text-center py-6 cursor-pointer" style={{ background: 'rgba(0,136,204,0.08)', border: '1px solid rgba(0,136,204,0.2)' }} onClick={() => window.open('https://t.me/corevestsupport', '_blank')}>
            <div className="mx-auto mb-3 grid place-items-center rounded-full" style={{ width: '56px', height: '56px', background: 'rgba(0,136,204,0.15)' }}><ExternalLink size={24} style={{ color: '#0088CC' }} /></div>
            <p className="text-base font-bold text-white mb-1">{t('accountExtra.telegramSupport')}</p>
            <p className="text-sm" style={{ color: '#8fa5b8' }}>@corevestsupport</p>
          </div>
          <div className="flex items-center gap-3"><div className="flex-1 h-px" style={{ background: 'rgba(248,251,255,0.08)' }} /><span className="text-xs" style={{ color: '#5a6a7a' }}>{t('accountExtra.or')}</span><div className="flex-1 h-px" style={{ background: 'rgba(248,251,255,0.08)' }} /></div>
          {showNewTicket ? (
            <div className="glass-card">
              <div className="flex items-center justify-between mb-3"><h2 className="text-sm font-bold text-white">{t('accountExtra.newSupportRequest')}</h2><button onClick={() => setShowNewTicket(false)} className="btn-secondary" style={{ minHeight: '32px', width: '32px', padding: 0 }}><X size={14} /></button></div>
              <div className="flex gap-2"><input type="text" value={newSubject} onChange={(e) => setNewSubject(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreateTicket()} placeholder={t('accountExtra.supportPlaceholder')} className="glass-input flex-1" style={{ minHeight: '44px' }} autoFocus /><button onClick={handleCreateTicket} className="btn-primary" style={{ width: '44px', minHeight: '44px', padding: 0 }}><Send size={16} /></button></div>
            </div>
          ) : (
            <button onClick={() => setShowNewTicket(true)} className="glass-card flex items-center gap-3 text-left transition-all w-full" style={{ background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.15)' }}>
              <div className="grid place-items-center rounded-xl" style={{ width: '42px', height: '42px', background: 'rgba(255,215,0,0.1)', color: '#FFD700' }}><Plus size={20} /></div>
              <div className="flex-1"><span className="text-sm font-bold text-white block">{t('accountExtra.newSupportCreate')}</span><span className="text-xs" style={{ color: '#8fa5b8' }}>{t('accountExtra.supportShare')}</span></div>
              <ChevronRight size={16} style={{ color: '#5a6a7a' }} />
            </button>
          )}
          {tickets.length > 0 && <h3 className="text-xs font-bold mt-2" style={{ color: '#8fa5b8' }}>{t('accountExtra.requests')}</h3>}
          {tickets.map((ticket: any) => (
            <button key={ticket.id} onClick={() => setActiveTicket(ticket.id)} className="glass-card flex items-center gap-3 text-left w-full transition-all hover:bg-white/5" style={{ padding: '14px 16px' }}>
              <div className="grid place-items-center rounded-lg shrink-0" style={{ width: '42px', height: '42px', background: ticket.status === 'open' ? 'rgba(255,215,0,0.1)' : ticket.status === 'resolved' ? 'rgba(16,185,129,0.1)' : 'rgba(90,106,122,0.1)', color: ticket.status === 'open' ? '#FFD700' : ticket.status === 'resolved' ? '#10b981' : '#5a6a7a' }}>{ticket.status === 'closed' ? <Lock size={18} /> : <MessageCircle size={18} />}</div>
              <div className="flex-1 min-w-0"><span className="text-sm font-bold text-white block truncate">{ticket.subject}</span><div className="flex items-center gap-2">{statusLabel(ticket.status)}<span className="text-xs" style={{ color: '#5a6a7a' }}>{ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString() : ''}</span></div></div>
              <ChevronRight size={16} style={{ color: '#5a6a7a' }} />
            </button>
          ))}
          {tickets.length === 0 && !showNewTicket && <p className="text-sm text-center py-4" style={{ color: '#5a6a7a' }}>{t('accountExtra.noSupport')}</p>}
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
            <h1 className="text-xl font-bold text-white">{t('accountExtra.financialHistory')}</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setHistoryTab('withdrawals')} className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all" style={{ background: historyTab === 'withdrawals' ? 'rgba(255,215,0,0.12)' : 'rgba(255,255,255,0.04)', border: historyTab === 'withdrawals' ? '1px solid rgba(255,215,0,0.2)' : '1px solid rgba(248,251,255,0.06)', color: historyTab === 'withdrawals' ? '#FFD700' : '#8fa5b8' }}>{t('accountExtra.withdrawalRequests')}</button>
            <button onClick={() => setHistoryTab('deposits')} className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all" style={{ background: historyTab === 'deposits' ? 'rgba(255,215,0,0.12)' : 'rgba(255,255,255,0.04)', border: historyTab === 'deposits' ? '1px solid rgba(255,215,0,0.2)' : '1px solid rgba(248,251,255,0.06)', color: historyTab === 'deposits' ? '#FFD700' : '#8fa5b8' }}>{t('accountExtra.depositHistory')}</button>
            <button onClick={() => setHistoryTab('clicks')} className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all" style={{ background: historyTab === 'clicks' ? 'rgba(255,215,0,0.12)' : 'rgba(255,255,255,0.04)', border: historyTab === 'clicks' ? '1px solid rgba(255,215,0,0.2)' : '1px solid rgba(248,251,255,0.06)', color: historyTab === 'clicks' ? '#FFD700' : '#8fa5b8' }}>Tıklama</button>
            <button onClick={() => setHistoryTab('bonuses')} className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all" style={{ background: historyTab === 'bonuses' ? 'rgba(255,215,0,0.12)' : 'rgba(255,255,255,0.04)', border: historyTab === 'bonuses' ? '1px solid rgba(255,215,0,0.2)' : '1px solid rgba(248,251,255,0.06)', color: historyTab === 'bonuses' ? '#FFD700' : '#8fa5b8' }}>{t('accountExtra.bonuses')}</button>
            <button onClick={() => setHistoryTab('referrals')} className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all" style={{ background: historyTab === 'referrals' ? 'rgba(255,215,0,0.12)' : 'rgba(255,255,255,0.04)', border: historyTab === 'referrals' ? '1px solid rgba(255,215,0,0.2)' : '1px solid rgba(248,251,255,0.06)', color: historyTab === 'referrals' ? '#FFD700' : '#8fa5b8' }}>Referans</button>
          </div>

          {historyTab === 'withdrawals' && (
            <div className="grid gap-2">
              {withdrawals.length === 0 ? <p className="text-sm text-center py-8" style={{ color: '#5a6a7a' }}>{t('accountExtra.noWithdrawals')}</p> : withdrawals.map((w: any) => (
                <div key={w.id} className="glass-card" style={{ padding: '14px 16px' }}>
                  <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2"><span className="text-sm font-bold text-white">${Number(w.amount).toFixed(2)}</span>{statusLabel(w.status)}</div><span className="text-xs" style={{ color: '#5a6a7a' }}>{w.createdAt ? new Date(w.createdAt).toLocaleDateString() : ''}</span></div>
                  <p className="text-xs font-mono mb-2" style={{ color: '#8fa5b8' }}>{w.wallet}</p>
                  {w.status === 'pending' && <button disabled={cancelWithdrawMutation.isPending} onClick={() => handleCancelWithdraw(w.id)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', opacity: cancelWithdrawMutation.isPending ? 0.6 : 1 }}><Ban size={12} />{cancelWithdrawMutation.isPending ? 'İptal ediliyor...' : t('accountExtra.cancelRequest')}</button>}
                </div>
              ))}
            </div>
          )}

          {historyTab === 'deposits' && (
            <div className="grid gap-2">
              {deposits.length === 0 ? <p className="text-sm text-center py-8" style={{ color: '#5a6a7a' }}>{t('accountExtra.noDeposits')}</p> : deposits.map((d: any) => (
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
              {wheelHistory.length === 0 ? <p className="text-sm text-center py-8" style={{ color: '#5a6a7a' }}>{t('accountExtra.noWheelBonus')}</p> : wheelHistory.map((spin: any) => (
                <div key={spin.id} className="glass-card flex items-center gap-3" style={{ padding: '14px 16px' }}>
                  <div className="grid place-items-center rounded-lg shrink-0" style={{ width: '38px', height: '38px', background: 'rgba(255,215,0,0.1)', color: '#FFD700' }}><Gift size={16} /></div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-bold text-white block">{spin.type === 'vip' ? t('accountExtra.vipBonusReward', { level: spin.vipLevel }) : t('accountExtra.wheelReward')}</span>
                    <span className="text-xs" style={{ color: '#8fa5b8' }}>{spin.createdAt ? new Date(spin.createdAt).toLocaleDateString() : ''}</span>
                  </div>
                  <span className="text-sm font-extrabold" style={{ color: '#FFD700' }}>+${Number(spin.amount ?? spin.prize).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}

          {historyTab === 'clicks' && (
            <div className="grid gap-2">
              {clickEarnings.length === 0 ? <p className="text-sm text-center py-8" style={{ color: '#5a6a7a' }}>Henüz tıklama kazancınız bulunmuyor.</p> : clickEarnings.map((earning: any) => (
                <div key={earning.id} className="glass-card flex items-center gap-3" style={{ padding: '14px 16px' }}>
                  <div className="grid place-items-center rounded-lg shrink-0" style={{ width: '38px', height: '38px', background: 'rgba(16,185,129,0.1)', color: '#10b981' }}><MousePointerClick size={16} /></div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-bold text-white block">Tıklama Kazancı</span>
                    <span className="text-xs" style={{ color: '#8fa5b8' }}>{earning.createdAt ? new Date(earning.createdAt).toLocaleDateString() : ''} · VIP {earning.vipLevel} · %{Number(earning.dailyRate).toFixed(2)}</span>
                  </div>
                  <span className="text-sm font-extrabold" style={{ color: '#10b981' }}>+${Number(earning.amount).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}

          {historyTab === 'referrals' && (
            <div className="grid gap-2">
              {referralEarnings.length === 0 ? <p className="text-sm text-center py-8" style={{ color: '#5a6a7a' }}>Henüz referans kazancınız bulunmuyor.</p> : referralEarnings.map((earning: any) => (
                <div key={earning.id} className="glass-card flex items-center gap-3" style={{ padding: '14px 16px' }}>
                  <div className="grid place-items-center rounded-lg shrink-0" style={{ width: '38px', height: '38px', background: 'rgba(255,215,0,0.1)', color: '#FFD700' }}><Users size={16} /></div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-bold text-white block">Referans Komisyonu T{earning.tier}</span>
                    <span className="text-xs" style={{ color: '#8fa5b8' }}>{earning.createdAt ? new Date(earning.createdAt).toLocaleDateString() : ''} · %{Number(earning.commissionRate).toFixed(2)}</span>
                  </div>
                  <span className="text-sm font-extrabold" style={{ color: '#FFD700' }}>+${Number(earning.commissionAmount).toFixed(2)}</span>
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
          <h1 className="text-xl font-bold text-white mb-1">{t('accountExtra.myAccount')}</h1>
          {/* USER ID - matches admin panel */}
          <p className="text-sm font-mono font-bold" style={{ color: '#FFD700' }}>ID: {userId}</p>
          {userEmail && <p className="text-xs font-semibold mt-1" style={{ color: '#8fa5b8' }}>{userEmail}</p>}
          <p className="text-xs mt-1" style={{ color: '#5a6a7a' }}>{t('accountExtra.membership')}: {profile.joinDate ? new Date(profile.joinDate).toLocaleDateString() : ''}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="glass-card">
            <div className="flex items-center gap-2 mb-2"><div className="grid place-items-center rounded-xl" style={{ width: '38px', height: '38px', color: '#FFD700', background: 'rgba(255,215,0,0.1)' }}><Crown size={18} /></div></div>
            <span className="text-xs font-medium" style={{ color: '#8fa5b8' }}>{t('accountExtra.vipLevel')}</span>
            <strong className="block text-xl mt-1" style={{ color: '#FFD700' }}>VIP {vipLevel}</strong>
          </div>
          <div className="glass-card">
            <div className="flex items-center gap-2 mb-2"><div className="grid place-items-center rounded-xl" style={{ width: '38px', height: '38px', color: '#FFD700', background: 'rgba(255,215,0,0.1)' }}><Wallet size={18} /></div></div>
            <span className="text-xs font-medium" style={{ color: '#8fa5b8' }}>{t('accountExtra.balance')}</span>
            <strong className="block text-xl text-white mt-1">${Number(profile.balance).toFixed(2)}</strong>
          </div>
        </div>

        <div className="glass-card flex items-center gap-3">
          <div className="grid place-items-center rounded-xl" style={{ width: '42px', height: '42px', color: '#FFD700', background: 'rgba(255,215,0,0.1)' }}><ArrowDownLeft size={20} /></div>
          <div className="flex-1"><span className="text-xs font-medium" style={{ color: '#8fa5b8' }}>{t('accountExtra.totalInvestment')}</span><strong className="block text-base text-white">${Number(profile.investment).toLocaleString()}</strong></div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="glass-card text-center">
            <span className="text-xs font-medium" style={{ color: '#8fa5b8' }}>Bugünkü Kazanç</span>
            <strong className="block text-base mt-1" style={{ color: '#10b981' }}>${Number(earningsSummary.today || 0).toFixed(2)}</strong>
          </div>
          <div className="glass-card text-center">
            <span className="text-xs font-medium" style={{ color: '#8fa5b8' }}>Dünkü Kazanç</span>
            <strong className="block text-base mt-1" style={{ color: '#FFD700' }}>${Number(earningsSummary.yesterday || 0).toFixed(2)}</strong>
          </div>
          <div className="glass-card text-center">
            <span className="text-xs font-medium" style={{ color: '#8fa5b8' }}>Toplam Kazanç</span>
            <strong className="block text-base text-white mt-1">${Number(earningsSummary.total || profile.totalEarned || 0).toFixed(2)}</strong>
          </div>
        </div>

        <div className="glass-card">
          <h2 className="text-base font-bold text-white mb-4">{t('accountExtra.transactions')}</h2>
          <div className="grid gap-2">
            {[
              { key: 'deposit', label: t('accountExtra.depositMoney'), icon: ArrowDownLeft, color: '#10b981', onClick: () => setView('deposit') },
              { key: 'withdraw', label: t('accountExtra.withdrawMoney'), icon: ArrowUpRight, color: '#FFD700', onClick: () => setView('withdraw') },
              { key: 'history', label: t('accountExtra.financialHistory'), icon: Receipt, color: '#8b5cf6', onClick: () => setView('history') },
              { key: 'support', label: t('accountExtra.support'), icon: Headphones, color: '#35d7ff', onClick: () => setView('support') },
              { key: 'logout', label: t('accountExtra.logout'), icon: LogOut, color: '#ef4444', onClick: () => setShowLogout(true) },
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

        <div className="glass-card" style={{ background: 'rgba(255,215,0,0.04)', border: '1px solid rgba(255,215,0,0.15)' }}>
          <div className="flex items-start gap-3">
            <div className="grid place-items-center rounded-xl shrink-0" style={{ width: '44px', height: '44px', color: '#FFD700', background: 'rgba(255,215,0,0.1)' }}>
              <Download size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-white mb-1">{t('accountExtra.installApp')}</h2>
              <p className="text-xs mb-3" style={{ color: '#8fa5b8' }}>{t('accountExtra.installAppDesc')}</p>
              <button onClick={handleInstallApp} className="btn-primary w-full" style={{ minHeight: '42px' }}>
                <Download size={16} /> {t('accountExtra.installAppButton')}
              </button>
              {installMessage && <p className="text-xs font-bold mt-3 text-center" style={{ color: '#10b981' }}>{installMessage}</p>}
              {showInstallHelp && (
                <div className="mt-3 rounded-xl p-3 text-left" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(248,251,255,0.08)' }}>
                  <p className="text-xs font-bold mb-1" style={{ color: '#FFD700' }}>
                    {isIosDevice() ? t('accountExtra.iosInstallTitle') : t('accountExtra.manualInstallTitle')}
                  </p>
                  <p className="text-xs" style={{ color: '#8fa5b8' }}>
                    {isIosDevice() ? t('accountExtra.iosInstallSteps') : t('accountExtra.manualInstallSteps')}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showLogout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-sm animate-fade-in" style={{ background: 'rgba(5, 9, 20, 0.95)', border: '1px solid rgba(248,251,255,0.1)', borderRadius: '22px', padding: '24px', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
            <div className="text-center mb-5"><div className="mx-auto mb-3 grid place-items-center rounded-full" style={{ width: '56px', height: '56px', background: 'rgba(239,68,68,0.12)' }}><LogOut size={28} style={{ color: '#ef4444' }} /></div><h3 className="text-lg font-bold text-white mb-1">{t('accountExtra.logout')}</h3><p className="text-sm" style={{ color: '#8fa5b8' }}>{t('accountExtra.logoutConfirm')}</p></div>
            <div className="flex gap-3"><button onClick={() => setShowLogout(false)} className="btn-secondary flex-1">{t('accountExtra.cancel')}</button><button onClick={handleLogout} className="flex-1 inline-flex items-center justify-center gap-2 font-extrabold text-sm rounded-xl text-white" style={{ minHeight: '46px', background: 'rgba(239,68,68,0.85)' }}><LogOut size={16} />{t('accountExtra.logout')}</button></div>
          </div>
        </div>
      )}
    </Layout>
  );
}
