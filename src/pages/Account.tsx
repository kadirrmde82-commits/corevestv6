import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Crown, Wallet, ArrowDownLeft, ArrowUpRight,
  Headphones, LogOut, ChevronRight, Clock, AlertCircle, Check,
  Copy, MessageCircle, Lock, X, Receipt, Ban,
  ExternalLink, Plus, Send,
} from 'lucide-react';
import Layout from '../components/Layout';
import {
  getUser, getDeposits, getWithdrawals,
  addDeposit, addWithdrawal, cancelWithdrawal,
  createSupportTicket, getSupportTickets, addTicketMessage,
  closeTicket, canCreateTicket,
} from '../store';
import type { Deposit, Withdrawal, SupportTicket } from '../store';

type ActionView = 'main' | 'deposit' | 'withdraw' | 'support' | 'history';
type HistoryTab = 'deposits' | 'withdrawals';

const TRON_ADDRESS = 'TA8iYcRTAKrCuq4P8KgWwegXw2SJUNUqHM';

export default function Account() {
  const navigate = useNavigate();
  const [view, setView] = useState<ActionView>('main');
  const [historyTab, setHistoryTab] = useState<HistoryTab>('withdrawals');
  const [showLogout, setShowLogout] = useState(false);

  const [user, setUser] = useState(getUser());
  const [deposits, setDeposits] = useState<Deposit[]>(getDeposits());
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>(getWithdrawals());
  const [tickets, setTickets] = useState<SupportTicket[]>(getSupportTickets());

  const refreshData = useCallback(() => {
    setUser(getUser());
    setDeposits(getDeposits());
    setWithdrawals(getWithdrawals());
    setTickets(getSupportTickets());
  }, []);

  useEffect(() => {
    refreshData();
    const handler = () => refreshData();
    window.addEventListener('focus', handler);
    return () => window.removeEventListener('focus', handler);
  }, [refreshData]);

  // Deposit
  const [depositAmount, setDepositAmount] = useState('');
  const [depositStatus, setDepositStatus] = useState<'idle' | 'checking'>('idle');
  const [copied, setCopied] = useState(false);

  // Withdraw
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawEmail, setWithdrawEmail] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);

  // Support
  const [activeTicket, setActiveTicket] = useState<string | null>(null);
  const [newSubject, setNewSubject] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [showNewTicket, setShowNewTicket] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const currentTicket = tickets.find(t => t.id === activeTicket);
  const canCreate = canCreateTicket();

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(TRON_ADDRESS);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDeposit = () => {
    if (!depositAmount || Number(depositAmount) <= 0) return;
    addDeposit(Number(depositAmount));
    setDeposits(getDeposits());
    setDepositStatus('checking');
  };

  const handleWithdraw = () => {
    if (!withdrawAmount || Number(withdrawAmount) <= 0 || !walletAddress || !withdrawEmail) return;
    const u = getUser();
    if (!u || u.balance < Number(withdrawAmount)) return;
    addWithdrawal(Number(withdrawAmount), withdrawEmail, walletAddress);
    refreshData();
    setWithdrawSuccess(true);
    setTimeout(() => {
      setWithdrawSuccess(false);
      setWithdrawAmount(''); setWalletAddress(''); setWithdrawEmail('');
      setView('main');
    }, 2000);
  };

  const handleCancelWithdraw = (id: string) => {
    cancelWithdrawal(id);
    refreshData();
  };

  // Support Ticket
  const handleCreateTicket = () => {
    if (!newSubject.trim()) return;
    if (!canCreateTicket()) return;
    createSupportTicket(newSubject);
    setTickets(getSupportTickets());
    setNewSubject('');
    setShowNewTicket(false);
  };

  const handleSendMessage = () => {
    if (!newMessage.trim() || !activeTicket) return;
    const t = tickets.find(tk => tk.id === activeTicket);
    if (!t || t.status === 'closed') return;
    addTicketMessage(activeTicket, newMessage, 'user');
    setTickets(getSupportTickets());
    setNewMessage('');
  };

  const handleCloseTicket = (ticketId: string) => {
    closeTicket(ticketId);
    setTickets(getSupportTickets());
  };

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [tickets, activeTicket]);

  const handleLogout = () => {
    localStorage.removeItem('corevest_user');
    navigate('/');
  };

  const statusLabel = (status: string) => {
    const map: Record<string, { text: string; color: string; bg: string }> = {
      pending: { text: 'Beklemede', color: '#FFD700', bg: 'rgba(255,215,0,0.12)' },
      approved: { text: 'Onaylandı', color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
      rejected: { text: 'Reddedildi', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
      cancelled: { text: 'İptal Edildi', color: '#5a6a7a', bg: 'rgba(90,106,122,0.15)' },
      open: { text: 'Beklemede', color: '#FFD700', bg: 'rgba(255,215,0,0.12)' },
      resolved: { text: 'Sorun Çözüldü', color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
      closed: { text: 'Kapatıldı', color: '#5a6a7a', bg: 'rgba(90,106,122,0.15)' },
    };
    const s = map[status] || map.pending;
    return <span className="text-[10px] font-extrabold px-2 py-1 rounded-full" style={{ background: s.bg, color: s.color }}>{s.text}</span>;
  };

  if (!user) return null;

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
            <div className="glass-card">
              <div className="mb-4">
                <label className="label-text block mb-2">Yatırım Miktarı ($)</label>
                <input type="number" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="Örn: 100" className="glass-input" style={{ minHeight: '46px' }} />
              </div>
              <div className="mb-4 p-4 rounded-xl" style={{ background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.15)' }}>
                <span className="text-sm font-bold block mb-1" style={{ color: '#FFD700' }}>TRC20 (Tron)</span>
                <p className="text-xs mb-3" style={{ color: '#8fa5b8' }}>Aşağıdaki adrese USDT (TRC20) gönderin:</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 text-xs font-mono truncate rounded-xl px-3 py-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(248,251,255,0.1)', color: '#c8d6e5' }}>{TRON_ADDRESS}</div>
                  <button onClick={handleCopyAddress} className="btn-secondary" style={{ minHeight: '42px', width: '42px', padding: 0 }}>{copied ? <Check size={16} /> : <Copy size={16} />}</button>
                </div>
                {copied && <p className="text-xs mt-2 text-center" style={{ color: '#10b981' }}>Kopyalandı!</p>}
              </div>
              <button onClick={handleDeposit} className="btn-primary">Yatırımı Onayla</button>
            </div>
          )}
        </div>
      </Layout>
    );
  }

  // ─── WITHDRAW VIEW ───
  if (view === 'withdraw') {
    return (
      <Layout>
        <div className="grid gap-3 animate-fade-in">
          <div className="flex items-center gap-3 mb-2">
            <button onClick={() => setView('main')} className="btn-secondary" style={{ width: '36px', minHeight: '36px', padding: 0 }}><ArrowUpRight size={16} style={{ transform: 'rotate(-90deg)' }} /></button>
            <h1 className="text-xl font-bold text-white">Para Çek</h1>
          </div>
          <div className="glass-card">
            {withdrawSuccess ? (
              <div className="text-center py-6">
                <div className="mx-auto mb-3 grid place-items-center rounded-full" style={{ width: '56px', height: '56px', background: 'rgba(16,185,129,0.15)' }}><Check size={28} style={{ color: '#10b981' }} /></div>
                <p className="text-base font-bold text-white">Çekim talebiniz alındı!</p>
                <p className="text-xs mt-1" style={{ color: '#8fa5b8' }}>Bakiyenizden düşüldü. Onay bekleniyor.</p>
              </div>
            ) : (
              <>
                <div className="mb-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(248,251,255,0.08)' }}>
                  <span className="text-xs" style={{ color: '#8fa5b8' }}>Mevcut Bakiye</span>
                  <span className="text-lg font-extrabold text-white block">${user.balance.toFixed(2)}</span>
                </div>
                <div className="mb-3">
                  <label className="label-text block mb-2">E-posta Adresiniz</label>
                  <input type="email" value={withdrawEmail} onChange={(e) => setWithdrawEmail(e.target.value)} placeholder="E-posta adresinizi girin" className="glass-input" style={{ minHeight: '46px' }} required />
                </div>
                <div className="mb-3">
                  <label className="label-text block mb-2">Çekim Miktarı ($)</label>
                  <input type="number" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} placeholder="Çekilecek miktar" className="glass-input" style={{ minHeight: '46px' }} required />
                </div>
                <div className="mb-5">
                  <label className="label-text block mb-2">TRC20 Cüzdan Adresi</label>
                  <input type="text" value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)} placeholder="USDT (TRC20) adresi" className="glass-input" style={{ minHeight: '46px' }} required />
                </div>
                <button onClick={handleWithdraw} className="btn-primary">Çekim Talebi Gönder</button>
                <p className="text-xs mt-3 text-center" style={{ color: '#5a6a7a' }}>Çekim işlemleri 48-72 saat içerisinde onaylanır.</p>
              </>
            )}
          </div>
        </div>
      </Layout>
    );
  }

  // ─── SUPPORT VIEW (Telegram + Tickets) ───
  if (view === 'support') {
    // Active chat
    if (activeTicket && currentTicket) {
      const isClosed = currentTicket.status === 'closed';
      return (
        <Layout>
          <div className="grid gap-3 animate-fade-in">
            <div className="flex items-center gap-3">
              <button onClick={() => setActiveTicket(null)} className="btn-secondary" style={{ width: '36px', minHeight: '36px', padding: 0 }}><ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} /></button>
              <div className="flex-1 min-w-0">
                <h1 className="text-base font-bold text-white truncate">{currentTicket.subject}</h1>
                <div className="flex items-center gap-2">
                  {statusLabel(currentTicket.status)}
                  <span className="text-[10px]" style={{ color: '#5a6a7a' }}>#{currentTicket.id}</span>
                </div>
              </div>
              {currentTicket.status !== 'closed' && (
                <button onClick={() => { handleCloseTicket(currentTicket.id); setActiveTicket(null); }} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}><X size={12} />Kapat</button>
              )}
            </div>

            <div className="glass-card flex flex-col" style={{ minHeight: '300px', maxHeight: '400px' }}>
              <div className="flex-1 overflow-y-auto space-y-3 pr-1" style={{ maxHeight: '340px' }}>
                {currentTicket.messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className="max-w-[80%] rounded-2xl px-4 py-2.5" style={{ background: msg.sender === 'user' ? 'linear-gradient(135deg, #FFD700, #FFA500)' : 'rgba(255,255,255,0.08)', color: msg.sender === 'user' ? '#04070d' : '#c8d6e5', borderBottomRightRadius: msg.sender === 'user' ? '4px' : '16px', borderBottomLeftRadius: msg.sender === 'admin' ? '4px' : '16px' }}>
                      <p className="text-sm">{msg.text}</p>
                      <span className="text-[10px] opacity-60 block mt-1">{msg.time}</span>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
            </div>

            {isClosed ? (
              <div className="glass-card text-center py-4">
                <Lock size={20} style={{ color: '#5a6a7a', margin: '0 auto' }} />
                <p className="text-sm mt-2" style={{ color: '#5a6a7a' }}>Bu destek talebi kapatılmıştır. Yeni talep oluşturabilirsiniz.</p>
              </div>
            ) : (
              <div className="flex gap-2">
                <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} placeholder="Mesajınızı yazın..." className="glass-input flex-1" style={{ minHeight: '46px' }} />
                <button onClick={handleSendMessage} className="btn-primary" style={{ width: '46px', minHeight: '46px', padding: 0 }}><Send size={16} /></button>
              </div>
            )}
          </div>
        </Layout>
      );
    }

    // Support hub: Telegram + Ticket list + New ticket
    return (
      <Layout>
        <div className="grid gap-3 animate-fade-in">
          <div className="flex items-center gap-3 mb-2">
            <button onClick={() => setView('main')} className="btn-secondary" style={{ width: '36px', minHeight: '36px', padding: 0 }}><Headphones size={16} /></button>
            <h1 className="text-xl font-bold text-white">Destek</h1>
          </div>

          {/* Telegram */}
          <div className="glass-card text-center py-6 cursor-pointer" style={{ background: 'rgba(0,136,204,0.08)', border: '1px solid rgba(0,136,204,0.2)' }} onClick={() => window.open('https://t.me/corevestsupport', '_blank')}>
            <div className="mx-auto mb-3 grid place-items-center rounded-full" style={{ width: '56px', height: '56px', background: 'rgba(0,136,204,0.15)' }}><ExternalLink size={24} style={{ color: '#0088CC' }} /></div>
            <p className="text-base font-bold text-white mb-1">Telegram Destek</p>
            <p className="text-sm" style={{ color: '#8fa5b8' }}>@corevestsupport</p>
            <p className="text-xs mt-2" style={{ color: '#0088CC' }}>Hızlı destek için tıklayın</p>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3"><div className="flex-1 h-px" style={{ background: 'rgba(248,251,255,0.08)' }} /><span className="text-xs" style={{ color: '#5a6a7a' }}>veya</span><div className="flex-1 h-px" style={{ background: 'rgba(248,251,255,0.08)' }} /></div>

          {/* New Ticket */}
          {showNewTicket ? (
            <div className="glass-card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-white">Yeni Destek Talebi</h2>
                <button onClick={() => setShowNewTicket(false)} className="btn-secondary" style={{ minHeight: '32px', width: '32px', padding: 0 }}><X size={14} /></button>
              </div>
              <div className="flex gap-2">
                <input type="text" value={newSubject} onChange={(e) => setNewSubject(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreateTicket()} placeholder="Sorununuzu kısaca yazın..." className="glass-input flex-1" style={{ minHeight: '44px' }} autoFocus />
                <button onClick={handleCreateTicket} className="btn-primary" style={{ width: '44px', minHeight: '44px', padding: 0 }}><Send size={16} /></button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => canCreate ? setShowNewTicket(true) : null}
              className="glass-card flex items-center gap-3 text-left transition-all w-full"
              style={{ background: canCreate ? 'rgba(255,215,0,0.06)' : 'rgba(255,255,255,0.02)', border: canCreate ? '1px solid rgba(255,215,0,0.15)' : '1px solid rgba(248,251,255,0.05)', opacity: canCreate ? 1 : 0.5, cursor: canCreate ? 'pointer' : 'not-allowed' }}
            >
              <div className="grid place-items-center rounded-xl" style={{ width: '42px', height: '42px', background: canCreate ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.04)', color: canCreate ? '#FFD700' : '#5a6a7a' }}>{canCreate ? <Plus size={20} /> : <Clock size={20} />}</div>
              <div className="flex-1">
                <span className="text-sm font-bold text-white block">{canCreate ? 'Yeni Destek Talebi Oluştur' : '24 Saat Beklemelisiniz'}</span>
                <span className="text-xs" style={{ color: '#8fa5b8' }}>{canCreate ? 'Sorununuzu bizimle paylaşın' : 'Son talebinizden 24 saat geçmeli'}</span>
              </div>
              <ChevronRight size={16} style={{ color: '#5a6a7a' }} />
            </button>
          )}

          {/* Ticket List */}
          {tickets.length > 0 && <h3 className="text-xs font-bold mt-2" style={{ color: '#8fa5b8' }}>TALEPLERİM</h3>}
          {tickets.map((ticket) => (
            <button key={ticket.id} onClick={() => setActiveTicket(ticket.id)} className="glass-card flex items-center gap-3 text-left w-full transition-all hover:bg-white/5" style={{ padding: '14px 16px' }}>
              <div className="grid place-items-center rounded-lg shrink-0" style={{ width: '42px', height: '42px', background: ticket.status === 'open' ? 'rgba(255,215,0,0.1)' : ticket.status === 'resolved' ? 'rgba(16,185,129,0.1)' : 'rgba(90,106,122,0.1)', color: ticket.status === 'open' ? '#FFD700' : ticket.status === 'resolved' ? '#10b981' : '#5a6a7a' }}>{ticket.status === 'closed' ? <Lock size={18} /> : <MessageCircle size={18} />}</div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-bold text-white block truncate">{ticket.subject}</span>
                <div className="flex items-center gap-2">{statusLabel(ticket.status)}<span className="text-xs" style={{ color: '#5a6a7a' }}>{ticket.createdAt}</span></div>
              </div>
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
          </div>

          {historyTab === 'withdrawals' && (
            <div className="grid gap-2">
              {withdrawals.length === 0 ? <p className="text-sm text-center py-8" style={{ color: '#5a6a7a' }}>Henüz çekim talebiniz bulunmuyor.</p> : withdrawals.map((w) => (
                <div key={w.id} className="glass-card" style={{ padding: '14px 16px' }}>
                  <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2"><span className="text-sm font-bold text-white">${w.amount}</span>{statusLabel(w.status)}</div><span className="text-xs" style={{ color: '#5a6a7a' }}>{w.date}</span></div>
                  <p className="text-xs font-mono mb-2" style={{ color: '#8fa5b8' }}>{w.wallet}</p>
                  {w.status === 'pending' && <button onClick={() => handleCancelWithdraw(w.id)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}><Ban size={12} />İptal Et</button>}
                </div>
              ))}
            </div>
          )}

          {historyTab === 'deposits' && (
            <div className="grid gap-2">
              {deposits.length === 0 ? <p className="text-sm text-center py-8" style={{ color: '#5a6a7a' }}>Henüz yatırım işleminiz bulunmuyor.</p> : deposits.map((d) => (
                <div key={d.id} className="glass-card flex items-center gap-3" style={{ padding: '14px 16px' }}>
                  <div className="grid place-items-center rounded-lg shrink-0" style={{ width: '38px', height: '38px', background: 'rgba(16,185,129,0.1)', color: '#10b981' }}><ArrowDownLeft size={16} /></div>
                  <div className="flex-1 min-w-0"><div className="flex items-center gap-2"><span className="text-sm font-bold text-white">${d.amount}</span>{statusLabel(d.status)}</div><span className="text-xs font-mono" style={{ color: '#8fa5b8' }}>{d.txid}</span></div>
                  <span className="text-xs shrink-0" style={{ color: '#5a6a7a' }}>{d.date}</span>
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
        <div className="glass-card text-center py-6">
          <div className="mx-auto mb-3 grid place-items-center rounded-full" style={{ width: '72px', height: '72px', background: 'linear-gradient(135deg, #FFD70020, #FFA50020)', border: '2px solid rgba(255,215,0,0.2)' }}><User size={32} style={{ color: '#FFD700' }} /></div>
          <h1 className="text-xl font-bold text-white mb-1">Hesabım</h1>
          <p className="text-xs" style={{ color: '#8fa5b8' }}>{user.email}</p>
          <p className="text-xs mt-1" style={{ color: '#5a6a7a' }}>Üyelik: {user.joinDate}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="glass-card">
            <div className="flex items-center gap-2 mb-2"><div className="grid place-items-center rounded-xl" style={{ width: '38px', height: '38px', color: '#FFD700', background: 'rgba(255,215,0,0.1)' }}><Crown size={18} /></div></div>
            <span className="text-xs font-medium" style={{ color: '#8fa5b8' }}>VIP Seviyesi</span>
            <strong className="block text-xl mt-1" style={{ color: '#FFD700' }}>VIP {user.vipLevel}</strong>
          </div>
          <div className="glass-card">
            <div className="flex items-center gap-2 mb-2"><div className="grid place-items-center rounded-xl" style={{ width: '38px', height: '38px', color: '#FFD700', background: 'rgba(255,215,0,0.1)' }}><Wallet size={18} /></div></div>
            <span className="text-xs font-medium" style={{ color: '#8fa5b8' }}>Bakiye</span>
            <strong className="block text-xl text-white mt-1">${user.balance.toFixed(2)}</strong>
          </div>
        </div>

        <div className="glass-card flex items-center gap-3">
          <div className="grid place-items-center rounded-xl" style={{ width: '42px', height: '42px', color: '#FFD700', background: 'rgba(255,215,0,0.1)' }}><ArrowDownLeft size={20} /></div>
          <div className="flex-1"><span className="text-xs font-medium" style={{ color: '#8fa5b8' }}>Toplam Yatırım</span><strong className="block text-base text-white">${user.investment.toLocaleString()}</strong></div>
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
            <div className="text-center mb-5"><div className="mx-auto mb-3 grid place-items-center rounded-full" style={{ width: '56px', height: '56px', background: 'rgba(239,68,68,0.12)' }}><AlertCircle size={28} style={{ color: '#ef4444' }} /></div><h3 className="text-lg font-bold text-white mb-1">Çıkış Yap</h3><p className="text-sm" style={{ color: '#8fa5b8' }}>Çıkış yapmak istediğinize emin misiniz?</p></div>
            <div className="flex gap-3"><button onClick={() => setShowLogout(false)} className="btn-secondary flex-1">İptal</button><button onClick={handleLogout} className="flex-1 inline-flex items-center justify-center gap-2 font-extrabold text-sm rounded-xl text-white" style={{ minHeight: '46px', background: 'rgba(239,68,68,0.85)' }}><LogOut size={16} />Çıkış Yap</button></div>
          </div>
        </div>
      )}
    </Layout>
  );
}
