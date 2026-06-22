import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowDownLeft, ArrowUpRight, Users,
  Check, X, Wallet, Shield, LogOut,
  Send, MessageCircle, Lock, ChevronRight, Headphones,
  Search, Edit3, Gift, Eye, RefreshCw,
  TrendingUp, Plus, Pencil, Trash2, Bitcoin, Minus
} from 'lucide-react';
import LanguageSelector from '../components/LanguageSelector';
import { trpc } from '@/providers/trpc';
import { VIP_TABLE } from '../store';

type AdminTab = 'members' | 'deposits' | 'withdrawals' | 'tickets' | 'marketPrices' | 'walletAddresses';

export default function Admin() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminTab>('members');
  const [showLogout, setShowLogout] = useState(false);

  // For member detail modal
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // For edit modals
  const [editBalanceOpen, setEditBalanceOpen] = useState(false);
  const [editBalanceValue, setEditBalanceValue] = useState('');
  const [editVipOpen, setEditVipOpen] = useState(false);
  const [editVipValue, setEditVipValue] = useState(0);
  const [grantWheelOpen, setGrantWheelOpen] = useState(false);

  // Member user edit state
  const [resetPwOpen, setResetPwOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [editUserOpen, setEditUserOpen] = useState(false);
  const [editUserName, setEditUserName] = useState('');
  const [editUserEmail, setEditUserEmail] = useState('');

  // Wallet addresses state
  const [walletEditOpen, setWalletEditOpen] = useState(false);
  const [walletEditId, setWalletEditId] = useState<number | null>(null);

  // Market prices state
  const [marketEditOpen, setMarketEditOpen] = useState(false);
  const [marketEditId, setMarketEditId] = useState<number | null>(null);
  const [marketForm, setMarketForm] = useState({ symbol: '', name: '', basePrice: '', change: '', color: '#FFD700' });

  // Data queries
  const utils = trpc.useUtils();
  const { data: stats } = trpc.adminMember.stats.useQuery(undefined, { refetchInterval: 10000 });
  const { data: membersData } = trpc.adminMember.list.useQuery(
    { search: searchQuery || undefined, page: 1, limit: 50 },
    { refetchInterval: 10000 }
  );
  const { data: allDeposits = [] } = trpc.deposit.listAll.useQuery(undefined, { refetchInterval: 10000 });
  const { data: allWithdrawals = [] } = trpc.withdrawal.listAll.useQuery(undefined, { refetchInterval: 10000 });
  const { data: allTickets = [] } = trpc.ticket.listAll.useQuery(undefined, { refetchInterval: 10000 });
  const { data: allMarketPrices = [] } = trpc.marketPrice.listAll.useQuery(undefined, { refetchInterval: 10000 });
  const { data: allWalletAddresses = [] } = trpc.walletAddress.listAll.useQuery(undefined, { refetchInterval: 10000 });

  // Wheel spins adjustment state
  const [adjustSpinsValue, setAdjustSpinsValue] = useState('');
  const { data: memberDetail } = trpc.adminMember.detail.useQuery(
    { userId: selectedMemberId! },
    { enabled: selectedMemberId !== null }
  );

  // Mutations
  const updateBalance = trpc.adminMember.updateBalance.useMutation({ onSuccess: () => { utils.adminMember.list.invalidate(); utils.adminMember.detail.invalidate(); setEditBalanceOpen(false); } });
  const updateInvestment = trpc.adminMember.updateInvestment.useMutation({ onSuccess: () => { utils.adminMember.list.invalidate(); utils.adminMember.detail.invalidate(); } });
  const updateVip = trpc.adminMember.updateVip.useMutation({ onSuccess: () => { utils.adminMember.list.invalidate(); utils.adminMember.detail.invalidate(); setEditVipOpen(false); } });
  const approveDeposit = trpc.deposit.approve.useMutation({ onSuccess: () => utils.deposit.listAll.invalidate() });
  const rejectDeposit = trpc.deposit.reject.useMutation({ onSuccess: () => utils.deposit.listAll.invalidate() });
  const approveWithdraw = trpc.withdrawal.approve.useMutation({ onSuccess: () => utils.withdrawal.listAll.invalidate() });
  const rejectWithdraw = trpc.withdrawal.reject.useMutation({ onSuccess: () => utils.withdrawal.listAll.invalidate() });
  const adminReply = trpc.ticket.adminReply.useMutation({ onSuccess: () => { utils.ticket.listAll.invalidate(); setTicketReply(''); } });
  const resolveTicket = trpc.ticket.resolve.useMutation({ onSuccess: () => utils.ticket.listAll.invalidate() });
  const closeTicketAdmin = trpc.ticket.adminClose.useMutation({ onSuccess: () => utils.ticket.listAll.invalidate() });
  const deleteTicket = trpc.ticket.delete.useMutation({ onSuccess: () => { utils.ticket.listAll.invalidate(); setDetailTicket(null); } });
  const deleteMember = trpc.adminMember.delete.useMutation({ onSuccess: () => { utils.adminMember.list.invalidate(); utils.adminMember.stats.invalidate(); setSelectedMemberId(null); } });
  const updateUser = trpc.adminMember.updateUser.useMutation({ onSuccess: () => { utils.adminMember.list.invalidate(); utils.adminMember.detail.invalidate(); setEditUserOpen(false); } });
  const resetPassword = trpc.adminMember.resetPassword.useMutation({ onSuccess: () => { setResetPwOpen(false); setNewPassword(''); } });
  const adjustWheelSpins = trpc.adminMember.adjustWheelSpins.useMutation({ onSuccess: () => { utils.adminMember.detail.invalidate(); setAdjustSpinsValue(''); } });
  const createWalletAddr = trpc.walletAddress.create.useMutation({ onSuccess: () => { utils.walletAddress.listAll.invalidate(); setMarketForm({ symbol: '', name: '', basePrice: '', change: '', color: '#FFD700' }); } });
  const updateWalletAddr = trpc.walletAddress.update.useMutation({ onSuccess: () => { utils.walletAddress.listAll.invalidate(); setWalletEditOpen(false); setWalletEditId(null); } });
  const deleteWalletAddr = trpc.walletAddress.delete.useMutation({ onSuccess: () => utils.walletAddress.listAll.invalidate() });
  const createMarketPrice = trpc.marketPrice.create.useMutation({ onSuccess: () => { utils.marketPrice.listAll.invalidate(); setMarketForm({ symbol: '', name: '', basePrice: '', change: '', color: '#FFD700' }); } });
  const updateMarketPrice = trpc.marketPrice.update.useMutation({ onSuccess: () => { utils.marketPrice.listAll.invalidate(); setMarketEditOpen(false); setMarketEditId(null); } });
  const deleteMarketPrice = trpc.marketPrice.delete.useMutation({ onSuccess: () => utils.marketPrice.listAll.invalidate() });

  // Detail modals
  const [detailDeposit, setDetailDeposit] = useState<typeof allDeposits[0] | null>(null);
  const [detailWithdraw, setDetailWithdraw] = useState<typeof allWithdrawals[0] | null>(null);
  const [detailTicket, setDetailTicket] = useState<typeof allTickets[0] | null>(null);
  const [ticketReply, setTicketReply] = useState('');

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/#/login';
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, { bg: string; color: string; label: string }> = {
      pending: { bg: 'rgba(255,215,0,0.12)', color: '#FFD700', label: 'Beklemede' },
      approved: { bg: 'rgba(16,185,129,0.12)', color: '#10b981', label: 'Onaylandi' },
      rejected: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', label: 'Reddedildi' },
      cancelled: { bg: 'rgba(90,106,122,0.15)', color: '#5a6a7a', label: 'Iptal' },
      open: { bg: 'rgba(255,215,0,0.12)', color: '#FFD700', label: 'Beklemede' },
      resolved: { bg: 'rgba(16,185,129,0.12)', color: '#10b981', label: 'Çözüldü' },
      closed: { bg: 'rgba(90,106,122,0.15)', color: '#5a6a7a', label: 'Kapalı' },
    };
    const c = colors[status] || colors.pending;
    return <span className="text-[10px] font-extrabold px-2 py-1 rounded-full" style={{ background: c.bg, color: c.color }}>{c.label}</span>;
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

      <div className="px-4 pb-8" style={{ width: 'min(100%, 1200px)', margin: '0 auto' }}>
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {[
            { label: 'Toplam Üye', value: stats?.totalUsers ?? 0, icon: Users, color: '#FFD700' },
            { label: 'Bekleyen Yatırım', value: allDeposits.filter(d => d.status === 'pending').length, icon: ArrowDownLeft, color: '#10b981' },
            { label: 'Bekleyen Çekim', value: allWithdrawals.filter(w => w.status === 'pending').length, icon: ArrowUpRight, color: '#FFD700' },
            { label: 'Toplam Yatırım', value: `$${Math.round(stats?.totalInvestment ?? 0).toLocaleString()}`, icon: Wallet, color: '#35d7ff' },
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
            { key: 'members' as AdminTab, label: 'Uyeler', icon: Users },
            { key: 'deposits' as AdminTab, label: 'Yatırım Talepleri', icon: ArrowDownLeft },
            { key: 'withdrawals' as AdminTab, label: 'Çekim Talepleri', icon: ArrowUpRight },
            { key: 'tickets' as AdminTab, label: 'Destek Ticketları', icon: Headphones },
            { key: 'marketPrices' as AdminTab, label: 'Piyasa Fiyatları', icon: TrendingUp },
            { key: 'walletAddresses' as AdminTab, label: 'Cuzdan Adresleri', icon: Bitcoin },
          ].map((tab) => {
            const isActive = activeTab === tab.key;
            const Icon = tab.icon;
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all" style={{ background: isActive ? 'rgba(255,215,0,0.12)' : 'rgba(255,255,255,0.04)', border: isActive ? '1px solid rgba(255,215,0,0.2)' : '1px solid rgba(248,251,255,0.06)', color: isActive ? '#FFD700' : '#8fa5b8' }}>
                <Icon size={15} />{tab.label}
              </button>
            );
          })}
        </div>

        {/* ─── MEMBERS TAB ─── */}
        {activeTab === 'members' && (
          <div className="grid gap-3">
            {/* Search */}
            <div className="flex gap-2 mb-2">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#8fa5b8' }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="E-posta, isim veya referans kodu ara..."
                  className="glass-input pl-10"
                  style={{ minHeight: '44px' }}
                />
              </div>
            </div>

            {/* Members Table */}
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(248,251,255,0.08)' }}>
                      {['ID', 'E-posta', 'Isim', 'Bakiye', 'Yatirim', 'VIP', 'Tiklama', 'Referans', ''].map((h) => (
                        <th key={h} className="px-4 py-3 text-[10px] font-bold uppercase" style={{ color: '#8fa5b8' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(membersData?.members ?? []).map((m) => (
                      <tr key={m.id} className="transition-all hover:bg-white/5" style={{ borderBottom: '1px solid rgba(248,251,255,0.04)' }}>
                        <td className="px-4 py-3 text-xs text-white font-mono">{m.id}</td>
                        <td className="px-4 py-3 text-xs text-white">{m.email}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: '#8fa5b8' }}>{m.name}</td>
                        <td className="px-4 py-3 text-xs font-bold" style={{ color: '#FFD700' }}>${m.balance.toFixed(2)}</td>
                        <td className="px-4 py-3 text-xs text-white">${m.investment.toLocaleString()}</td>
                        <td className="px-4 py-3"><span className="text-[10px] font-extrabold px-2 py-1 rounded-full" style={{ background: 'rgba(255,215,0,0.12)', color: '#FFD700' }}>VIP{m.vipLevel}</span></td>
                        <td className="px-4 py-3 text-xs" style={{ color: '#8fa5b8' }}>{m.totalClicks}</td>
                        <td className="px-4 py-3 text-xs font-mono" style={{ color: '#8fa5b8' }}>{m.referralCode}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => setSelectedMemberId(m.id)} className="grid place-items-center rounded-lg" style={{ width: '32px', height: '32px', color: '#FFD700', background: 'rgba(255,215,0,0.1)' }} title="Detay"><Eye size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(!membersData?.members || membersData.members.length === 0) && <p className="text-sm text-center py-8" style={{ color: '#5a6a7a' }}>Uye bulunamadi.</p>}
            </div>
          </div>
        )}

        {/* ─── DEPOSITS TAB ─── */}
        {activeTab === 'deposits' && (
          <div className="grid gap-2">
            {allDeposits.map((d: any) => (
              <button key={d.id} onClick={() => setDetailDeposit(d)} className="glass-card flex items-center gap-4 text-left w-full transition-all hover:bg-white/5" style={{ padding: '14px 16px' }}>
                <div className="grid place-items-center rounded-lg shrink-0" style={{ width: '42px', height: '42px', background: 'rgba(16,185,129,0.1)', color: '#10b981' }}><ArrowDownLeft size={18} /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-white">${Number(d.amount).toFixed(2)}</span>
                    {statusBadge(d.status)}
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(100,100,255,0.12)', color: '#a78bfa' }}>{d.cryptoType?.toUpperCase() || 'TRC20'}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mt-1">
                    <span className="text-xs font-mono" style={{ color: '#8fa5b8' }}>#{d.userId}</span>
                    <span className="text-xs" style={{ color: '#5a6a7a' }}>|</span>
                    <span className="text-xs" style={{ color: '#8fa5b8' }}>{d.email && d.email.trim() ? d.email : (d.userEmail || '-')}</span>
                  </div>
                </div>
                <span className="text-xs shrink-0" style={{ color: '#5a6a7a' }}>{d.createdAt ? new Date(d.createdAt).toLocaleDateString() : ''}</span>
              </button>
            ))}
            {allDeposits.length === 0 && <p className="text-sm text-center py-8" style={{ color: '#5a6a7a' }}>Henuz yatirim talebi yok.</p>}
          </div>
        )}

        {/* ─── WITHDRAWALS TAB ─── */}
        {activeTab === 'withdrawals' && (
          <div className="grid gap-2">
            {allWithdrawals.map((w) => (
              <button key={w.id} onClick={() => setDetailWithdraw(w)} className="glass-card flex items-center gap-4 text-left w-full transition-all hover:bg-white/5" style={{ padding: '14px 16px' }}>
                <div className="grid place-items-center rounded-lg shrink-0" style={{ width: '42px', height: '42px', background: 'rgba(255,215,0,0.1)', color: '#FFD700' }}><ArrowUpRight size={18} /></div>
                <div className="flex-1 min-w-0"><div className="flex items-center gap-2"><span className="text-sm font-bold text-white">${Number(w.amount).toFixed(2)}</span>{statusBadge(w.status)}</div><span className="text-xs font-mono" style={{ color: '#8fa5b8' }}>{w.wallet}</span></div>
                <span className="text-xs shrink-0" style={{ color: '#5a6a7a' }}>{w.createdAt ? new Date(w.createdAt).toLocaleDateString() : ''}</span>
              </button>
            ))}
            {allWithdrawals.length === 0 && <p className="text-sm text-center py-8" style={{ color: '#5a6a7a' }}>Henuz cekim talebi yok.</p>}
          </div>
        )}

        {/* ─── TICKETS TAB ─── */}
        {activeTab === 'tickets' && (
          <div className="grid gap-2">
            {allTickets.length === 0 && <p className="text-sm text-center py-8" style={{ color: '#5a6a7a' }}>Henuz destek talebi yok.</p>}
            {allTickets.map((ticket) => (
              <button key={ticket.id} onClick={() => setDetailTicket(ticket)} className="glass-card flex items-center gap-4 text-left w-full transition-all hover:bg-white/5" style={{ padding: '14px 16px' }}>
                <div className="grid place-items-center rounded-lg shrink-0" style={{ width: '42px', height: '42px', background: ticket.status === 'open' ? 'rgba(255,215,0,0.1)' : ticket.status === 'resolved' ? 'rgba(16,185,129,0.1)' : 'rgba(90,106,122,0.1)', color: ticket.status === 'open' ? '#FFD700' : ticket.status === 'resolved' ? '#10b981' : '#5a6a7a' }}>{ticket.status === 'closed' ? <Lock size={18} /> : <MessageCircle size={18} />}</div>
                <div className="flex-1 min-w-0"><div className="flex items-center gap-2"><span className="text-sm font-bold text-white truncate">{ticket.subject}</span>{statusBadge(ticket.status)}</div><span className="text-xs" style={{ color: '#8fa5b8' }}>{ticket.userEmail} - {ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString() : ''}</span></div>
                <ChevronRight size={16} style={{ color: '#5a6a7a' }} />
              </button>
            ))}
          </div>
        )}

        {/* ─── WALLET ADDRESSES TAB ─── */}
        {activeTab === 'walletAddresses' && (
          <div className="grid gap-3">
            {/* Add New Form */}
            <div className="glass-card" style={{ padding: '16px' }}>
              <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <Plus size={16} style={{ color: '#FFD700' }} /> Yeni Cuzdan Adresi Ekle
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <input type="text" value={marketForm.symbol} onChange={(e) => setMarketForm(p => ({ ...p, symbol: e.target.value }))} placeholder="Anahtar (trc20)" className="glass-input" style={{ minHeight: '38px', fontSize: '12px' }} />
                <input type="text" value={marketForm.name} onChange={(e) => setMarketForm(p => ({ ...p, name: e.target.value }))} placeholder="Etiket (USDT TRC20)" className="glass-input" style={{ minHeight: '38px', fontSize: '12px' }} />
                <input type="text" value={marketForm.basePrice} onChange={(e) => setMarketForm(p => ({ ...p, basePrice: e.target.value }))} placeholder="Adres" className="glass-input" style={{ minHeight: '38px', fontSize: '12px' }} />
                <div className="flex gap-2">
                  <input type="color" value={marketForm.color} onChange={(e) => setMarketForm(p => ({ ...p, color: e.target.value }))} style={{ width: '38px', height: '38px', border: 'none', borderRadius: '10px', cursor: 'pointer', background: 'transparent' }} />
                  <button onClick={() => { if (!marketForm.symbol || !marketForm.name || !marketForm.basePrice) return; createWalletAddr.mutate({ key: marketForm.symbol, label: marketForm.name, address: marketForm.basePrice, color: marketForm.color }); setMarketForm(p => ({ ...p, symbol: '', name: '', basePrice: '', change: '' })); }} className="btn-primary flex-1" style={{ minHeight: '38px', fontSize: '12px' }}><Plus size={14} />Ekle</button>
                </div>
              </div>
            </div>

            {/* Edit Form */}
            {walletEditOpen && walletEditId !== null && (
              <div className="glass-card" style={{ padding: '16px', border: '1px solid rgba(255,215,0,0.2)', background: 'rgba(255,215,0,0.04)' }}>
                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <Pencil size={16} style={{ color: '#FFD700' }} /> Duzenle
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <input type="text" value={marketForm.symbol} onChange={(e) => setMarketForm(p => ({ ...p, symbol: e.target.value }))} placeholder="Anahtar" className="glass-input" style={{ minHeight: '38px', fontSize: '12px' }} />
                  <input type="text" value={marketForm.name} onChange={(e) => setMarketForm(p => ({ ...p, name: e.target.value }))} placeholder="Etiket" className="glass-input" style={{ minHeight: '38px', fontSize: '12px' }} />
                  <input type="text" value={marketForm.basePrice} onChange={(e) => setMarketForm(p => ({ ...p, basePrice: e.target.value }))} placeholder="Adres" className="glass-input" style={{ minHeight: '38px', fontSize: '12px' }} />
                  <div className="flex gap-2">
                    <input type="color" value={marketForm.color} onChange={(e) => setMarketForm(p => ({ ...p, color: e.target.value }))} style={{ width: '38px', height: '38px', border: 'none', borderRadius: '10px', cursor: 'pointer', background: 'transparent' }} />
                    <button onClick={() => { if (!walletEditId) return; updateWalletAddr.mutate({ id: walletEditId, key: marketForm.symbol || undefined, label: marketForm.name || undefined, address: marketForm.basePrice || undefined, color: marketForm.color || undefined }); }} className="btn-primary flex-1" style={{ minHeight: '38px', fontSize: '12px' }}><Check size={14} />Kaydet</button>
                    <button onClick={() => { setWalletEditOpen(false); setWalletEditId(null); }} className="btn-secondary" style={{ minHeight: '38px', width: '38px', padding: 0 }}><X size={14} /></button>
                  </div>
                </div>
              </div>
            )}

            {/* Wallet Addresses Table */}
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(248,251,255,0.08)' }}>
                      {['Anahtar', 'Etiket', 'Adres', 'Renk', 'Durum', ''].map((h) => (
                        <th key={h} className="px-4 py-3 text-[10px] font-bold uppercase" style={{ color: '#8fa5b8' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allWalletAddresses.map((w: any) => (
                      <tr key={w.id} className="transition-all hover:bg-white/5" style={{ borderBottom: '1px solid rgba(248,251,255,0.04)' }}>
                        <td className="px-4 py-3 text-xs font-bold text-white">{w.key}</td>
                        <td className="px-4 py-3 text-xs text-white">{w.label}</td>
                        <td className="px-4 py-3 text-xs font-mono" style={{ color: '#8fa5b8' }}>{w.address}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="rounded-full" style={{ width: '14px', height: '14px', background: w.color }} />
                            <span className="text-xs font-mono" style={{ color: '#8fa5b8' }}>{w.color}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">{statusBadge(w.active === 1 ? 'approved' : 'rejected')}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => { setWalletEditId(w.id); setMarketForm({ symbol: w.key, name: w.label, basePrice: w.address, change: '', color: w.color }); setWalletEditOpen(true); }} className="grid place-items-center rounded-lg" style={{ width: '30px', height: '30px', color: '#FFD700', background: 'rgba(255,215,0,0.1)' }} title="Duzenle"><Pencil size={12} /></button>
                            <button onClick={() => { if (confirm(`${w.label} silinecek. Emin misiniz?`)) deleteWalletAddr.mutate({ id: w.id }); }} className="grid place-items-center rounded-lg" style={{ width: '30px', height: '30px', color: '#ef4444', background: 'rgba(239,68,68,0.1)' }} title="Sil"><Trash2 size={12} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {allWalletAddresses.length === 0 && <p className="text-sm text-center py-8" style={{ color: '#5a6a7a' }}>Henüz cuzdan adresi eklenmemis.</p>}
            </div>
          </div>
        )}

        {/* ─── MARKET PRICES TAB ─── */}
        {activeTab === 'marketPrices' && (
          <div className="grid gap-3">
            {/* Add New Form */}
            <div className="glass-card" style={{ padding: '16px' }}>
              <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <Plus size={16} style={{ color: '#FFD700' }} /> Yeni Kripto Para Ekle
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <input type="text" value={marketForm.symbol} onChange={(e) => setMarketForm(p => ({ ...p, symbol: e.target.value }))} placeholder="Sembol (BTC)" className="glass-input" style={{ minHeight: '38px', fontSize: '12px' }} />
                <input type="text" value={marketForm.name} onChange={(e) => setMarketForm(p => ({ ...p, name: e.target.value }))} placeholder="Isim (Bitcoin)" className="glass-input" style={{ minHeight: '38px', fontSize: '12px' }} />
                <input type="text" value={marketForm.basePrice} onChange={(e) => setMarketForm(p => ({ ...p, basePrice: e.target.value }))} placeholder="Fiyat" className="glass-input" style={{ minHeight: '38px', fontSize: '12px' }} />
                <input type="text" value={marketForm.change} onChange={(e) => setMarketForm(p => ({ ...p, change: e.target.value }))} placeholder="Degisim %" className="glass-input" style={{ minHeight: '38px', fontSize: '12px' }} />
                <div className="flex gap-2">
                  <input type="color" value={marketForm.color} onChange={(e) => setMarketForm(p => ({ ...p, color: e.target.value }))} style={{ width: '38px', height: '38px', border: 'none', borderRadius: '10px', cursor: 'pointer', background: 'transparent' }} />
                  <button onClick={() => { if (!marketForm.symbol || !marketForm.name || !marketForm.basePrice || !marketForm.change) return; createMarketPrice.mutate({ symbol: marketForm.symbol, name: marketForm.name, basePrice: marketForm.basePrice, change: marketForm.change, color: marketForm.color }); }} className="btn-primary flex-1" style={{ minHeight: '38px', fontSize: '12px' }}><Plus size={14} />Ekle</button>
                </div>
              </div>
            </div>

            {/* Edit Form */}
            {marketEditOpen && marketEditId !== null && (
              <div className="glass-card" style={{ padding: '16px', border: '1px solid rgba(255,215,0,0.2)', background: 'rgba(255,215,0,0.04)' }}>
                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <Pencil size={16} style={{ color: '#FFD700' }} /> Duzenle
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <input type="text" value={marketForm.symbol} onChange={(e) => setMarketForm(p => ({ ...p, symbol: e.target.value }))} placeholder="Sembol" className="glass-input" style={{ minHeight: '38px', fontSize: '12px' }} />
                  <input type="text" value={marketForm.name} onChange={(e) => setMarketForm(p => ({ ...p, name: e.target.value }))} placeholder="Isim" className="glass-input" style={{ minHeight: '38px', fontSize: '12px' }} />
                  <input type="text" value={marketForm.basePrice} onChange={(e) => setMarketForm(p => ({ ...p, basePrice: e.target.value }))} placeholder="Fiyat" className="glass-input" style={{ minHeight: '38px', fontSize: '12px' }} />
                  <input type="text" value={marketForm.change} onChange={(e) => setMarketForm(p => ({ ...p, change: e.target.value }))} placeholder="Degisim %" className="glass-input" style={{ minHeight: '38px', fontSize: '12px' }} />
                  <div className="flex gap-2">
                    <input type="color" value={marketForm.color} onChange={(e) => setMarketForm(p => ({ ...p, color: e.target.value }))} style={{ width: '38px', height: '38px', border: 'none', borderRadius: '10px', cursor: 'pointer', background: 'transparent' }} />
                    <button onClick={() => { if (!marketEditId) return; updateMarketPrice.mutate({ id: marketEditId, symbol: marketForm.symbol || undefined, name: marketForm.name || undefined, basePrice: marketForm.basePrice || undefined, change: marketForm.change || undefined, color: marketForm.color || undefined }); }} className="btn-primary flex-1" style={{ minHeight: '38px', fontSize: '12px' }}><Check size={14} />Kaydet</button>
                    <button onClick={() => { setMarketEditOpen(false); setMarketEditId(null); }} className="btn-secondary" style={{ minHeight: '38px', width: '38px', padding: 0 }}><X size={14} /></button>
                  </div>
                </div>
              </div>
            )}

            {/* Market Prices Table */}
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(248,251,255,0.08)' }}>
                      {['Sembol', 'Isim', 'Fiyat', 'Degisim', 'Renk', 'Durum', ''].map((h) => (
                        <th key={h} className="px-4 py-3 text-[10px] font-bold uppercase" style={{ color: '#8fa5b8' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allMarketPrices.map((coin: { id: number; symbol: string; name: string; basePrice: string | number; change: string | number; color: string; active: number }) => (
                      <tr key={coin.id} className="transition-all hover:bg-white/5" style={{ borderBottom: '1px solid rgba(248,251,255,0.04)' }}>
                        <td className="px-4 py-3">
                          <div className="grid place-items-center rounded-lg font-extrabold text-xs shrink-0" style={{ width: '36px', height: '36px', background: `${coin.color}18`, color: coin.color }}>{coin.symbol.slice(0, 2)}</div>
                        </td>
                        <td className="px-4 py-3 text-xs text-white font-bold">{coin.name}</td>
                        <td className="px-4 py-3 text-xs text-white">${Number(coin.basePrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</td>
                        <td className="px-4 py-3 text-xs font-semibold" style={{ color: Number(coin.change) >= 0 ? '#10b981' : '#ef4444' }}>{Number(coin.change) >= 0 ? '+' : ''}{Number(coin.change).toFixed(2)}%</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="rounded-full" style={{ width: '14px', height: '14px', background: coin.color }} />
                            <span className="text-xs font-mono" style={{ color: '#8fa5b8' }}>{coin.color}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">{statusBadge(coin.active === 1 ? 'approved' : 'rejected')}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => { setMarketEditId(coin.id); setMarketForm({ symbol: coin.symbol, name: coin.name, basePrice: String(coin.basePrice), change: String(coin.change), color: coin.color }); setMarketEditOpen(true); }} className="grid place-items-center rounded-lg" style={{ width: '30px', height: '30px', color: '#FFD700', background: 'rgba(255,215,0,0.1)' }} title="Duzenle"><Pencil size={12} /></button>
                            <button onClick={() => { if (confirm(`${coin.symbol} silinecek. Emin misiniz?`)) deleteMarketPrice.mutate({ id: coin.id }); }} className="grid place-items-center rounded-lg" style={{ width: '30px', height: '30px', color: '#ef4444', background: 'rgba(239,68,68,0.1)' }} title="Sil"><Trash2 size={12} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {allMarketPrices.length === 0 && <p className="text-sm text-center py-8" style={{ color: '#5a6a7a' }}>Henuz kripto para eklenmemis.</p>}
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════
          MODAL: Member Detail
          ═══════════════════════════════════════════ */}
      {selectedMemberId && memberDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}>
          <div className="w-full max-w-lg animate-fade-in max-h-[85vh] overflow-y-auto" style={{ background: 'rgba(5, 9, 20, 0.98)', border: '1px solid rgba(248,251,255,0.1)', borderRadius: '22px', padding: '24px', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-white">Üye Detayı</h3>
              <button onClick={() => setSelectedMemberId(null)} className="btn-secondary" style={{ minHeight: '32px', width: '32px', padding: 0 }}><X size={14} /></button>
            </div>

            {/* User Info */}
            <div className="space-y-3 mb-5">
              <div className="flex justify-between items-center">
                <span className="text-xs" style={{ color: '#8fa5b8' }}>ID</span>
                <span className="text-sm font-bold text-white">{memberDetail.id}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs" style={{ color: '#8fa5b8' }}>E-posta</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">{memberDetail.email}</span>
                  <button onClick={() => { setEditUserName(memberDetail.name || ''); setEditUserEmail(memberDetail.email || ''); setEditUserOpen(true); }} className="grid place-items-center rounded-lg" style={{ width: '26px', height: '26px', color: '#FFD700', background: 'rgba(255,215,0,0.1)' }} title="Duzenle"><Edit3 size={12} /></button>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs" style={{ color: '#8fa5b8' }}>Isim</span>
                <span className="text-sm font-bold text-white">{memberDetail.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs" style={{ color: '#8fa5b8' }}>Rol</span>
                <span className="text-[10px] font-extrabold px-2 py-1 rounded-full" style={{ background: memberDetail.role === 'admin' ? 'rgba(255,215,0,0.12)' : 'rgba(255,255,255,0.06)', color: memberDetail.role === 'admin' ? '#FFD700' : '#8fa5b8' }}>{memberDetail.role}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs" style={{ color: '#8fa5b8' }}>Sifre</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono" style={{ color: '#5a6a7a' }}>************ (hash)</span>
                  <button onClick={() => { setNewPassword(''); setResetPwOpen(true); }} className="grid place-items-center rounded-lg" style={{ width: '26px', height: '26px', color: '#FFD700', background: 'rgba(255,215,0,0.1)' }} title="Sifre Sifirla"><Lock size={12} /></button>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs" style={{ color: '#8fa5b8' }}>Uyelik Tarihi</span>
                <span className="text-sm text-white">{memberDetail.createdAt ? new Date(memberDetail.createdAt).toLocaleDateString() : '-'}</span>
              </div>
            </div>

            {/* Edit User Info Form */}
            {editUserOpen && (
              <div className="mb-4 p-4 rounded-xl" style={{ background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.2)' }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-bold text-white">Kullanici Bilgilerini Duzenle</span>
                  <button onClick={() => setEditUserOpen(false)} className="btn-secondary" style={{ minHeight: '28px', width: '28px', padding: 0 }}><X size={12} /></button>
                </div>
                <div className="space-y-2 mb-3">
                  <div>
                    <label className="label-text block mb-1">Isim</label>
                    <input type="text" value={editUserName} onChange={(e) => setEditUserName(e.target.value)} placeholder="Isim girin" className="glass-input" style={{ minHeight: '40px' }} />
                  </div>
                  <div>
                    <label className="label-text block mb-1">E-posta</label>
                    <input type="email" value={editUserEmail} onChange={(e) => setEditUserEmail(e.target.value)} placeholder="E-posta girin" className="glass-input" style={{ minHeight: '40px' }} />
                  </div>
                </div>
                <button onClick={() => updateUser.mutate({ userId: selectedMemberId, name: editUserName || undefined, email: editUserEmail || undefined })} className="btn-primary w-full" style={{ minHeight: '38px', fontSize: '12px' }}>Kaydet</button>
              </div>
            )}

            {/* Reset Password Form */}
            {resetPwOpen && (
              <div className="mb-4 p-4 rounded-xl" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-bold text-white">Sifre Sifirla</span>
                  <button onClick={() => setResetPwOpen(false)} className="btn-secondary" style={{ minHeight: '28px', width: '28px', padding: 0 }}><X size={12} /></button>
                </div>
                <p className="text-xs mb-2" style={{ color: '#8fa5b8' }}>
                  Uyenin mevcut sifresi hashlenmis olarak saklanir. Asla gorulemez. Yeni bir sifre atayabilirsiniz.
                </p>
                <div className="mb-2">
                  <label className="label-text block mb-1">Yeni Sifre</label>
                  <input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="En az 6 karakter" className="glass-input" style={{ minHeight: '40px' }} />
                </div>
                <button onClick={() => { if (!newPassword || newPassword.length < 6) return; resetPassword.mutate({ userId: selectedMemberId, newPassword }); }} className="btn-primary w-full" style={{ minHeight: '38px', fontSize: '12px', background: 'rgba(239,68,68,0.85)' }}>
                  Sifreyi Guncelle
                </button>
              </div>
            )}

            {memberDetail.profile && (
              <>
                <div className="h-px my-4" style={{ background: 'rgba(248,251,255,0.08)' }} />

                {/* Profile Info */}
                <div className="space-y-3 mb-5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs" style={{ color: '#8fa5b8' }}>Bakiye</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold" style={{ color: '#FFD700' }}>${memberDetail.profile.balance.toFixed(2)}</span>
                      <button onClick={() => { setEditBalanceValue(String(memberDetail.profile!.balance)); setEditBalanceOpen(true); }} className="grid place-items-center rounded-lg" style={{ width: '26px', height: '26px', color: '#FFD700', background: 'rgba(255,215,0,0.1)' }}><Edit3 size={12} /></button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs" style={{ color: '#8fa5b8' }}>Yatirim</span>
                    <span className="text-sm font-bold text-white">${memberDetail.profile.investment.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs" style={{ color: '#8fa5b8' }}>VIP Seviye</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold" style={{ color: '#FFD700' }}>VIP {memberDetail.profile.vipLevel}</span>
                      <button onClick={() => { setEditVipValue(memberDetail.profile!.vipLevel); setEditVipOpen(true); }} className="grid place-items-center rounded-lg" style={{ width: '26px', height: '26px', color: '#FFD700', background: 'rgba(255,215,0,0.1)' }}><Edit3 size={12} /></button>
                    </div>
                  </div>
                  <div className="flex justify-between"><span className="text-xs" style={{ color: '#8fa5b8' }}>Toplam Kazanc</span><span className="text-sm text-white">${memberDetail.profile.totalEarned.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-xs" style={{ color: '#8fa5b8' }}>Toplam Tiklama</span><span className="text-sm text-white">{memberDetail.profile.totalClicks}</span></div>
                  <div className="flex justify-between"><span className="text-xs" style={{ color: '#8fa5b8' }}>Ardışık Tıklama</span><span className="text-sm text-white">{memberDetail.profile.consecutiveClicks}</span></div>
                  <div className="flex justify-between"><span className="text-xs" style={{ color: '#8fa5b8' }}>Aylık Çekim</span><span className="text-sm text-white">{memberDetail.profile.monthlyWithdrawalCount}</span></div>
                  <div className="flex justify-between"><span className="text-xs" style={{ color: '#8fa5b8' }}>Referans Kodu</span><span className="text-sm font-mono text-white">{memberDetail.profile.referralCode}</span></div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs" style={{ color: '#8fa5b8' }}>Cark Hakki</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold" style={{ color: '#FFD700' }}>{memberDetail.availableSpins ?? 0} mevcut</span>
                      <span className="text-xs" style={{ color: '#5a6a7a' }}>({memberDetail.wheelSpinsUsed ?? 0} kullanildi)</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs" style={{ color: '#8fa5b8' }}>Referans Kazanci</span>
                    <span className="text-sm font-bold" style={{ color: '#10b981' }}>${(memberDetail as any).totalReferralEarnings?.toFixed(2) ?? '0.00'}</span>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setGrantWheelOpen(true)} className="btn-primary" style={{ fontSize: '12px', minHeight: '38px' }}><Gift size={14} />Cark Hakki</button>
                  <button onClick={() => { updateInvestment.mutate({ userId: selectedMemberId, newInvestment: memberDetail.profile!.investment }); }} className="btn-secondary" style={{ fontSize: '12px', minHeight: '38px' }}><RefreshCw size={14} />Yatirimi Guncelle</button>
                </div>
                <div className="mt-2">
                  <button onClick={() => { if (confirm(`Üye #${selectedMemberId} - ${memberDetail.email} kalıcı olarak silinecek. Emin misiniz?`)) deleteMember.mutate({ userId: selectedMemberId }); }} className="w-full flex items-center justify-center gap-2 font-bold text-sm rounded-xl text-white" style={{ minHeight: '38px', fontSize: '12px', background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.3)' }}><X size={14} />Üyeliği Sil</button>
                </div>
              </>
            )}

            {/* Edit Balance Modal */}
            {editBalanceOpen && (
              <div className="mt-4 p-4 rounded-xl" style={{ background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.2)' }}>
                <div className="flex items-center justify-between mb-2"><span className="text-sm font-bold text-white">Bakiye Düzenle</span><button onClick={() => setEditBalanceOpen(false)} className="btn-secondary" style={{ minHeight: '28px', width: '28px', padding: 0 }}><X size={12} /></button></div>
                <input type="number" value={editBalanceValue} onChange={(e) => setEditBalanceValue(e.target.value)} className="glass-input mb-2" style={{ minHeight: '40px' }} />
                <button onClick={() => updateBalance.mutate({ userId: selectedMemberId, newBalance: Number(editBalanceValue) })} className="btn-primary w-full" style={{ minHeight: '38px', fontSize: '12px' }}>Kaydet</button>
              </div>
            )}

            {/* Edit VIP Modal */}
            {editVipOpen && (
              <div className="mt-4 p-4 rounded-xl" style={{ background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.2)' }}>
                <div className="flex items-center justify-between mb-2"><span className="text-sm font-bold text-white">VIP Seviye Düzenle</span><button onClick={() => setEditVipOpen(false)} className="btn-secondary" style={{ minHeight: '28px', width: '28px', padding: 0 }}><X size={12} /></button></div>
                <select value={editVipValue} onChange={(e) => setEditVipValue(Number(e.target.value))} className="glass-input mb-2" style={{ minHeight: '40px', color: '#fff' }}>
                  {VIP_TABLE.map(v => <option key={v.level} value={v.level}>VIP {v.level} - {v.min}$+</option>)}
                </select>
                <button onClick={() => updateVip.mutate({ userId: selectedMemberId, vipLevel: editVipValue })} className="btn-primary w-full" style={{ minHeight: '38px', fontSize: '12px' }}>Kaydet</button>
              </div>
            )}

            {/* Referral Earnings List */}
            {(memberDetail as any).referralEarnings && (memberDetail as any).referralEarnings.length > 0 && (
              <div className="mt-4">
                <h4 className="text-xs font-bold mb-2" style={{ color: '#8fa5b8' }}>SON REFERANS KAZANCLARI</h4>
                <div className="grid gap-1 max-h-[150px] overflow-y-auto">
                  {(memberDetail as any).referralEarnings.slice(0, 10).map((e: any) => (
                    <div key={e.id} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(248,251,255,0.04)' }}>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: e.tier === 1 ? 'rgba(255,215,0,0.12)' : e.tier === 2 ? 'rgba(139,92,246,0.12)' : 'rgba(53,215,255,0.12)', color: e.tier === 1 ? '#FFD700' : e.tier === 2 ? '#8b5cf6' : '#35d7ff' }}>Tier-{e.tier}</span>
                        <span className="text-xs" style={{ color: '#8fa5b8' }}>#{e.referredUserId}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold" style={{ color: '#10b981' }}>+${e.commissionAmount.toFixed(2)}</span>
                        <span className="text-[10px] ml-1" style={{ color: '#5a6a7a' }}>(%{e.commissionRate})</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Adjust Wheel Spins Modal */}
            {grantWheelOpen && (
              <div className="mt-4 p-4 rounded-xl" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-white">Cark Hakki Ayarla</span>
                  <button onClick={() => setGrantWheelOpen(false)} className="btn-secondary" style={{ minHeight: '28px', width: '28px', padding: 0 }}><X size={12} /></button>
                </div>
                <p className="text-xs mb-2" style={{ color: '#8fa5b8' }}>
                  Mevcut: <strong style={{ color: '#FFD700' }}>{memberDetail.availableSpins ?? 0}</strong> hak | 
                  Pozitif = ekle, Negatif = cikar
                </p>
                <div className="flex gap-2 mb-2">
                  <button onClick={() => { const v = Number(adjustSpinsValue || '0'); setAdjustSpinsValue(String(v - 1)); }} className="btn-secondary" style={{ minHeight: '40px', width: '40px', padding: 0 }}><Minus size={16} /></button>
                  <input type="number" value={adjustSpinsValue} onChange={(e) => setAdjustSpinsValue(e.target.value)} placeholder="Orn: 5 veya -3" className="glass-input flex-1" style={{ minHeight: '40px', textAlign: 'center' }} />
                  <button onClick={() => { const v = Number(adjustSpinsValue || '0'); setAdjustSpinsValue(String(v + 1)); }} className="btn-secondary" style={{ minHeight: '40px', width: '40px', padding: 0 }}><Plus size={16} /></button>
                </div>
                <button onClick={() => { if (!adjustSpinsValue) return; adjustWheelSpins.mutate({ userId: selectedMemberId, spins: Number(adjustSpinsValue) }); }} className="btn-primary w-full" style={{ minHeight: '38px', fontSize: '12px' }}>
                  Uygula
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          MODAL: Deposit Detail
          ═══════════════════════════════════════════ */}
      {detailDeposit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}>
          <div className="w-full max-w-md animate-fade-in" style={{ background: 'rgba(5, 9, 20, 0.98)', border: '1px solid rgba(248,251,255,0.1)', borderRadius: '22px', padding: '24px', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
            <div className="flex items-center justify-between mb-5"><h3 className="text-lg font-bold text-white">Yatirim Talebi Detayi</h3><button onClick={() => setDetailDeposit(null)} className="btn-secondary" style={{ minHeight: '32px', width: '32px', padding: 0 }}><X size={14} /></button></div>
            <div className="space-y-3 mb-5">
              <div className="flex justify-between"><span className="text-xs" style={{ color: '#8fa5b8' }}>Miktar</span><span className="text-sm font-bold text-white">${Number(detailDeposit.amount).toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-xs" style={{ color: '#8fa5b8' }}>Kripto</span><span className="text-sm font-bold text-white">{(detailDeposit as any).cryptoType?.toUpperCase() || 'TRC20'}</span></div>
              <div className="flex justify-between"><span className="text-xs" style={{ color: '#8fa5b8' }}>Kullanici ID</span><span className="text-sm font-bold text-white">#{detailDeposit.userId}</span></div>
              <div className="flex justify-between"><span className="text-xs" style={{ color: '#8fa5b8' }}>E-posta</span><span className="text-sm font-bold text-white">{(detailDeposit as any).email || (detailDeposit as any).userEmail || '-'}</span></div>
              {(detailDeposit as any).userNote && <div className="flex justify-between"><span className="text-xs" style={{ color: '#8fa5b8' }}>Not</span><span className="text-sm text-white">{(detailDeposit as any).userNote}</span></div>}
              <div className="flex justify-between"><span className="text-xs" style={{ color: '#8fa5b8' }}>TX ID</span><span className="text-xs font-mono text-white">{detailDeposit.txid}</span></div>
              <div className="flex justify-between"><span className="text-xs" style={{ color: '#8fa5b8' }}>Durum</span>{statusBadge(detailDeposit.status)}</div>
            </div>
            {detailDeposit.status === 'pending' && (
              <div className="flex gap-3">
                <button onClick={() => { approveDeposit.mutate({ id: detailDeposit.id }); setDetailDeposit(null); }} className="flex-1 inline-flex items-center justify-center gap-2 font-extrabold text-sm rounded-xl text-white" style={{ minHeight: '46px', background: '#10b981' }}><Check size={16} />Onayla</button>
                <button onClick={() => { rejectDeposit.mutate({ id: detailDeposit.id }); setDetailDeposit(null); }} className="flex-1 inline-flex items-center justify-center gap-2 font-extrabold text-sm rounded-xl text-white" style={{ minHeight: '46px', background: '#ef4444' }}><X size={16} />Reddet</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          MODAL: Withdrawal Detail
          ═══════════════════════════════════════════ */}
      {detailWithdraw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}>
          <div className="w-full max-w-md animate-fade-in" style={{ background: 'rgba(5, 9, 20, 0.98)', border: '1px solid rgba(248,251,255,0.1)', borderRadius: '22px', padding: '24px', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
            <div className="flex items-center justify-between mb-5"><h3 className="text-lg font-bold text-white">Cekim Talebi Detayi</h3><button onClick={() => setDetailWithdraw(null)} className="btn-secondary" style={{ minHeight: '32px', width: '32px', padding: 0 }}><X size={14} /></button></div>
            <div className="space-y-3 mb-5">
              <div className="flex justify-between"><span className="text-xs" style={{ color: '#8fa5b8' }}>Miktar</span><span className="text-sm font-bold text-white">${Number(detailWithdraw.amount).toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-xs" style={{ color: '#8fa5b8' }}>E-posta</span><span className="text-sm font-bold text-white">{detailWithdraw.email}</span></div>
              <div className="flex justify-between"><span className="text-xs" style={{ color: '#8fa5b8' }}>Cuzdan</span><span className="text-xs font-mono font-bold text-white">{detailWithdraw.wallet}</span></div>
              <div className="flex justify-between"><span className="text-xs" style={{ color: '#8fa5b8' }}>Durum</span>{statusBadge(detailWithdraw.status)}</div>
            </div>
            {detailWithdraw.status === 'pending' && (
              <div className="flex gap-3">
                <button onClick={() => { approveWithdraw.mutate({ id: detailWithdraw.id }); setDetailWithdraw(null); }} className="flex-1 inline-flex items-center justify-center gap-2 font-extrabold text-sm rounded-xl text-white" style={{ minHeight: '46px', background: '#10b981' }}><Check size={16} />Onayla (Odundi)</button>
                <button onClick={() => { rejectWithdraw.mutate({ id: detailWithdraw.id }); setDetailWithdraw(null); }} className="flex-1 inline-flex items-center justify-center gap-2 font-extrabold text-sm rounded-xl text-white" style={{ minHeight: '46px', background: '#ef4444' }}><X size={16} />Reddet</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          MODAL: Ticket Chat
          ═══════════════════════════════════════════ */}
      {detailTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}>
          <div className="w-full max-w-lg animate-fade-in flex flex-col" style={{ background: 'rgba(5, 9, 20, 0.98)', border: '1px solid rgba(248,251,255,0.1)', borderRadius: '22px', padding: '24px', boxShadow: '0 24px 60px rgba(0,0,0,0.5)', maxHeight: '80vh' }}>
            <div className="flex items-center justify-between mb-4 shrink-0">
              <div><h3 className="text-lg font-bold text-white">{detailTicket.subject}</h3><div className="flex items-center gap-2 mt-1"><span className="text-xs" style={{ color: '#8fa5b8' }}>{detailTicket.userEmail}</span>{statusBadge(detailTicket.status)}</div></div>
              <div className="flex items-center gap-2">
                {detailTicket.status === 'open' && <button onClick={() => { resolveTicket.mutate({ ticketId: detailTicket.id }); }} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}><Check size={12} />Çözüldü</button>}
                {detailTicket.status !== 'closed' && <button onClick={() => { closeTicketAdmin.mutate({ ticketId: detailTicket.id }); }} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}><X size={12} />Kapat</button>}
                <button onClick={() => { if (confirm('Bu destek talebini kalici olarak silmek istiyor musunuz?')) deleteTicket.mutate({ ticketId: detailTicket.id }); }} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: 'rgba(120,50,50,0.3)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}><X size={12} />Sil</button>
                <button onClick={() => setDetailTicket(null)} className="btn-secondary" style={{ minHeight: '32px', width: '32px', padding: 0 }}><X size={14} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 mb-4" style={{ maxHeight: '400px' }}>
              {detailTicket.messages.map((msg: any, i: number) => (
                <div key={i} className={`flex ${msg.sender === 'admin' ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-[80%] rounded-2xl px-4 py-2.5" style={{ background: msg.sender === 'admin' ? 'linear-gradient(135deg, #FFD700, #FFA500)' : 'rgba(255,255,255,0.08)', color: msg.sender === 'admin' ? '#04070d' : '#c8d6e5', borderBottomRightRadius: msg.sender === 'admin' ? '4px' : '16px', borderBottomLeftRadius: msg.sender === 'user' ? '4px' : '16px' }}>
                    <p className="text-sm">{msg.text}</p><span className="text-[10px] opacity-60 block mt-1">{msg.time}</span>
                  </div>
                </div>
              ))}
            </div>
            {detailTicket.status !== 'closed' ? (
              <div className="flex gap-2 shrink-0"><input type="text" value={ticketReply} onChange={(e) => setTicketReply(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && adminReply.mutate({ ticketId: detailTicket.id, text: ticketReply })} placeholder="Yanit yazin..." className="glass-input flex-1" style={{ minHeight: '44px' }} autoFocus /><button onClick={() => adminReply.mutate({ ticketId: detailTicket.id, text: ticketReply })} className="btn-primary" style={{ width: '44px', minHeight: '44px', padding: 0 }}><Send size={16} /></button></div>
            ) : (<div className="text-center py-3 shrink-0"><Lock size={16} style={{ color: '#5a6a7a', margin: '0 auto' }} /><p className="text-xs mt-1" style={{ color: '#5a6a7a' }}>Bu ticket kapatılmıştır.</p></div>)}
          </div>
        </div>
      )}

      {/* Logout Dialog */}
      {showLogout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-sm animate-fade-in" style={{ background: 'rgba(5, 9, 20, 0.95)', border: '1px solid rgba(248,251,255,0.1)', borderRadius: '22px', padding: '24px', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
            <div className="text-center mb-5"><div className="mx-auto mb-3 grid place-items-center rounded-full" style={{ width: '56px', height: '56px', background: 'rgba(239,68,68,0.12)' }}><LogOut size={28} style={{ color: '#ef4444' }} /></div><h3 className="text-lg font-bold text-white mb-1">Çıkış Yap</h3><p className="text-sm" style={{ color: '#8fa5b8' }}>Admin panelinden cikmak istiyor musunuz?</p></div>
            <div className="flex gap-3"><button onClick={() => setShowLogout(false)} className="btn-secondary flex-1">Iptal</button><button onClick={handleLogout} className="flex-1 inline-flex items-center justify-center gap-2 font-extrabold text-sm rounded-xl text-white" style={{ minHeight: '46px', background: 'rgba(239,68,68,0.85)' }}><LogOut size={16} />Cikis</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
