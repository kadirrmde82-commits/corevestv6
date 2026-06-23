import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowDownLeft, ArrowUpRight, Users,
  Check, X, Wallet, Shield, LogOut,
  Send, MessageCircle, Lock, ChevronRight, Headphones,
  Search, Edit3, Gift, Eye, RefreshCw, Bell,
  TrendingUp, Plus, Pencil, Trash2, Bitcoin, Minus, FileText, Download, Activity
} from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import LanguageSelector from '../components/LanguageSelector';
import { trpc } from '@/providers/trpc';
import { VIP_TABLE } from '../store';
import { ANNOUNCEMENT_CONTENT_KEYS, DEFAULT_SITE_CONTENT, FAQ_CONTENT_KEYS } from '@contracts/site-content';

type AdminTab = 'members' | 'memberStatus' | 'memberData' | 'system' | 'deposits' | 'withdrawals' | 'tickets' | 'content' | 'marketPrices' | 'walletAddresses';

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
  const [manualDepositAmount, setManualDepositAmount] = useState('');
  const [manualDepositEmail, setManualDepositEmail] = useState('');

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
  const [contentForm, setContentForm] = useState<Record<string, string>>(DEFAULT_SITE_CONTENT);
  const [announcementImageUploading, setAnnouncementImageUploading] = useState(false);
  const [notificationForm, setNotificationForm] = useState({
    targetUserId: '',
    title: '',
    message: '',
    type: 'info' as 'info' | 'success' | 'warning',
  });

  // Data queries
  const utils = trpc.useUtils();
  const { data: stats } = trpc.adminMember.stats.useQuery(undefined, { refetchInterval: 10000 });
  const { data: memberReports = [] } = trpc.adminMember.exportData.useQuery(undefined, { refetchInterval: 10000 });
  const { data: systemOverview } = trpc.adminSystem.overview.useQuery(undefined, { refetchInterval: 10000 });
  const { data: withdrawalRisks = [] } = trpc.adminSystem.withdrawalRisks.useQuery(undefined, { refetchInterval: 10000 });
  const { data: loginEvents = [] } = trpc.adminSystem.loginEvents.useQuery(undefined, { refetchInterval: 10000 });
  const { data: adminLogs = [] } = trpc.adminSystem.logs.useQuery(undefined, { refetchInterval: 10000 });
  const { data: maintenance } = trpc.adminSystem.maintenance.useQuery(undefined, { refetchInterval: 10000 });
  const { data: analytics } = trpc.adminSystem.analytics.useQuery(undefined, { refetchInterval: 10000 });
  const { data: sentNotifications = [] } = trpc.adminSystem.userNotifications.useQuery(undefined, { refetchInterval: 10000 });
  const { data: memberPresence = [] } = trpc.presence.adminList.useQuery(undefined, { refetchInterval: 10000 });
  const { data: membersData } = trpc.adminMember.list.useQuery(
    { search: searchQuery || undefined, page: 1, limit: 50 },
    { refetchInterval: 10000 }
  );
  const { data: allDeposits = [], refetch: refetchDeposits, isFetching: depositsFetching } = trpc.deposit.listAll.useQuery(undefined, {
    refetchInterval: activeTab === 'deposits' ? 3000 : 10000,
    refetchOnWindowFocus: true,
  });
  const { data: allWithdrawals = [] } = trpc.withdrawal.listAll.useQuery(undefined, { refetchInterval: 10000 });
  const { data: allTickets = [] } = trpc.ticket.listAll.useQuery(undefined, { refetchInterval: 10000 });
  const { data: allMarketPrices = [] } = trpc.marketPrice.listAll.useQuery(undefined, { refetchInterval: 10000 });
  const { data: allWalletAddresses = [] } = trpc.walletAddress.listAll.useQuery(undefined, { refetchInterval: 10000 });
  const { data: adminSiteContent } = trpc.siteContent.adminList.useQuery(undefined, { refetchInterval: 10000 });

  useEffect(() => {
    if (adminSiteContent) setContentForm(adminSiteContent);
  }, [adminSiteContent]);

  // Wheel spins adjustment state
  const [adjustSpinsValue, setAdjustSpinsValue] = useState('');
  const { data: memberDetail } = trpc.adminMember.detail.useQuery(
    { userId: selectedMemberId! },
    { enabled: selectedMemberId !== null }
  );

  // Mutations
  const updateBalance = trpc.adminMember.updateBalance.useMutation({ onSuccess: () => { utils.adminMember.list.invalidate(); utils.adminMember.detail.invalidate(); setEditBalanceOpen(false); } });
  const updateInvestment = trpc.adminMember.updateInvestment.useMutation({ onSuccess: () => { utils.adminMember.list.invalidate(); utils.adminMember.detail.invalidate(); } });
  const addMemberDeposit = trpc.adminMember.addDeposit.useMutation({ onSuccess: () => { utils.adminMember.list.invalidate(); utils.adminMember.detail.invalidate(); utils.deposit.listAll.invalidate(); setManualDepositAmount(''); setManualDepositEmail(''); } });
  const deleteMemberDeposit = trpc.adminMember.deleteDeposit.useMutation({ onSuccess: () => { utils.adminMember.list.invalidate(); utils.adminMember.detail.invalidate(); utils.deposit.listAll.invalidate(); } });
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
  const updateSiteContent = trpc.siteContent.updateMany.useMutation({ onSuccess: () => { utils.siteContent.adminList.invalidate(); utils.siteContent.public.invalidate(); } });
  const setMaintenance = trpc.adminSystem.setMaintenance.useMutation({ onSuccess: () => { utils.adminSystem.maintenance.invalidate(); utils.adminSystem.publicMaintenance.invalidate(); utils.adminSystem.logs.invalidate(); } });
  const clearLoginEvents = trpc.adminSystem.clearLoginEvents.useMutation({ onSuccess: () => { utils.adminSystem.loginEvents.invalidate(); utils.adminSystem.logs.invalidate(); } });
  const sendUserNotification = trpc.adminSystem.sendNotification.useMutation({
    onSuccess: (result) => {
      utils.adminSystem.userNotifications.invalidate();
      utils.notification.list.invalidate();
      setNotificationForm({ targetUserId: '', title: '', message: '', type: 'info' });
      alert(`${result.count} kullanıcıya bildirim gönderildi.`);
    },
  });
  const backupQuery = trpc.adminSystem.backup.useQuery(undefined, { enabled: false });

  // Detail modals
  const [detailDeposit, setDetailDeposit] = useState<typeof allDeposits[0] | null>(null);
  const [detailWithdraw, setDetailWithdraw] = useState<typeof allWithdrawals[0] | null>(null);
  const [detailTicket, setDetailTicket] = useState<typeof allTickets[0] | null>(null);
  const [ticketReply, setTicketReply] = useState('');

  const setContentValue = (key: string, value: string) => {
    setContentForm((current) => ({ ...current, [key]: value }));
  };

  const handleAnnouncementImageUpload = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Lütfen JPG, PNG veya WEBP formatında bir görsel seçin.');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      alert('Görsel en fazla 4MB olabilir. Lütfen daha küçük bir görsel seçin.');
      return;
    }

    try {
      setAnnouncementImageUploading(true);
      const formData = new FormData();
      formData.append('image', file);
      const response = await fetch('/api/admin/announcement-image', {
        method: 'POST',
        headers: {
          'x-local-auth-token': localStorage.getItem('corevest_token') || '',
        },
        body: formData,
      });
      const responseText = await response.text();
      let result: { error?: string; imageUrl?: string } = {};
      try {
        result = responseText ? JSON.parse(responseText) : {};
      } catch {
        result = { error: responseText || 'Görsel yüklenemedi' };
      }
      if (!response.ok) throw new Error(result?.error || 'Görsel yüklenemedi');
      if (!result.imageUrl) throw new Error('Görsel adresi alınamadı');
      setContentValue(ANNOUNCEMENT_CONTENT_KEYS.imageUrl, result.imageUrl);
      await utils.siteContent.adminList.invalidate();
      await utils.siteContent.public.invalidate();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Görsel yüklenemedi');
    } finally {
      setAnnouncementImageUploading(false);
    }
  };

  const saveSiteContent = () => {
    const valuesWithoutImage = { ...contentForm };
    delete valuesWithoutImage[ANNOUNCEMENT_CONTENT_KEYS.imageUrl];
    updateSiteContent.mutate({ values: valuesWithoutImage });
  };

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

  const reportColumns = [
    { key: 'publicId', label: 'Üye ID' },
    { key: 'email', label: 'E-posta' },
    { key: 'name', label: 'İsim' },
    { key: 'role', label: 'Rol' },
    { key: 'vipLevel', label: 'VIP' },
    { key: 'balance', label: 'Bakiye' },
    { key: 'investment', label: 'Yatırım' },
    { key: 'totalEarned', label: 'Toplam Kazanç' },
    { key: 'totalClicks', label: 'Toplam Tıklama' },
    { key: 'consecutiveClicks', label: 'Ardışık Tıklama' },
    { key: 'referralCode', label: 'Referans Kodu' },
    { key: 'referredBy', label: 'Davet Eden Kod' },
    { key: 'referralTier1', label: 'Ref T1' },
    { key: 'referralTier2', label: 'Ref T2' },
    { key: 'referralTier3', label: 'Ref T3' },
    { key: 'referralEarningsTotal', label: 'Referans Kazancı' },
    { key: 'approvedDepositTotal', label: 'Onaylı Yatırım' },
    { key: 'pendingDepositCount', label: 'Bekleyen Yatırım' },
    { key: 'approvedWithdrawalTotal', label: 'Onaylı Çekim' },
    { key: 'pendingWithdrawalCount', label: 'Bekleyen Çekim' },
    { key: 'monthlyWithdrawalCount', label: 'Aylık Çekim Sayısı' },
    { key: 'joinDate', label: 'Üyelik Tarihi' },
    { key: 'lastClickAt', label: 'Son Tıklama' },
    { key: 'lastWithdrawalAt', label: 'Son Çekim' },
    { key: 'lastSignInAt', label: 'Son Giriş' },
  ];

  const formatReportValue = (value: unknown, key: string) => {
    if (value === null || value === undefined || value === '') return '-';
    if (['balance', 'investment', 'totalEarned', 'referralEarningsTotal', 'approvedDepositTotal', 'approvedWithdrawalTotal'].includes(key)) {
      return `$${Number(value).toFixed(2)}`;
    }
    if (['joinDate', 'lastClickAt', 'lastWithdrawalAt', 'lastSignInAt'].includes(key)) {
      const date = new Date(String(value));
      return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('tr-TR');
    }
    if (key === 'vipLevel') return `VIP ${value}`;
    return String(value);
  };

  const escapeHtml = (value: string) => value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

  const buildReportTableHtml = () => {
    const header = reportColumns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('');
    const rows = memberReports.map((member: any) => (
      `<tr>${reportColumns.map((column) => `<td>${escapeHtml(formatReportValue(member[column.key], column.key))}</td>`).join('')}</tr>`
    )).join('');
    return `<table><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table>`;
  };

  const downloadBlob = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportMembersExcel = () => {
    const html = `<!doctype html><html><head><meta charset="UTF-8" /></head><body>${buildReportTableHtml()}</body></html>`;
    downloadBlob(html, `corevest-uye-datalari-${new Date().toISOString().slice(0, 10)}.xls`, 'application/vnd.ms-excel;charset=utf-8');
  };

  const exportMembersPdf = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('PDF penceresi açılamadı. Tarayıcı popup iznini kontrol edin.');
      return;
    }
    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>Corevest Üye Dataları</title>
          <style>
            body { font-family: Arial, sans-serif; color: #111827; padding: 24px; }
            h1 { margin: 0 0 6px; font-size: 22px; }
            p { margin: 0 0 18px; color: #4b5563; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; }
            th, td { border: 1px solid #d1d5db; padding: 6px; text-align: left; white-space: nowrap; }
            th { background: #f3f4f6; font-weight: 700; }
            @media print { body { padding: 10px; } table { font-size: 8px; } }
          </style>
        </head>
        <body>
          <h1>Corevest Üye Dataları</h1>
          <p>Oluşturma tarihi: ${new Date().toLocaleString('tr-TR')} · Toplam üye: ${memberReports.length}</p>
          ${buildReportTableHtml()}
          <script>window.onload = () => { window.print(); };</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const downloadFullBackup = async () => {
    const result = await backupQuery.refetch();
    if (!result.data) {
      alert('Yedek alınamadı.');
      return;
    }
    downloadBlob(
      JSON.stringify(result.data, null, 2),
      `corevest-tam-yedek-${new Date().toISOString().slice(0, 10)}.json`,
      'application/json;charset=utf-8'
    );
  };

  const sendNotification = () => {
    if (!notificationForm.title.trim() || !notificationForm.message.trim()) {
      alert('Bildirim başlığı ve mesajı zorunlu.');
      return;
    }
    sendUserNotification.mutate({
      title: notificationForm.title.trim(),
      message: notificationForm.message.trim(),
      type: notificationForm.type,
      targetUserId: notificationForm.targetUserId.trim() ? Number(notificationForm.targetUserId) : undefined,
    });
  };

  const chartColors = ['#FFD700', '#35d7ff', '#10b981', '#a78bfa', '#f97316', '#ef4444', '#8fa5b8'];

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
            { key: 'memberStatus' as AdminTab, label: 'Üyelerin Durumu', icon: Activity },
            { key: 'memberData' as AdminTab, label: 'Üye Dataları', icon: FileText },
            { key: 'system' as AdminTab, label: 'Güvenlik & Sistem', icon: Shield },
            { key: 'deposits' as AdminTab, label: 'Yatırım Talepleri', icon: ArrowDownLeft },
            { key: 'withdrawals' as AdminTab, label: 'Çekim Talepleri', icon: ArrowUpRight },
            { key: 'tickets' as AdminTab, label: 'Destek Ticketları', icon: Headphones },
            { key: 'content' as AdminTab, label: 'İçerik Yönetimi', icon: FileText },
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
                      {['ID', 'E-posta', 'İsim', 'Bakiye', 'Yatırım', 'VIP', 'Tıklama', 'Referans', ''].map((h) => (
                        <th key={h} className="px-4 py-3 text-[10px] font-bold uppercase" style={{ color: '#8fa5b8' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(membersData?.members ?? []).map((m) => (
                      <tr key={m.id} className="transition-all hover:bg-white/5" style={{ borderBottom: '1px solid rgba(248,251,255,0.04)' }}>
                        <td className="px-4 py-3 text-xs text-white font-mono">{m.publicId ?? m.id}</td>
                        <td className="px-4 py-3 text-xs text-white">{m.email}</td>
                        <td className="px-4 py-3 text-xs">
                          <button onClick={() => setSelectedMemberId(m.id)} className="font-bold hover:underline" style={{ color: '#8fa5b8' }}>
                            {m.name || '-'}
                          </button>
                        </td>
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
        {activeTab === 'memberStatus' && (
          <div className="grid gap-3">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Online Üye', value: memberPresence.filter((member: any) => member.online).length, color: '#10b981' },
                { label: 'Toplam Üye', value: memberPresence.length, color: '#FFD700' },
                { label: 'Son 2 dk Aktif', value: memberPresence.filter((member: any) => member.secondsAgo !== null && member.secondsAgo <= 120).length, color: '#35d7ff' },
                { label: 'Offline', value: memberPresence.filter((member: any) => !member.online).length, color: '#8fa5b8' },
              ].map((item) => (
                <div key={item.label} className="glass-card">
                  <span className="text-xs font-medium" style={{ color: '#8fa5b8' }}>{item.label}</span>
                  <strong className="block text-2xl mt-1" style={{ color: item.color }}>{item.value}</strong>
                </div>
              ))}
            </div>

            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(248,251,255,0.08)' }}>
                <div>
                  <h2 className="text-lg font-bold text-white">Üyelerin Durumu</h2>
                  <p className="text-xs mt-1" style={{ color: '#8fa5b8' }}>Site açık olan üyeler yeşil Online olarak görünür. Yaklaşık 2 dakika içinde sinyal gelmezse Offline olur.</p>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold" style={{ color: '#10b981' }}>
                  <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: '#10b981' }} />
                  Canlı Takip
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(248,251,255,0.08)' }}>
                      {['Durum', 'ID', 'Üye', 'E-posta', 'Son Görülme', 'Sayfa', 'IP / Cihaz'].map((h) => (
                        <th key={h} className="px-4 py-3 text-[10px] font-bold uppercase" style={{ color: '#8fa5b8' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {memberPresence.map((member: any) => (
                      <tr key={member.userId} className="transition-all hover:bg-white/5" style={{ borderBottom: '1px solid rgba(248,251,255,0.04)' }}>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-2 text-[10px] font-extrabold px-2 py-1 rounded-full" style={{ background: member.online ? 'rgba(16,185,129,0.12)' : 'rgba(90,106,122,0.15)', color: member.online ? '#10b981' : '#8fa5b8' }}>
                            <span className="w-2 h-2 rounded-full" style={{ background: member.online ? '#10b981' : '#5a6a7a', boxShadow: member.online ? '0 0 10px rgba(16,185,129,0.8)' : 'none' }} />
                            {member.online ? 'Online' : 'Offline'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-white font-mono">{member.publicId ?? member.userId}</td>
                        <td className="px-4 py-3 text-xs text-white">{member.name || '-'}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: '#8fa5b8' }}>{member.email || '-'}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: '#c8d6e5' }}>
                          {member.lastSeenAt ? new Date(member.lastSeenAt).toLocaleString('tr-TR') : '-'}
                          {member.secondsAgo !== null && <span className="block text-[10px]" style={{ color: '#5a6a7a' }}>{member.secondsAgo < 60 ? `${member.secondsAgo} sn önce` : `${Math.floor(member.secondsAgo / 60)} dk önce`}</span>}
                        </td>
                        <td className="px-4 py-3 text-xs font-mono" style={{ color: '#8fa5b8' }}>{member.path || '-'}</td>
                        <td className="px-4 py-3 text-xs max-w-[260px]">
                          <span className="block text-white font-mono">{member.ipAddress || '-'}</span>
                          <span className="block truncate" style={{ color: '#5a6a7a' }}>{member.userAgent || '-'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {memberPresence.length === 0 && <p className="text-sm text-center py-8" style={{ color: '#5a6a7a' }}>Üye durumu bulunamadı.</p>}
            </div>
          </div>
        )}

        {activeTab === 'system' && (
          <div className="grid gap-3">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {(systemOverview?.notifications ?? []).map((item: any) => (
                <div key={item.type} className="glass-card">
                  <span className="text-xs font-medium" style={{ color: '#8fa5b8' }}>{item.title}</span>
                  <strong className="block text-2xl mt-1" style={{ color: item.count > 0 ? '#FFD700' : '#5a6a7a' }}>{item.count}</strong>
                </div>
              ))}
            </div>

            <div className="glass-card">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-white">Bakım Modu</h2>
                  <p className="text-sm mt-1" style={{ color: '#8fa5b8' }}>Açıldığında kullanıcılar bakım ekranı görür, admin panel çalışmaya devam eder.</p>
                </div>
                <button
                  onClick={() => setMaintenance.mutate({ enabled: !(maintenance?.enabled ?? false) })}
                  className={maintenance?.enabled ? 'btn-primary' : 'btn-secondary'}
                  style={{ minHeight: '42px' }}
                >
                  {maintenance?.enabled ? 'Bakımı Kapat' : 'Bakımı Aç'}
                </button>
              </div>
            </div>

            <div className="glass-card">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-white">Tam Sistem Yedeği</h2>
                  <p className="text-sm mt-1" style={{ color: '#8fa5b8' }}>Üyeler, yatırımlar, çekimler, referanslar, ticketlar ve bonus kayıtlarını JSON olarak indirir.</p>
                </div>
                <button onClick={downloadFullBackup} className="btn-primary" style={{ minHeight: '42px' }}>
                  <Download size={15} /> Tam Yedek İndir
                </button>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-3">
              <div className="glass-card">
                <h2 className="text-lg font-bold text-white mb-1">Gelir / Çekim Grafiği</h2>
                <p className="text-xs mb-3" style={{ color: '#8fa5b8' }}>Son 7 gün onaylı yatırım ve çekim hareketleri.</p>
                <div style={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analytics?.daily ?? []}>
                      <defs>
                        <linearGradient id="depositGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.5} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="withdrawGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#FFD700" stopOpacity={0.5} />
                          <stop offset="95%" stopColor="#FFD700" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(248,251,255,0.08)" vertical={false} />
                      <XAxis dataKey="label" stroke="#8fa5b8" fontSize={11} />
                      <YAxis stroke="#8fa5b8" fontSize={11} />
                      <Tooltip contentStyle={{ background: '#08111f', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, color: '#fff' }} />
                      <Area type="monotone" dataKey="deposits" name="Yatırım" stroke="#10b981" fill="url(#depositGradient)" strokeWidth={2} />
                      <Area type="monotone" dataKey="withdrawals" name="Çekim" stroke="#FFD700" fill="url(#withdrawGradient)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="glass-card">
                <h2 className="text-lg font-bold text-white mb-1">VIP Dağılımı</h2>
                <p className="text-xs mb-3" style={{ color: '#8fa5b8' }}>Üyelerin VIP seviyelerine göre dağılımı.</p>
                <div style={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={analytics?.vipDistribution ?? []} dataKey="count" nameKey="level" innerRadius={55} outerRadius={90} paddingAngle={3}>
                        {(analytics?.vipDistribution ?? []).map((entry: any, index: number) => (
                          <Cell key={entry.level} fill={chartColors[index % chartColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: '#08111f', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, color: '#fff' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-3">
              <div className="glass-card">
                <h2 className="text-lg font-bold text-white mb-1">Yeni Üye Grafiği</h2>
                <p className="text-xs mb-3" style={{ color: '#8fa5b8' }}>Son 7 gün kayıt olan kullanıcı sayısı.</p>
                <div style={{ height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics?.daily ?? []}>
                      <CartesianGrid stroke="rgba(248,251,255,0.08)" vertical={false} />
                      <XAxis dataKey="label" stroke="#8fa5b8" fontSize={11} />
                      <YAxis stroke="#8fa5b8" fontSize={11} />
                      <Tooltip contentStyle={{ background: '#08111f', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, color: '#fff' }} />
                      <Bar dataKey="users" name="Yeni Üye" fill="#35d7ff" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="glass-card">
                <h2 className="text-lg font-bold text-white mb-3">Rapor Özeti</h2>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Toplam Bakiye', value: `$${Math.round(analytics?.totals.totalBalance ?? 0).toLocaleString()}` },
                    { label: 'Onaylı Yatırım', value: `$${Math.round(analytics?.totals.approvedDeposits ?? 0).toLocaleString()}` },
                    { label: 'Onaylı Çekim', value: `$${Math.round(analytics?.totals.approvedWithdrawals ?? 0).toLocaleString()}` },
                    { label: 'Referans Kaydı', value: analytics?.totals.referrals ?? 0 },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(248,251,255,0.06)' }}>
                      <span className="text-xs" style={{ color: '#8fa5b8' }}>{item.label}</span>
                      <strong className="block text-lg text-white mt-1">{item.value}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="glass-card">
              <div className="flex items-center gap-2 mb-3">
                <Bell size={18} style={{ color: '#FFD700' }} />
                <h2 className="text-lg font-bold text-white">Kullanıcı Bildirim Sistemi</h2>
              </div>
              <div className="grid lg:grid-cols-[1fr_1fr] gap-3">
                <div className="grid gap-2">
                  <input
                    value={notificationForm.targetUserId}
                    onChange={(e) => setNotificationForm((current) => ({ ...current, targetUserId: e.target.value }))}
                    placeholder="Üye ID boş kalırsa herkese gider"
                    className="glass-input"
                  />
                  <select
                    value={notificationForm.type}
                    onChange={(e) => setNotificationForm((current) => ({ ...current, type: e.target.value as 'info' | 'success' | 'warning' }))}
                    className="glass-input"
                  >
                    <option value="info">Bilgi</option>
                    <option value="success">Başarılı / Güzel Haber</option>
                    <option value="warning">Uyarı</option>
                  </select>
                  <input
                    value={notificationForm.title}
                    onChange={(e) => setNotificationForm((current) => ({ ...current, title: e.target.value }))}
                    placeholder="Bildirim başlığı"
                    className="glass-input"
                  />
                  <textarea
                    value={notificationForm.message}
                    onChange={(e) => setNotificationForm((current) => ({ ...current, message: e.target.value }))}
                    placeholder="Kullanıcıya gidecek mesaj"
                    className="glass-input"
                    rows={4}
                  />
                  <button onClick={sendNotification} className="btn-primary" disabled={sendUserNotification.isPending}>
                    <Send size={15} /> Bildirim Gönder
                  </button>
                </div>
                <div className="grid gap-2 max-h-[300px] overflow-y-auto pr-1">
                  {sentNotifications.slice(0, 12).map((item: any) => (
                    <div key={item.id} className="rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(248,251,255,0.06)' }}>
                      <span className="text-sm font-bold text-white">{item.title}</span>
                      <p className="text-xs mt-1" style={{ color: '#8fa5b8' }}>{item.email || `Üye #${item.userId}`} · {item.readAt ? 'Okundu' : 'Okunmadı'}</p>
                      <p className="text-[10px] mt-1 line-clamp-2" style={{ color: '#5a6a7a' }}>{item.message}</p>
                    </div>
                  ))}
                  {sentNotifications.length === 0 && <p className="text-sm text-center py-8" style={{ color: '#5a6a7a' }}>Henüz bildirim gönderilmedi.</p>}
                </div>
              </div>
            </div>

            <div className="glass-card">
              <h2 className="text-lg font-bold text-white mb-3">Çekim Güvenlik Kontrolü</h2>
              <div className="grid gap-2">
                {withdrawalRisks.slice(0, 20).map((risk: any) => (
                  <div key={risk.id} className="rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(248,251,255,0.06)' }}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <span className="text-sm font-bold text-white">Çekim #{risk.id} · Üye #{risk.userId}</span>
                        <p className="text-xs mt-1" style={{ color: '#8fa5b8' }}>${Number(risk.amount).toFixed(2)} · {risk.wallet}</p>
                      </div>
                      <span className="text-[10px] font-extrabold px-2 py-1 rounded-full" style={{ background: risk.riskScore > 0 ? 'rgba(239,68,68,0.14)' : 'rgba(16,185,129,0.12)', color: risk.riskScore > 0 ? '#ef4444' : '#10b981' }}>
                        {risk.riskScore > 0 ? `${risk.riskScore} risk` : 'Temiz'}
                      </span>
                    </div>
                    {risk.labels.length > 0 && <p className="text-xs mt-2" style={{ color: '#FFD700' }}>{risk.labels.join(' · ')}</p>}
                  </div>
                ))}
                {withdrawalRisks.length === 0 && <p className="text-sm text-center py-6" style={{ color: '#5a6a7a' }}>Çekim kaydı yok.</p>}
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-3">
              <div className="glass-card">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h2 className="text-lg font-bold text-white">IP / Cihaz Takibi</h2>
                  <button
                    onClick={() => {
                      if (window.confirm('Tüm IP / cihaz giriş logları silinsin mi?')) {
                        clearLoginEvents.mutate();
                      }
                    }}
                    className="btn-secondary"
                    style={{ minHeight: '34px', padding: '0 12px', color: '#ef4444', borderColor: 'rgba(239,68,68,0.22)' }}
                    disabled={clearLoginEvents.isPending || loginEvents.length === 0}
                  >
                    <Trash2 size={14} /> Logları Sil
                  </button>
                </div>
                <div className="grid gap-2 max-h-[420px] overflow-y-auto pr-1">
                  {loginEvents.map((event: any) => (
                    <div key={event.id} className="rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(248,251,255,0.06)' }}>
                      <span className="text-sm font-bold text-white">{event.email || `Üye #${event.userId}`}</span>
                      <p className="text-xs mt-1" style={{ color: '#8fa5b8' }}>{event.ipAddress || '-'} · {event.createdAt ? new Date(event.createdAt).toLocaleString('tr-TR') : ''}</p>
                      <p className="text-[10px] mt-1" style={{ color: '#8fa5b8' }}>{[event.country, event.city].filter(Boolean).join(' / ') || 'Konum bilinmiyor'}</p>
                      <p className="text-[10px] mt-1 truncate" style={{ color: '#5a6a7a' }}>{event.userAgent || '-'}</p>
                    </div>
                  ))}
                  {loginEvents.length === 0 && <p className="text-sm text-center py-6" style={{ color: '#5a6a7a' }}>IP / cihaz logu yok.</p>}
                </div>
              </div>

              <div className="glass-card">
                <h2 className="text-lg font-bold text-white mb-3">Admin İşlem Logları</h2>
                <div className="grid gap-2 max-h-[420px] overflow-y-auto pr-1">
                  {adminLogs.map((log: any) => (
                    <div key={log.id} className="rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(248,251,255,0.06)' }}>
                      <span className="text-sm font-bold text-white">{log.action}</span>
                      <p className="text-xs mt-1" style={{ color: '#8fa5b8' }}>{log.adminEmail || `Admin #${log.adminUserId}`} · {log.targetType || '-'} #{log.targetId || '-'}</p>
                      <p className="text-[10px] mt-1" style={{ color: '#5a6a7a' }}>{log.ipAddress || '-'} · {log.createdAt ? new Date(log.createdAt).toLocaleString('tr-TR') : ''}</p>
                    </div>
                  ))}
                  {adminLogs.length === 0 && <p className="text-sm text-center py-6" style={{ color: '#5a6a7a' }}>Henüz admin işlem logu yok.</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'memberData' && (
          <div className="grid gap-3">
            <div className="glass-card">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-white">Tüm Üye Dataları</h2>
                  <p className="text-sm mt-1" style={{ color: '#8fa5b8' }}>
                    Tüm üyelerin bakiye, yatırım, VIP, tıklama, referans, yatırım ve çekim özetlerini buradan görebilir ve indirebilirsiniz.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button onClick={exportMembersExcel} className="btn-primary" style={{ minHeight: '40px' }} disabled={memberReports.length === 0}>
                    <Download size={15} /> Excel İndir
                  </button>
                  <button onClick={exportMembersPdf} className="btn-secondary" style={{ minHeight: '40px' }} disabled={memberReports.length === 0}>
                    <FileText size={15} /> PDF Aç / İndir
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Rapor Üye Sayısı', value: memberReports.length.toLocaleString(), color: '#FFD700' },
                { label: 'Toplam Bakiye', value: `$${memberReports.reduce((sum: number, member: any) => sum + Number(member.balance || 0), 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`, color: '#10b981' },
                { label: 'Toplam Yatırım', value: `$${memberReports.reduce((sum: number, member: any) => sum + Number(member.investment || 0), 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`, color: '#35d7ff' },
                { label: 'Toplam Referans Kazancı', value: `$${memberReports.reduce((sum: number, member: any) => sum + Number(member.referralEarningsTotal || 0), 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`, color: '#a78bfa' },
              ].map((item) => (
                <div key={item.label} className="glass-card">
                  <span className="text-xs font-medium" style={{ color: '#8fa5b8' }}>{item.label}</span>
                  <strong className="block text-lg mt-1" style={{ color: item.color }}>{item.value}</strong>
                </div>
              ))}
            </div>

            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(248,251,255,0.08)' }}>
                      {reportColumns.map((column) => (
                        <th key={column.key} className="px-4 py-3 text-[10px] font-bold uppercase whitespace-nowrap" style={{ color: '#8fa5b8' }}>
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {memberReports.map((member: any) => (
                      <tr key={member.id} className="transition-all hover:bg-white/5" style={{ borderBottom: '1px solid rgba(248,251,255,0.04)' }}>
                        {reportColumns.map((column) => (
                          <td key={column.key} className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: column.key === 'balance' || column.key === 'investment' ? '#FFD700' : '#c8d6e5' }}>
                            {formatReportValue(member[column.key], column.key)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {memberReports.length === 0 && <p className="text-sm text-center py-8" style={{ color: '#5a6a7a' }}>Üye datası bulunamadı.</p>}
            </div>
          </div>
        )}

        {activeTab === 'deposits' && (
          <div className="grid gap-2">
            <div className="glass-card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white">Yatırım Talepleri</h2>
                <p className="text-xs mt-1" style={{ color: '#8fa5b8' }}>Bu sayfa açıkken talepler otomatik olarak birkaç saniyede bir yenilenir.</p>
              </div>
              <button onClick={() => refetchDeposits()} className="btn-secondary" style={{ minHeight: '38px' }}>
                <RefreshCw size={14} className={depositsFetching ? 'animate-spin' : ''} /> Yenile
              </button>
            </div>
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
                    <span className="text-xs font-mono" style={{ color: '#8fa5b8' }}>#{d.userPublicId ?? d.userId}</span>
                    <span className="text-xs" style={{ color: '#5a6a7a' }}>|</span>
                    <span className="text-xs" style={{ color: '#8fa5b8' }}>{d.email && d.email.trim() ? d.email : (d.userEmail || '-')}</span>
                  </div>
                </div>
                <span className="text-xs shrink-0 text-right" style={{ color: '#5a6a7a' }}>
                  {d.createdAt ? new Date(d.createdAt).toLocaleString('tr-TR') : ''}
                </span>
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

        {/* ─── CONTENT TAB ─── */}
        {activeTab === 'content' && (
          <div className="grid gap-4">
            <div className="glass-card">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-bold text-white">SSS İçerikleri</h2>
                  <p className="text-xs" style={{ color: '#8fa5b8' }}>Kullanıcıların SSS sayfasında gördüğü 3 ana bölümü buradan düzenleyebilirsiniz.</p>
                </div>
                <button onClick={saveSiteContent} className="btn-primary" style={{ minHeight: '40px', minWidth: '110px' }} disabled={updateSiteContent.isPending}>
                  {updateSiteContent.isPending ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>

              <div className="grid gap-4">
                {[
                  { title: 'Nasıl Yatırım Yapılır?', q: FAQ_CONTENT_KEYS.investmentQuestion, a: FAQ_CONTENT_KEYS.investmentAnswer },
                  { title: 'Nasıl Çekim Yapılır?', q: FAQ_CONTENT_KEYS.withdrawalQuestion, a: FAQ_CONTENT_KEYS.withdrawalAnswer },
                  { title: 'Referans Kodu Nasıl İşler?', q: FAQ_CONTENT_KEYS.referralQuestion, a: FAQ_CONTENT_KEYS.referralAnswer },
                ].map((item) => (
                  <div key={item.q} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(248,251,255,0.06)' }}>
                    <h3 className="text-sm font-bold text-white mb-3">{item.title}</h3>
                    <label className="label-text block mb-1">Soru Başlığı</label>
                    <input
                      type="text"
                      value={contentForm[item.q] ?? ''}
                      onChange={(e) => setContentValue(item.q, e.target.value)}
                      className="glass-input mb-3"
                      style={{ minHeight: '42px' }}
                    />
                    <label className="label-text block mb-1">Cevap Metni</label>
                    <textarea
                      value={contentForm[item.a] ?? ''}
                      onChange={(e) => setContentValue(item.a, e.target.value)}
                      className="glass-input"
                      rows={5}
                      style={{ resize: 'vertical' }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-bold text-white">Ana Sayfa Duyuru Popup</h2>
                  <p className="text-xs" style={{ color: '#8fa5b8' }}>Ana sayfadaki açılır duyurunun yazılarını buradan anlık güncelleyebilirsiniz.</p>
                </div>
                <button onClick={saveSiteContent} className="btn-primary" style={{ minHeight: '40px', minWidth: '110px' }} disabled={updateSiteContent.isPending}>
                  {updateSiteContent.isPending ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="label-text block mb-1">Duyuru Aktif mi? (true / false)</label>
                  <input
                    type="text"
                    value={contentForm[ANNOUNCEMENT_CONTENT_KEYS.enabled] ?? 'true'}
                    onChange={(e) => setContentValue(ANNOUNCEMENT_CONTENT_KEYS.enabled, e.target.value.trim().toLowerCase())}
                    className="glass-input"
                    style={{ minHeight: '42px' }}
                  />
                </div>
                <div>
                  <label className="label-text block mb-1">Gösterim Kodu</label>
                  <input
                    type="text"
                    value={contentForm[ANNOUNCEMENT_CONTENT_KEYS.version] ?? 'v1'}
                    onChange={(e) => setContentValue(ANNOUNCEMENT_CONTENT_KEYS.version, e.target.value.trim() || 'v1')}
                    className="glass-input"
                    placeholder="Örn: kampanya-1"
                    style={{ minHeight: '42px' }}
                  />
                  <p className="text-[10px] mt-1" style={{ color: '#5a6a7a' }}>Bu kod değişirse popup kullanıcılara tekrar 1 kez gösterilir.</p>
                </div>
                <div>
                  <label className="label-text block mb-1">Buton Yazısı</label>
                  <input
                    type="text"
                    value={contentForm[ANNOUNCEMENT_CONTENT_KEYS.button] ?? ''}
                    onChange={(e) => setContentValue(ANNOUNCEMENT_CONTENT_KEYS.button, e.target.value)}
                    className="glass-input"
                    style={{ minHeight: '42px' }}
                  />
                </div>
              </div>

              <div className="grid gap-3 mt-3">
                <div>
                  <label className="label-text block mb-1">Popup Görseli Yükle</label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={(e) => handleAnnouncementImageUpload(e.target.files?.[0])}
                    className="glass-input"
                    style={{ minHeight: '42px', paddingTop: '9px' }}
                  />
                  <p className="text-[10px] mt-1" style={{ color: '#5a6a7a' }}>Kare görsel önerilir: 500x500 veya 1000x1000. Maksimum 4MB.</p>
                  {announcementImageUploading && <p className="text-[10px] mt-1" style={{ color: '#FFD700' }}>Görsel yükleniyor...</p>}
                  {contentForm[ANNOUNCEMENT_CONTENT_KEYS.imageUrl] && (
                    <div className="mt-3 overflow-hidden rounded-xl" style={{ width: '160px', aspectRatio: '1 / 1', border: '1px solid rgba(255,215,0,0.18)', background: 'rgba(255,255,255,0.04)' }}>
                      <img src={contentForm[ANNOUNCEMENT_CONTENT_KEYS.imageUrl]} alt="Popup önizleme" className="w-full h-full object-cover" />
                    </div>
                  )}
                  {contentForm[ANNOUNCEMENT_CONTENT_KEYS.imageUrl] && (
                    <button
                      onClick={() => setContentValue(ANNOUNCEMENT_CONTENT_KEYS.imageUrl, '')}
                      className="btn-secondary mt-2"
                      style={{ minHeight: '34px', fontSize: '12px' }}
                    >
                      Görseli Kaldır
                    </button>
                  )}
                </div>
                <div>
                  <label className="label-text block mb-1">Başlık</label>
                  <input
                    type="text"
                    value={contentForm[ANNOUNCEMENT_CONTENT_KEYS.title] ?? ''}
                    onChange={(e) => setContentValue(ANNOUNCEMENT_CONTENT_KEYS.title, e.target.value)}
                    className="glass-input"
                    style={{ minHeight: '42px' }}
                  />
                </div>
                <div>
                  <label className="label-text block mb-1">Alt Başlık</label>
                  <input
                    type="text"
                    value={contentForm[ANNOUNCEMENT_CONTENT_KEYS.subtitle] ?? ''}
                    onChange={(e) => setContentValue(ANNOUNCEMENT_CONTENT_KEYS.subtitle, e.target.value)}
                    className="glass-input"
                    style={{ minHeight: '42px' }}
                  />
                </div>
                <div>
                  <label className="label-text block mb-1">Açıklama</label>
                  <textarea
                    value={contentForm[ANNOUNCEMENT_CONTENT_KEYS.body] ?? ''}
                    onChange={(e) => setContentValue(ANNOUNCEMENT_CONTENT_KEYS.body, e.target.value)}
                    className="glass-input"
                    rows={3}
                    style={{ resize: 'vertical' }}
                  />
                </div>
                <div>
                  <label className="label-text block mb-1">Kampanya Kuralları (her satır ayrı madde olur)</label>
                  <textarea
                    value={contentForm[ANNOUNCEMENT_CONTENT_KEYS.rules] ?? ''}
                    onChange={(e) => setContentValue(ANNOUNCEMENT_CONTENT_KEYS.rules, e.target.value)}
                    className="glass-input"
                    rows={4}
                    style={{ resize: 'vertical' }}
                  />
                </div>
                <div>
                  <label className="label-text block mb-1">Not Yazısı</label>
                  <input
                    type="text"
                    value={contentForm[ANNOUNCEMENT_CONTENT_KEYS.note] ?? ''}
                    onChange={(e) => setContentValue(ANNOUNCEMENT_CONTENT_KEYS.note, e.target.value)}
                    className="glass-input"
                    style={{ minHeight: '42px' }}
                  />
                </div>
                <div>
                  <label className="label-text block mb-1">Alt Yazı</label>
                  <input
                    type="text"
                    value={contentForm[ANNOUNCEMENT_CONTENT_KEYS.footer] ?? ''}
                    onChange={(e) => setContentValue(ANNOUNCEMENT_CONTENT_KEYS.footer, e.target.value)}
                    className="glass-input"
                    style={{ minHeight: '42px' }}
                  />
                </div>
              </div>

              {updateSiteContent.isSuccess && (
                <p className="text-xs font-bold mt-3" style={{ color: '#10b981' }}>İçerikler kaydedildi. Sayfayı yenileyince güncel hali görünür.</p>
              )}
            </div>
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
                  <Pencil size={16} style={{ color: '#FFD700' }} /> Düzenle
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
                            <button onClick={() => { setWalletEditId(w.id); setMarketForm({ symbol: w.key, name: w.label, basePrice: w.address, change: '', color: w.color }); setWalletEditOpen(true); }} className="grid place-items-center rounded-lg" style={{ width: '30px', height: '30px', color: '#FFD700', background: 'rgba(255,215,0,0.1)' }} title="Düzenle"><Pencil size={12} /></button>
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
                <input type="text" value={marketForm.name} onChange={(e) => setMarketForm(p => ({ ...p, name: e.target.value }))} placeholder="İsim (Bitcoin)" className="glass-input" style={{ minHeight: '38px', fontSize: '12px' }} />
                <input type="text" value={marketForm.basePrice} onChange={(e) => setMarketForm(p => ({ ...p, basePrice: e.target.value }))} placeholder="Fiyat" className="glass-input" style={{ minHeight: '38px', fontSize: '12px' }} />
                <input type="text" value={marketForm.change} onChange={(e) => setMarketForm(p => ({ ...p, change: e.target.value }))} placeholder="Değişim %" className="glass-input" style={{ minHeight: '38px', fontSize: '12px' }} />
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
                  <Pencil size={16} style={{ color: '#FFD700' }} /> Düzenle
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <input type="text" value={marketForm.symbol} onChange={(e) => setMarketForm(p => ({ ...p, symbol: e.target.value }))} placeholder="Sembol" className="glass-input" style={{ minHeight: '38px', fontSize: '12px' }} />
                  <input type="text" value={marketForm.name} onChange={(e) => setMarketForm(p => ({ ...p, name: e.target.value }))} placeholder="İsim" className="glass-input" style={{ minHeight: '38px', fontSize: '12px' }} />
                  <input type="text" value={marketForm.basePrice} onChange={(e) => setMarketForm(p => ({ ...p, basePrice: e.target.value }))} placeholder="Fiyat" className="glass-input" style={{ minHeight: '38px', fontSize: '12px' }} />
                  <input type="text" value={marketForm.change} onChange={(e) => setMarketForm(p => ({ ...p, change: e.target.value }))} placeholder="Değişim %" className="glass-input" style={{ minHeight: '38px', fontSize: '12px' }} />
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
                      {['Sembol', 'İsim', 'Fiyat', 'Değişim', 'Renk', 'Durum', ''].map((h) => (
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
                            <button onClick={() => { setMarketEditId(coin.id); setMarketForm({ symbol: coin.symbol, name: coin.name, basePrice: String(coin.basePrice), change: String(coin.change), color: coin.color }); setMarketEditOpen(true); }} className="grid place-items-center rounded-lg" style={{ width: '30px', height: '30px', color: '#FFD700', background: 'rgba(255,215,0,0.1)' }} title="Düzenle"><Pencil size={12} /></button>
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
                <span className="text-sm font-bold text-white">{memberDetail.publicId ?? memberDetail.id}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs" style={{ color: '#8fa5b8' }}>E-posta</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">{memberDetail.email}</span>
                  <button onClick={() => { setEditUserName(memberDetail.name || ''); setEditUserEmail(memberDetail.email || ''); setEditUserOpen(true); }} className="grid place-items-center rounded-lg" style={{ width: '26px', height: '26px', color: '#FFD700', background: 'rgba(255,215,0,0.1)' }} title="Düzenle"><Edit3 size={12} /></button>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs" style={{ color: '#8fa5b8' }}>İsim</span>
                <span className="text-sm font-bold text-white">{memberDetail.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs" style={{ color: '#8fa5b8' }}>Rol</span>
                <span className="text-[10px] font-extrabold px-2 py-1 rounded-full" style={{ background: memberDetail.role === 'admin' ? 'rgba(255,215,0,0.12)' : 'rgba(255,255,255,0.06)', color: memberDetail.role === 'admin' ? '#FFD700' : '#8fa5b8' }}>{memberDetail.role}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs" style={{ color: '#8fa5b8' }}>Şifre</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono" style={{ color: '#5a6a7a' }}>************ (hash)</span>
                  <button onClick={() => { setNewPassword(''); setResetPwOpen(true); }} className="grid place-items-center rounded-lg" style={{ width: '26px', height: '26px', color: '#FFD700', background: 'rgba(255,215,0,0.1)' }} title="Şifre Sıfırla"><Lock size={12} /></button>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs" style={{ color: '#8fa5b8' }}>Uyelik Tarihi</span>
                <span className="text-sm text-white">{memberDetail.createdAt ? new Date(memberDetail.createdAt).toLocaleDateString() : '-'}</span>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(248,251,255,0.06)' }}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold" style={{ color: '#8fa5b8' }}>Son IP / Konum</span>
                  <span className="text-[10px]" style={{ color: '#5a6a7a' }}>
                    {(memberDetail as any).latestLogin?.createdAt ? new Date((memberDetail as any).latestLogin.createdAt).toLocaleString('tr-TR') : 'Giriş kaydı yok'}
                  </span>
                </div>
                <div className="grid gap-1">
                  <div className="flex justify-between gap-3">
                    <span className="text-xs" style={{ color: '#8fa5b8' }}>IP Adresi</span>
                    <span className="text-xs font-mono text-white">{(memberDetail as any).latestLogin?.ipAddress || '-'}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-xs" style={{ color: '#8fa5b8' }}>Ülke / Şehir</span>
                    <span className="text-xs text-white">{[(memberDetail as any).latestLogin?.country, (memberDetail as any).latestLogin?.city].filter(Boolean).join(' / ') || '-'}</span>
                  </div>
                  <p className="text-[10px] truncate" style={{ color: '#5a6a7a' }}>{(memberDetail as any).latestLogin?.userAgent || 'Cihaz bilgisi yok'}</p>
                </div>
              </div>
            </div>

            {/* Edit User Info Form */}
            {editUserOpen && (
              <div className="mb-4 p-4 rounded-xl" style={{ background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.2)' }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-bold text-white">Kullanıcı Bilgilerini Düzenle</span>
                  <button onClick={() => setEditUserOpen(false)} className="btn-secondary" style={{ minHeight: '28px', width: '28px', padding: 0 }}><X size={12} /></button>
                </div>
                <div className="space-y-2 mb-3">
                  <div>
                    <label className="label-text block mb-1">İsim</label>
                    <input type="text" value={editUserName} onChange={(e) => setEditUserName(e.target.value)} placeholder="İsim girin" className="glass-input" style={{ minHeight: '40px' }} />
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
                <span className="text-sm font-bold text-white">Şifre Sıfırla</span>
                  <button onClick={() => setResetPwOpen(false)} className="btn-secondary" style={{ minHeight: '28px', width: '28px', padding: 0 }}><X size={12} /></button>
                </div>
                <p className="text-xs mb-2" style={{ color: '#8fa5b8' }}>
                  Üyenin mevcut şifresi hashlenmiş olarak saklanır. Asla görülemez. Yeni bir şifre atayabilirsiniz.
                </p>
                <div className="mb-2">
                  <label className="label-text block mb-1">Yeni Şifre</label>
                  <input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="En az 6 karakter" className="glass-input" style={{ minHeight: '40px' }} />
                </div>
                <button onClick={() => { if (!newPassword || newPassword.length < 6) return; resetPassword.mutate({ userId: selectedMemberId, newPassword }); }} className="btn-primary w-full" style={{ minHeight: '38px', fontSize: '12px', background: 'rgba(239,68,68,0.85)' }}>
                  Şifreyi Güncelle
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
                    <span className="text-xs" style={{ color: '#8fa5b8' }}>Yatırım</span>
                    <span className="text-sm font-bold text-white">${memberDetail.profile.investment.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs" style={{ color: '#8fa5b8' }}>VIP Seviye</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold" style={{ color: '#FFD700' }}>VIP {memberDetail.profile.vipLevel}</span>
                      <button onClick={() => { setEditVipValue(memberDetail.profile!.vipLevel); setEditVipOpen(true); }} className="grid place-items-center rounded-lg" style={{ width: '26px', height: '26px', color: '#FFD700', background: 'rgba(255,215,0,0.1)' }}><Edit3 size={12} /></button>
                    </div>
                  </div>
                  <div className="flex justify-between"><span className="text-xs" style={{ color: '#8fa5b8' }}>Toplam Kazanç</span><span className="text-sm text-white">${memberDetail.profile.totalEarned.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-xs" style={{ color: '#8fa5b8' }}>Toplam Tıklama</span><span className="text-sm text-white">{memberDetail.profile.totalClicks}</span></div>
                  <div className="flex justify-between"><span className="text-xs" style={{ color: '#8fa5b8' }}>Ardışık Tıklama</span><span className="text-sm text-white">{memberDetail.profile.consecutiveClicks}</span></div>
                  <div className="flex justify-between"><span className="text-xs" style={{ color: '#8fa5b8' }}>Aylık Çekim</span><span className="text-sm text-white">{memberDetail.profile.monthlyWithdrawalCount}</span></div>
                  <div className="flex justify-between"><span className="text-xs" style={{ color: '#8fa5b8' }}>Referans Kodu</span><span className="text-sm font-mono text-white">{memberDetail.profile.referralCode}</span></div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs" style={{ color: '#8fa5b8' }}>Çark Hakkı</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold" style={{ color: '#FFD700' }}>{memberDetail.availableSpins ?? 0} mevcut</span>
                      <span className="text-xs" style={{ color: '#5a6a7a' }}>({memberDetail.wheelSpinsUsed ?? 0} kullanildi)</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs" style={{ color: '#8fa5b8' }}>Referans Kazancı</span>
                    <span className="text-sm font-bold" style={{ color: '#10b981' }}>${(memberDetail as any).totalReferralEarnings?.toFixed(2) ?? '0.00'}</span>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setGrantWheelOpen(true)} className="btn-primary" style={{ fontSize: '12px', minHeight: '38px' }}><Gift size={14} />Çark Hakkı</button>
                  <button onClick={() => { updateInvestment.mutate({ userId: selectedMemberId, newInvestment: memberDetail.profile!.investment }); }} className="btn-secondary" style={{ fontSize: '12px', minHeight: '38px' }}><RefreshCw size={14} />Yatırımı Güncelle</button>
                </div>
                <div className="mt-2">
                  <button onClick={() => { if (confirm(`Üye #${memberDetail.publicId ?? selectedMemberId} - ${memberDetail.email} kalıcı olarak silinecek. Emin misiniz?`)) deleteMember.mutate({ userId: selectedMemberId }); }} className="w-full flex items-center justify-center gap-2 font-bold text-sm rounded-xl text-white" style={{ minHeight: '38px', fontSize: '12px', background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.3)' }}><X size={14} />Üyeliği Sil</button>
                </div>

                <div className="mt-4 p-4 rounded-xl" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.16)' }}>
                  <h4 className="text-sm font-bold text-white mb-3">Üye Yatırımları</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 mb-3">
                    <input type="number" value={manualDepositAmount} onChange={(e) => setManualDepositAmount(e.target.value)} placeholder="Tutar $" className="glass-input" style={{ minHeight: '38px', fontSize: '12px' }} />
                    <input type="email" value={manualDepositEmail} onChange={(e) => setManualDepositEmail(e.target.value)} placeholder="E-posta boşsa üye e-postası" className="glass-input" style={{ minHeight: '38px', fontSize: '12px' }} />
                    <button
                      onClick={() => {
                        if (!manualDepositAmount || Number(manualDepositAmount) <= 0) return;
                        addMemberDeposit.mutate({ userId: selectedMemberId, amount: Number(manualDepositAmount), email: manualDepositEmail || undefined, status: 'approved', cryptoType: 'trc20' });
                      }}
                      className="btn-primary"
                      style={{ minHeight: '38px', fontSize: '12px' }}
                    >
                      <Plus size={14} /> Ekle
                    </button>
                  </div>
                  <div className="grid gap-2 max-h-[180px] overflow-y-auto">
                    {((memberDetail as any).deposits ?? []).map((deposit: any) => (
                      <div key={deposit.id} className="flex items-center justify-between gap-2 rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(248,251,255,0.06)' }}>
                        <div>
                          <span className="text-xs font-bold text-white">${Number(deposit.amount).toFixed(2)} · {deposit.status}</span>
                          <p className="text-[10px]" style={{ color: '#8fa5b8' }}>{deposit.txid} · {deposit.createdAt ? new Date(deposit.createdAt).toLocaleDateString('tr-TR') : '-'}</p>
                        </div>
                        <button
                          onClick={() => {
                            if (confirm('Bu yatırım kaydı silinsin mi? Onaylıysa üyenin yatırım ve bakiyesinden düşülür.')) {
                              deleteMemberDeposit.mutate({ depositId: deposit.id });
                            }
                          }}
                          className="grid place-items-center rounded-lg"
                          style={{ width: '30px', height: '30px', color: '#ef4444', background: 'rgba(239,68,68,0.1)' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                    {((memberDetail as any).deposits ?? []).length === 0 && <p className="text-xs text-center py-4" style={{ color: '#5a6a7a' }}>Yatırım kaydı yok.</p>}
                  </div>
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
                  <span className="text-sm font-bold text-white">Çark Hakkı Ayarla</span>
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
            <div className="flex items-center justify-between mb-5"><h3 className="text-lg font-bold text-white">Yatırım Talebi Detayı</h3><button onClick={() => setDetailDeposit(null)} className="btn-secondary" style={{ minHeight: '32px', width: '32px', padding: 0 }}><X size={14} /></button></div>
            <div className="space-y-3 mb-5">
              <div className="flex justify-between"><span className="text-xs" style={{ color: '#8fa5b8' }}>Miktar</span><span className="text-sm font-bold text-white">${Number(detailDeposit.amount).toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-xs" style={{ color: '#8fa5b8' }}>Kripto</span><span className="text-sm font-bold text-white">{(detailDeposit as any).cryptoType?.toUpperCase() || 'TRC20'}</span></div>
              <div className="flex justify-between"><span className="text-xs" style={{ color: '#8fa5b8' }}>Kullanıcı ID</span><span className="text-sm font-bold text-white">#{detailDeposit.userPublicId ?? detailDeposit.userId}</span></div>
              <div className="flex justify-between"><span className="text-xs" style={{ color: '#8fa5b8' }}>E-posta</span><span className="text-sm font-bold text-white">{(detailDeposit as any).email || (detailDeposit as any).userEmail || '-'}</span></div>
              {(detailDeposit as any).userNote && <div className="flex justify-between"><span className="text-xs" style={{ color: '#8fa5b8' }}>Not</span><span className="text-sm text-white">{(detailDeposit as any).userNote}</span></div>}
              <div className="flex justify-between"><span className="text-xs" style={{ color: '#8fa5b8' }}>Talep Tarihi / Saati</span><span className="text-sm font-bold text-white">{detailDeposit.createdAt ? new Date(detailDeposit.createdAt).toLocaleString('tr-TR') : '-'}</span></div>
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
            <div className="flex items-center justify-between mb-5"><h3 className="text-lg font-bold text-white">Çekim Talebi Detayı</h3><button onClick={() => setDetailWithdraw(null)} className="btn-secondary" style={{ minHeight: '32px', width: '32px', padding: 0 }}><X size={14} /></button></div>
            <div className="space-y-3 mb-5">
              <div className="flex justify-between"><span className="text-xs" style={{ color: '#8fa5b8' }}>Miktar</span><span className="text-sm font-bold text-white">${Number(detailWithdraw.amount).toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-xs" style={{ color: '#8fa5b8' }}>E-posta</span><span className="text-sm font-bold text-white">{detailWithdraw.email}</span></div>
              <div className="flex justify-between"><span className="text-xs" style={{ color: '#8fa5b8' }}>Cuzdan</span><span className="text-xs font-mono font-bold text-white">{detailWithdraw.wallet}</span></div>
              <div className="flex justify-between"><span className="text-xs" style={{ color: '#8fa5b8' }}>Durum</span>{statusBadge(detailWithdraw.status)}</div>
            </div>
            {detailWithdraw.status === 'pending' && (
              <div className="flex gap-3">
                <button onClick={() => { approveWithdraw.mutate({ id: detailWithdraw.id }); setDetailWithdraw(null); }} className="flex-1 inline-flex items-center justify-center gap-2 font-extrabold text-sm rounded-xl text-white" style={{ minHeight: '46px', background: '#10b981' }}><Check size={16} />Onayla (Ödendi)</button>
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
