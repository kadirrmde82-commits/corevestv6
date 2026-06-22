import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowDownLeft, ArrowUpRight, Users,
  Check, X, Edit3, Wallet, Shield, LogOut,
  Send, MessageCircle, Lock, ChevronRight, Headphones, Crown
} from 'lucide-react';
import LanguageSelector from '../components/LanguageSelector';
import {
  getDeposits, getWithdrawals, approveDeposit, rejectDeposit,
  approveWithdrawal, rejectWithdrawal, getUser, syncUser,
  getSupportTickets, closeTicket, resolveTicket, addTicketMessage,
  getActiveReferralCount, getVipLevel, VIP_TABLE,
} from '../store';
import type { Deposit, Withdrawal, SupportTicket } from '../store';

type AdminTab = 'deposits' | 'withdrawals' | 'members' | 'vip' | 'tickets';

export default function Admin() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminTab>('deposits');
  const [editingBalance, setEditingBalance] = useState(false);
  const [newBalance, setNewBalance] = useState('');
  const [showLogout, setShowLogout] = useState(false);

  const [deposits, setDeposits] = useState<Deposit[]>(getDeposits());
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>(getWithdrawals());
  const [tickets, setTickets] = useState<SupportTicket[]>(getSupportTickets());
  const [user, setUser] = useState(getUser());

  useEffect(() => {
    const interval = setInterval(() => {
      setDeposits(getDeposits());
      setWithdrawals(getWithdrawals());
      setTickets(getSupportTickets());
      setUser(getUser());
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const [detailDeposit, setDetailDeposit] = useState<Deposit | null>(null);
  const [detailWithdraw, setDetailWithdraw] = useState<Withdrawal | null>(null);
  const [detailTicket, setDetailTicket] = useState<SupportTicket | null>(null);
  const [ticketReply, setTicketReply] = useState('');

  const pendingDeposits = deposits.filter(d => d.status === 'pending');
  const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending');
  const openTickets = tickets.filter(t => t.status === 'open');
  const totalBalance = user?.balance || 0;
  const activeRefs = getActiveReferralCount();
  const currentVip = user ? getVipLevel(user.investment) : 0;

  const handleApproveDeposit = (id: string) => { approveDeposit(id); setDeposits(getDeposits()); setUser(getUser()); setDetailDeposit(null); };
  const handleRejectDeposit = (id: string) => { rejectDeposit(id); setDeposits(getDeposits()); setDetailDeposit(null); };
  const handleApproveWithdraw = (id: string) => { approveWithdrawal(id); setWithdrawals(getWithdrawals()); setDetailWithdraw(null); };
  const handleRejectWithdraw = (id: string) => { rejectWithdrawal(id); setWithdrawals(getWithdrawals()); setDetailWithdraw(null); };

  const handleUpdateBalance = () => {
    if (!newBalance) return;
    syncUser({ balance: Number(newBalance) });
    setUser(getUser());
    setEditingBalance(false);
    setNewBalance('');
  };

  const handleResolveTicket = (ticketId: string) => {
    resolveTicket(ticketId);
    setTickets(getSupportTickets());
    if (detailTicket?.id === ticketId) setDetailTicket(prev => prev ? { ...prev, status: 'resolved' } : null);
  };
  const handleCloseTicket = (ticketId: string) => {
    closeTicket(ticketId);
    setTickets(getSupportTickets());
    if (detailTicket?.id === ticketId) setDetailTicket(prev => prev ? { ...prev, status: 'closed' } : null);
  };
  const handleReplyTicket = () => {
    if (!ticketReply.trim() || !detailTicket) return;
    addTicketMessage(detailTicket.id, ticketReply, 'admin');
    setTickets(getSupportTickets());
    setDetailTicket(prev => prev ? { ...prev, messages: [...prev.messages, { sender: 'admin' as const, text: ticketReply, time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) }] } : null);
    setTicketReply('');
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, { bg: string; color: string }> = {
      pending: { bg: 'rgba(255,215,0,0.12)', color: '#FFD700' },
      approved: { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
      rejected: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444' },
      cancelled: { bg: 'rgba(90,106,122,0.15)', color: '#5a6a7a' },
      open: { bg: 'rgba(255,215,0,0.12)', color: '#FFD700' },
      resolved: { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
      closed: { bg: 'rgba(90,106,122,0.15)', color: '#5a6a7a' },
    };
    const c = colors[status] || colors.pending;
    const labels: Record<string, string> = {
      pending: 'Beklemede', approved: 'Onaylandı', rejected: 'Reddedildi', cancelled: 'İptal Edildi',
      open: 'Beklemede', resolved: 'Sorun Çözüldü', closed: 'Kapatıldı',
    };
    return <span className="text-[10px] font-extrabold px-2 py-1 rounded-full" style={{ background: c.bg, color: c.color }}>{labels[status] || status}</span>;
  };

  return (
    <div className="page-bg min-h-screen">
      {/* Topbar */}
      <div className="sticky top-0 z-20 flex items-center justify-between gap-4 px-4 py-3 mb-4" style={{ background: 'rgba(5, 11, 20, 0.92)', backdropFilter: 'blur(18px)', borderBottom: '1px solid rgba(248,251,255,0.08)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="btn-secondary" style={{ minHeight: '36px', width: '36px', padding: 0 }}><ArrowLeft size={16} /></button>
          <div className="flex items-center gap-2"><Shield size={18} style={{ color: '#FFD700' }} /><span className="text-base font-extrabold text-white">Admin Panel</span></div>
        </div>
        <div className="flex items-center gap-2"><LanguageSelector /><button onClick={() => setShowLogout(true)} className="btn-secondary" style={{ minHeight: '36px', width: '36px', padding: 0, color: '#ef4444', borderColor: 'rgba(239,68,68,0.2)' }}><LogOut size={16} /></button></div>
      </div>

      <div className="px-4 pb-8" style={{ width: 'min(100%, 1180px)', margin: '0 auto' }}>
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {[
            { label: 'Bekleyen Yatırım', value: pendingDeposits.length, icon: ArrowDownLeft, color: '#10b981' },
            { label: 'Bekleyen Çekim', value: pendingWithdrawals.length, icon: ArrowUpRight, color: '#FFD700' },
            { label: 'Açık Ticket', value: openTickets.length, icon: Headphones, color: '#35d7ff' },
            { label: 'Toplam Bakiye', value: `$${totalBalance.toFixed(2)}`, icon: Wallet, color: '#FFD700' },
          ].map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} className="glass-card">
                <div className="flex items-center gap-2 mb-2"><div className="grid place-items-center rounded-xl" style={{ width: '36px', height: '36px', color: s.color, background: `${s.color}15` }}><Icon size={16} /></div></div>
                <span className="text-xs font-medium" style={{ color: '#8fa5b8' }}>{s.label}</span>
                <strong className="block text-lg text-white mt-1">{s.value}</strong>
              </div>
            );
          })}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {[
            { key: 'deposits' as AdminTab, label: 'Yatırım Talepleri', icon: ArrowDownLeft, count: pendingDeposits.length },
            { key: 'withdrawals' as AdminTab, label: 'Çekim Talepleri', icon: ArrowUpRight, count: pendingWithdrawals.length },
            { key: 'members' as AdminTab, label: 'Üye & Bakiye', icon: Users, count: 0 },
            { key: 'vip' as AdminTab, label: 'VIP Sistemi', icon: Crown, count: 0 },
            { key: 'tickets' as AdminTab, label: 'Destek Ticketları', icon: Headphones, count: openTickets.length },
          ].map((tab) => {
            const isActive = activeTab === tab.key;
            const Icon = tab.icon;
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all" style={{ background: isActive ? 'rgba(255,215,0,0.12)' : 'rgba(255,255,255,0.04)', border: isActive ? '1px solid rgba(255,215,0,0.2)' : '1px solid rgba(248,251,255,0.06)', color: isActive ? '#FFD700' : '#8fa5b8' }}>
                <Icon size={15} />{tab.label}
                {tab.count > 0 && <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.8)', color: '#fff' }}>{tab.count}</span>}
              </button>
            );
          })}
        </div>

        {/* Deposits Tab */}
        {activeTab === 'deposits' && (
          <div className="grid gap-2">
            {deposits.map((d) => (
              <button key={d.id} onClick={() => setDetailDeposit(d)} className="glass-card flex items-center gap-4 text-left w-full transition-all hover:bg-white/5" style={{ padding: '14px 16px' }}>
                <div className="grid place-items-center rounded-lg shrink-0" style={{ width: '42px', height: '42px', background: 'rgba(16,185,129,0.1)', color: '#10b981' }}><ArrowDownLeft size={18} /></div>
                <div className="flex-1 min-w-0"><div className="flex items-center gap-2"><span className="text-sm font-bold text-white">${d.amount}</span>{statusBadge(d.status)}</div><span className="text-xs" style={{ color: '#8fa5b8' }}>{d.txid} - {d.date}</span></div>
              </button>
            ))}
            {deposits.length === 0 && <p className="text-sm text-center py-8" style={{ color: '#5a6a7a' }}>Henüz yatırım talebi yok.</p>}
          </div>
        )}

        {/* Withdrawals Tab */}
        {activeTab === 'withdrawals' && (
          <div className="grid gap-2">
            {withdrawals.map((w) => (
              <button key={w.id} onClick={() => setDetailWithdraw(w)} className="glass-card flex items-center gap-4 text-left w-full transition-all hover:bg-white/5" style={{ padding: '14px 16px' }}>
                <div className="grid place-items-center rounded-lg shrink-0" style={{ width: '42px', height: '42px', background: 'rgba(255,215,0,0.1)', color: '#FFD700' }}><ArrowUpRight size={18} /></div>
                <div className="flex-1 min-w-0"><div className="flex items-center gap-2"><span className="text-sm font-bold text-white">${w.amount}</span>{statusBadge(w.status)}</div><span className="text-xs font-mono" style={{ color: '#8fa5b8' }}>{w.wallet}</span></div>
                <span className="text-xs shrink-0" style={{ color: '#5a6a7a' }}>{w.date}</span>
              </button>
            ))}
            {withdrawals.length === 0 && <p className="text-sm text-center py-8" style={{ color: '#5a6a7a' }}>Henüz çekim talebi yok.</p>}
          </div>
        )}

        {/* Members & Balance Tab */}
        {activeTab === 'members' && (
          <div className="grid gap-3">
            {user && (
              <div className="glass-card">
                <h2 className="text-base font-bold text-white mb-4">Üye Bilgileri</h2>
                <div className="space-y-3 mb-5">
                  {[{ l: 'E-posta', v: user.email }, { l: 'VIP Seviyesi', v: `VIP ${currentVip}` }, { l: 'Aktif Referans', v: `${activeRefs}` }, { l: 'Yatırım', v: `$${user.investment}` }, { l: 'Toplam Kazanç', v: `$${user.totalEarned.toFixed(2)}` }, { l: 'Toplam Tıklama', v: `${user.totalClicks}` }].map((item, i) => (
                    <div key={i} className="flex justify-between items-center"><span className="text-xs" style={{ color: '#8fa5b8' }}>{item.l}</span><span className="text-sm font-bold text-white">{item.v}</span></div>
                  ))}
                </div>
                <div className="flex items-center gap-3 pt-3" style={{ borderTop: '1px solid rgba(248,251,255,0.08)' }}>
                  <span className="text-xs" style={{ color: '#8fa5b8' }}>Bakiye</span>
                  {editingBalance ? (
                    <div className="flex items-center gap-2 flex-1 justify-end">
                      <input type="number" value={newBalance} onChange={(e) => setNewBalance(e.target.value)} className="glass-input" style={{ minHeight: '36px', width: '120px', fontSize: '13px' }} autoFocus />
                      <button onClick={handleUpdateBalance} className="grid place-items-center rounded-lg" style={{ width: '32px', height: '32px', background: 'rgba(16,185,129,0.15)', color: '#10b981' }}><Check size={16} /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-1 justify-end">
                      <span className="text-lg font-extrabold" style={{ color: '#FFD700' }}>${user.balance.toFixed(2)}</span>
                      <button onClick={() => { setEditingBalance(true); setNewBalance(String(user.balance)); }} className="grid place-items-center rounded-lg" style={{ width: '32px', height: '32px', background: 'rgba(255,215,0,0.1)', color: '#FFD700' }}><Edit3 size={14} /></button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIP System Tab */}
        {activeTab === 'vip' && (
          <div className="grid gap-3">
            <div className="glass-card">
              <h2 className="text-base font-bold text-white mb-4">VIP Seviyeleri & Kurlar</h2>
              <div className="grid gap-2">
                {VIP_TABLE.filter(v => v.level > 0).map((vip) => (
                  <div key={vip.level} className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: vip.level === currentVip ? 'rgba(255,215,0,0.08)' : 'rgba(255,255,255,0.03)', border: vip.level === currentVip ? '1px solid rgba(255,215,0,0.2)' : '1px solid rgba(248,251,255,0.05)' }}>
                    <div className="grid place-items-center rounded-lg shrink-0 font-extrabold" style={{ width: '42px', height: '42px', color: vip.level === currentVip ? '#FFD700' : '#5a6a7a', background: vip.level === currentVip ? 'rgba(255,215,0,0.12)' : 'rgba(255,255,255,0.04)' }}>V{vip.level}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">VIP {vip.level}</span>
                        {vip.level === currentVip && <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,215,0,0.15)', color: '#FFD700' }}>Aktif</span>}
                      </div>
                      <span className="text-xs" style={{ color: '#8fa5b8' }}>${vip.min.toLocaleString()}+ {vip.refsRequired > 0 ? `| ${vip.refsRequired} Referans` : ''}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-sm font-extrabold" style={{ color: '#FFD700' }}>%{vip.rate}</span>
                      <span className="text-xs block" style={{ color: '#5a6a7a' }}>Bileşik</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="glass-card">
              <h2 className="text-base font-bold text-white mb-2">Referans Komisyonları</h2>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { tier: 1, label: '1. Kademe', rate: '%10', color: '#FFD700' },
                  { tier: 2, label: '2. Kademe', rate: '%6', color: '#FFA500' },
                  { tier: 3, label: '3. Kademe', rate: '%3', color: '#FF8C00' },
                ].map((c) => (
                  <div key={c.tier} className="rounded-xl p-3 text-center" style={{ background: `${c.color}10`, border: `1px solid ${c.color}25` }}>
                    <span className="text-xs block mb-1" style={{ color: '#8fa5b8' }}>{c.label}</span>
                    <span className="text-lg font-extrabold" style={{ color: c.color }}>{c.rate}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tickets Tab */}
        {activeTab === 'tickets' && (
          <div className="grid gap-2">
            {tickets.length === 0 && <p className="text-sm text-center py-8" style={{ color: '#5a6a7a' }}>Henüz destek talebi yok.</p>}
            {tickets.map((ticket) => (
              <button key={ticket.id} onClick={() => setDetailTicket(ticket)} className="glass-card flex items-center gap-4 text-left w-full transition-all hover:bg-white/5" style={{ padding: '14px 16px' }}>
                <div className="grid place-items-center rounded-lg shrink-0" style={{ width: '42px', height: '42px', background: ticket.status === 'open' ? 'rgba(255,215,0,0.1)' : ticket.status === 'resolved' ? 'rgba(16,185,129,0.1)' : 'rgba(90,106,122,0.1)', color: ticket.status === 'open' ? '#FFD700' : ticket.status === 'resolved' ? '#10b981' : '#5a6a7a' }}>{ticket.status === 'closed' ? <Lock size={18} /> : <MessageCircle size={18} />}</div>
                <div className="flex-1 min-w-0"><div className="flex items-center gap-2"><span className="text-sm font-bold text-white truncate">{ticket.subject}</span>{statusBadge(ticket.status)}</div><span className="text-xs" style={{ color: '#8fa5b8' }}>{ticket.userEmail} - {ticket.createdAt}</span></div>
                <ChevronRight size={16} style={{ color: '#5a6a7a' }} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Detail: Deposit Modal */}
      {detailDeposit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}>
          <div className="w-full max-w-md animate-fade-in" style={{ background: 'rgba(5, 9, 20, 0.98)', border: '1px solid rgba(248,251,255,0.1)', borderRadius: '22px', padding: '24px', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
            <div className="flex items-center justify-between mb-5"><h3 className="text-lg font-bold text-white">Yatırım Talebi Detayı</h3><button onClick={() => setDetailDeposit(null)} className="btn-secondary" style={{ minHeight: '32px', width: '32px', padding: 0 }}><X size={14} /></button></div>
            <div className="space-y-3 mb-5">
              {[{ label: 'Miktar', value: `$${detailDeposit.amount}` }, { label: 'TX ID', value: detailDeposit.txid }, { label: 'Tarih', value: detailDeposit.date }, { label: 'Durum', value: '' }].map((item, i) => (
                <div key={i} className="flex justify-between items-center"><span className="text-xs" style={{ color: '#8fa5b8' }}>{item.label}</span>{item.label === 'Durum' ? statusBadge(detailDeposit.status) : <span className="text-sm font-bold text-white">{item.value}</span>}</div>
              ))}
            </div>
            {detailDeposit.status === 'pending' && (
              <div className="flex gap-3">
                <button onClick={() => handleApproveDeposit(detailDeposit.id)} className="flex-1 inline-flex items-center justify-center gap-2 font-extrabold text-sm rounded-xl text-white" style={{ minHeight: '46px', background: '#10b981' }}><Check size={16} />Onayla</button>
                <button onClick={() => handleRejectDeposit(detailDeposit.id)} className="flex-1 inline-flex items-center justify-center gap-2 font-extrabold text-sm rounded-xl text-white" style={{ minHeight: '46px', background: '#ef4444' }}><X size={16} />Reddet</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detail: Withdraw Modal */}
      {detailWithdraw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}>
          <div className="w-full max-w-md animate-fade-in" style={{ background: 'rgba(5, 9, 20, 0.98)', border: '1px solid rgba(248,251,255,0.1)', borderRadius: '22px', padding: '24px', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
            <div className="flex items-center justify-between mb-5"><h3 className="text-lg font-bold text-white">Çekim Talebi Detayı</h3><button onClick={() => setDetailWithdraw(null)} className="btn-secondary" style={{ minHeight: '32px', width: '32px', padding: 0 }}><X size={14} /></button></div>
            <div className="space-y-3 mb-5">
              {[{ label: 'Miktar', value: `$${detailWithdraw.amount}` }, { label: 'E-posta', value: detailWithdraw.email }, { label: 'Cüzdan Adresi (TRC20)', value: detailWithdraw.wallet }, { label: 'Tarih', value: detailWithdraw.date }, { label: 'Durum', value: '' }].map((item, i) => (
                <div key={i} className="flex justify-between items-center"><span className="text-xs" style={{ color: '#8fa5b8' }}>{item.label}</span>{item.label === 'Durum' ? statusBadge(detailWithdraw.status) : <span className={`text-sm font-bold ${item.label === 'Cüzdan Adresi (TRC20)' ? 'font-mono text-xs max-w-[200px] truncate' : 'text-white'}`}>{item.value}</span>}</div>
              ))}
            </div>
            {detailWithdraw.status === 'pending' && (
              <div className="flex gap-3">
                <button onClick={() => handleApproveWithdraw(detailWithdraw.id)} className="flex-1 inline-flex items-center justify-center gap-2 font-extrabold text-sm rounded-xl text-white" style={{ minHeight: '46px', background: '#10b981' }}><Check size={16} />Onayla (Ödendi)</button>
                <button onClick={() => handleRejectWithdraw(detailWithdraw.id)} className="flex-1 inline-flex items-center justify-center gap-2 font-extrabold text-sm rounded-xl text-white" style={{ minHeight: '46px', background: '#ef4444' }}><X size={16} />Reddet (İade)</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detail: Ticket Chat Modal */}
      {detailTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}>
          <div className="w-full max-w-lg animate-fade-in flex flex-col" style={{ background: 'rgba(5, 9, 20, 0.98)', border: '1px solid rgba(248,251,255,0.1)', borderRadius: '22px', padding: '24px', boxShadow: '0 24px 60px rgba(0,0,0,0.5)', maxHeight: '80vh' }}>
            <div className="flex items-center justify-between mb-4 shrink-0">
              <div><h3 className="text-lg font-bold text-white">{detailTicket.subject}</h3><div className="flex items-center gap-2 mt-1"><span className="text-xs" style={{ color: '#8fa5b8' }}>{detailTicket.userEmail}</span>{statusBadge(detailTicket.status)}</div></div>
              <div className="flex items-center gap-2">
                {detailTicket.status === 'open' && <button onClick={() => handleResolveTicket(detailTicket.id)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}><Check size={12} />Sorun Çözüldü</button>}
                {detailTicket.status !== 'closed' && <button onClick={() => handleCloseTicket(detailTicket.id)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}><X size={12} />Kapat</button>}
                <button onClick={() => setDetailTicket(null)} className="btn-secondary" style={{ minHeight: '32px', width: '32px', padding: 0 }}><X size={14} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 mb-4" style={{ maxHeight: '400px' }}>
              {detailTicket.messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.sender === 'admin' ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-[80%] rounded-2xl px-4 py-2.5" style={{ background: msg.sender === 'admin' ? 'linear-gradient(135deg, #FFD700, #FFA500)' : 'rgba(255,255,255,0.08)', color: msg.sender === 'admin' ? '#04070d' : '#c8d6e5', borderBottomRightRadius: msg.sender === 'admin' ? '4px' : '16px', borderBottomLeftRadius: msg.sender === 'user' ? '4px' : '16px' }}>
                    <p className="text-sm">{msg.text}</p><span className="text-[10px] opacity-60 block mt-1">{msg.time}</span>
                  </div>
                </div>
              ))}
            </div>
            {detailTicket.status !== 'closed' ? (
              <div className="flex gap-2 shrink-0"><input type="text" value={ticketReply} onChange={(e) => setTicketReply(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleReplyTicket()} placeholder="Yanıt yazın..." className="glass-input flex-1" style={{ minHeight: '44px' }} autoFocus /><button onClick={handleReplyTicket} className="btn-primary" style={{ width: '44px', minHeight: '44px', padding: 0 }}><Send size={16} /></button></div>
            ) : (<div className="text-center py-3 shrink-0"><Lock size={16} style={{ color: '#5a6a7a', margin: '0 auto' }} /><p className="text-xs mt-1" style={{ color: '#5a6a7a' }}>Bu ticket kapatılmıştır.</p></div>)}
          </div>
        </div>
      )}

      {/* Logout Dialog */}
      {showLogout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-sm animate-fade-in" style={{ background: 'rgba(5, 9, 20, 0.95)', border: '1px solid rgba(248,251,255,0.1)', borderRadius: '22px', padding: '24px', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
            <div className="text-center mb-5"><div className="mx-auto mb-3 grid place-items-center rounded-full" style={{ width: '56px', height: '56px', background: 'rgba(239,68,68,0.12)' }}><LogOut size={28} style={{ color: '#ef4444' }} /></div><h3 className="text-lg font-bold text-white mb-1">Çıkış Yap</h3><p className="text-sm" style={{ color: '#8fa5b8' }}>Admin panelinden çıkmak istiyor musunuz?</p></div>
            <div className="flex gap-3"><button onClick={() => setShowLogout(false)} className="btn-secondary flex-1">İptal</button><button onClick={() => { sessionStorage.removeItem('corevest_admin'); navigate('/'); }} className="flex-1 inline-flex items-center justify-center gap-2 font-extrabold text-sm rounded-xl text-white" style={{ minHeight: '46px', background: 'rgba(239,68,68,0.85)' }}><LogOut size={16} />Çıkış</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
