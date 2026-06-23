// Corevest Global Store - localStorage based
export interface User {
  email: string;
  vipLevel: number;
  balance: number;
  investment: number;
  referralCode: string;
  totalEarned: number;
  totalClicks: number;
  joinDate: string;
}

export interface Deposit {
  id: string;
  amount: number;
  txid: string;
  date: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface Withdrawal {
  id: string;
  amount: number;
  email: string;
  wallet: string;
  date: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
}

export interface SupportTicket {
  id: string;
  userEmail: string;
  subject: string;
  status: 'open' | 'resolved' | 'closed';
  createdAt: string;
  messages: { sender: 'user' | 'admin'; text: string; time: string }[];
}

export interface ReferralEntry {
  id: string;
  name: string;
  email: string;
  date: string;
  tier: 1 | 2 | 3;
}

// ─── NEW VIP SYSTEM ───
// VIP levels: investment amount + active referral requirements
// Compound daily returns
export const VIP_TABLE = [
  { level: 0, min: 0, max: 49, rate: 0, rateMin: 0, rateMax: 0, refsRequired: 0, balanceCap: 0, bonus: 0 },
  { level: 1, min: 50, max: 499, rate: 2.30, rateMin: 2.00, rateMax: 2.60, refsRequired: 0, balanceCap: 3000, bonus: 0 },
  { level: 2, min: 500, max: 1999, rate: 2.95, rateMin: 2.60, rateMax: 3.30, refsRequired: 5, balanceCap: 10000, bonus: 30 },
  { level: 3, min: 2000, max: 5999, rate: 3.55, rateMin: 3.30, rateMax: 3.80, refsRequired: 10, balanceCap: 20000, bonus: 60 },
  { level: 4, min: 6000, max: 19999, rate: 4.05, rateMin: 3.80, rateMax: 4.30, refsRequired: 16, balanceCap: 100000, bonus: 120 },
  { level: 5, min: 20000, max: 49999, rate: 4.55, rateMin: 4.30, rateMax: 4.80, refsRequired: 25, balanceCap: 500000, bonus: 240 },
  { level: 6, min: 50000, max: Infinity, rate: 5.40, rateMin: 4.80, rateMax: 6.00, refsRequired: 40, balanceCap: 1000000, bonus: 500 },
];

// NEW Referral Commission Rates
export const REFERRAL_COMMISSIONS = {
  tier1: 10, // %10
  tier2: 6,  // %6
  tier3: 3,  // %3
};

// Get active referral count (tier 1 only)
export function getActiveReferralCount(): number {
  const refs = getReferrals();
  return refs.filter(r => r.tier === 1).length;
}

// Get VIP level based on investment + referral requirements
export function getVipLevel(investment: number): number {
  for (let i = VIP_TABLE.length - 1; i >= 0; i--) {
    const vip = VIP_TABLE[i];
    if (investment >= vip.min) {
      // Check referral requirement
      const activeRefs = getActiveReferralCount();
      if (activeRefs >= vip.refsRequired) {
        return vip.level;
      }
    }
  }
  // Fallback: find highest VIP that meets investment (even if refs not met)
  for (let i = VIP_TABLE.length - 1; i >= 0; i--) {
    if (investment >= VIP_TABLE[i].min) {
      return VIP_TABLE[i].level;
    }
  }
  return 0;
}

export function getVipInfo(level: number) {
  return VIP_TABLE.find(v => v.level === level) || VIP_TABLE[0];
}

export function getDailyRate(level: number): number {
  return getVipInfo(level).rate;
}

// Compound interest: daily earning added to principal
// After N days: Balance = Principal × (1 + rate/100)^N
export function calculateCompoundEarning(investment: number, level: number, days: number): number {
  if (level === 0 || investment <= 0) return 0;
  const rate = getDailyRate(level) / 100;
  // Compound: Final = P × (1 + r)^days
  return investment * Math.pow(1 + rate, days) - investment;
}

export function getNextVipRequirement(level: number): { nextLevel: number; minInvestment: number; refsRequired: number } | null {
  const next = VIP_TABLE.find(v => v.level === level + 1);
  if (!next) return null;
  return { nextLevel: next.level, minInvestment: next.min, refsRequired: next.refsRequired };
}

// ─── User ───
export function initUser(email: string, referralCode?: string) {
  const code = 'CV' + Math.random().toString(36).substring(2, 7).toUpperCase();
  const user: User = {
    email,
    vipLevel: 0,
    balance: 5,
    investment: 0,
    referralCode: code,
    totalEarned: 0,
    totalClicks: 0,
    joinDate: new Date().toISOString().split('T')[0],
  };
  localStorage.setItem('corevest_user', JSON.stringify(user));
  if (referralCode) localStorage.setItem('corevest_ref_by', referralCode);
  localStorage.removeItem('corevest_last_click');
  localStorage.removeItem('corevest_deposits');
  localStorage.removeItem('corevest_withdrawals');
  localStorage.removeItem('corevest_tickets');
  localStorage.removeItem('corevest_last_ticket');
  localStorage.removeItem('corevest_referrals');
}

export function getUser(): User | null {
  const raw = localStorage.getItem('corevest_user');
  if (!raw) return null;
  return JSON.parse(raw) as User;
}

export function syncUser(partial: Partial<User>) {
  const user = getUser();
  if (!user) return;
  const updated = { ...user, ...partial };
  updated.vipLevel = getVipLevel(updated.investment);
  localStorage.setItem('corevest_user', JSON.stringify(updated));
}

// ─── Deposits ───
export function addDeposit(amount: number): Deposit {
  const deposits = getDeposits();
  const deposit: Deposit = {
    id: 'D' + Date.now(),
    amount,
    txid: 'TRX-' + Math.floor(Math.random() * 900000 + 100000),
    date: new Date().toISOString().split('T')[0],
    status: 'pending',
  };
  deposits.unshift(deposit);
  localStorage.setItem('corevest_deposits', JSON.stringify(deposits));
  return deposit;
}

export function getDeposits(): Deposit[] {
  const raw = localStorage.getItem('corevest_deposits');
  return raw ? JSON.parse(raw) : [];
}

export function approveDeposit(id: string) {
  const deposits = getDeposits();
  const idx = deposits.findIndex(d => d.id === id);
  if (idx === -1) return;
  deposits[idx].status = 'approved';
  localStorage.setItem('corevest_deposits', JSON.stringify(deposits));
  const user = getUser();
  if (user) {
    const newInvestment = user.investment + deposits[idx].amount;
    syncUser({ investment: newInvestment, vipLevel: getVipLevel(newInvestment) });
  }
}

export function rejectDeposit(id: string) {
  const deposits = getDeposits();
  const idx = deposits.findIndex(d => d.id === id);
  if (idx !== -1) {
    deposits[idx].status = 'rejected';
    localStorage.setItem('corevest_deposits', JSON.stringify(deposits));
  }
}

// ─── Withdrawals ───
export function addWithdrawal(amount: number, email: string, wallet: string): Withdrawal | null {
  const user = getUser();
  if (!user || user.balance < amount) return null;
  syncUser({ balance: user.balance - amount });
  const withdrawals = getWithdrawals();
  const w: Withdrawal = {
    id: 'W' + Date.now(),
    amount,
    email,
    wallet,
    date: new Date().toISOString().split('T')[0],
    status: 'pending',
  };
  withdrawals.unshift(w);
  localStorage.setItem('corevest_withdrawals', JSON.stringify(withdrawals));
  return w;
}

export function getWithdrawals(): Withdrawal[] {
  const raw = localStorage.getItem('corevest_withdrawals');
  return raw ? JSON.parse(raw) : [];
}

export function cancelWithdrawal(id: string) {
  const withdrawals = getWithdrawals();
  const idx = withdrawals.findIndex(w => w.id === id);
  if (idx === -1 || withdrawals[idx].status !== 'pending') return;
  const user = getUser();
  if (user) syncUser({ balance: user.balance + withdrawals[idx].amount });
  withdrawals[idx].status = 'cancelled';
  localStorage.setItem('corevest_withdrawals', JSON.stringify(withdrawals));
}

export function approveWithdrawal(id: string) {
  const withdrawals = getWithdrawals();
  const idx = withdrawals.findIndex(w => w.id === id);
  if (idx !== -1) {
    withdrawals[idx].status = 'approved';
    localStorage.setItem('corevest_withdrawals', JSON.stringify(withdrawals));
  }
}

export function rejectWithdrawal(id: string) {
  const withdrawals = getWithdrawals();
  const idx = withdrawals.findIndex(w => w.id === id);
  if (idx === -1) return;
  const user = getUser();
  if (user) syncUser({ balance: user.balance + withdrawals[idx].amount });
  withdrawals[idx].status = 'rejected';
  localStorage.setItem('corevest_withdrawals', JSON.stringify(withdrawals));
}

// ─── Support Tickets ───
export function createSupportTicket(subject: string): SupportTicket {
  const user = getUser();
  const tickets = getSupportTickets();
  const ticket: SupportTicket = {
    id: 'T' + Date.now(),
    userEmail: user?.email || 'unknown',
    subject,
    status: 'open',
    createdAt: new Date().toISOString().split('T')[0],
    messages: [{ sender: 'user', text: subject, time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) }],
  };
  tickets.unshift(ticket);
  localStorage.setItem('corevest_tickets', JSON.stringify(tickets));
  localStorage.setItem('corevest_last_ticket', new Date().toISOString());
  return ticket;
}

export function getSupportTickets(): SupportTicket[] {
  const raw = localStorage.getItem('corevest_tickets');
  return raw ? JSON.parse(raw) : [];
}

export function addTicketMessage(ticketId: string, text: string, sender: 'user' | 'admin') {
  const tickets = getSupportTickets();
  const idx = tickets.findIndex(t => t.id === ticketId);
  if (idx === -1 || tickets[idx].status === 'closed') return;
  tickets[idx].messages.push({ sender, text, time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) });
  localStorage.setItem('corevest_tickets', JSON.stringify(tickets));
}

export function closeTicket(ticketId: string) {
  const tickets = getSupportTickets();
  const idx = tickets.findIndex(t => t.id === ticketId);
  if (idx !== -1) {
    tickets[idx].status = 'closed';
    localStorage.setItem('corevest_tickets', JSON.stringify(tickets));
  }
}

export function resolveTicket(ticketId: string) {
  const tickets = getSupportTickets();
  const idx = tickets.findIndex(t => t.id === ticketId);
  if (idx !== -1) {
    tickets[idx].status = 'resolved';
    localStorage.setItem('corevest_tickets', JSON.stringify(tickets));
  }
}

export function canCreateTicket(): boolean {
  const last = localStorage.getItem('corevest_last_ticket');
  if (!last) return true;
  return Date.now() - new Date(last).getTime() >= 24 * 60 * 60 * 1000;
}

// ─── Referrals ───
export function addReferral(name: string, email: string, tier: 1 | 2 | 3) {
  const refs = getReferrals();
  refs.unshift({ id: 'R' + Date.now(), name, email, date: new Date().toISOString().split('T')[0], tier });
  localStorage.setItem('corevest_referrals', JSON.stringify(refs));
  // Recalculate VIP after referral change
  const user = getUser();
  if (user) syncUser({ investment: user.investment });
}

export function getReferrals(): ReferralEntry[] {
  const raw = localStorage.getItem('corevest_referrals');
  return raw ? JSON.parse(raw) : [];
}

// ─── Click with Compound Interest ───
export function recordClick(earning: number) {
  const user = getUser();
  if (!user) return;
  syncUser({
    balance: user.balance + earning,
    totalEarned: user.totalEarned + earning,
    totalClicks: user.totalClicks + 1,
  });
  localStorage.setItem('corevest_last_click', Date.now().toString());
}

export function getLastClick(): number | null {
  const raw = localStorage.getItem('corevest_last_click');
  return raw ? Number(raw) : null;
}

export function canClickTR(): boolean {
  const user = getUser();
  if (!user || user.investment === 0) return false;
  const last = getLastClick();
  if (!last) return true;
  const now = Date.now();
  const turkeyOffset = 3 * 3600000;
  const utcNow = now + new Date().getTimezoneOffset() * 60000;
  const trNow = utcNow + turkeyOffset;
  const trLast = (last + new Date().getTimezoneOffset() * 60000) + turkeyOffset;
  const sameDay = new Date(trLast).toDateString() === new Date(trNow).toDateString();
  return !sameDay;
}

// ─── Admin seed ───
export function seedAdminDemoData() {
  if (getSupportTickets().length === 0) {
    localStorage.setItem('corevest_tickets', JSON.stringify([]));
  }
}

// ─── Reset all data ───
export function resetAllData() {
  localStorage.removeItem('corevest_user');
  localStorage.removeItem('corevest_deposits');
  localStorage.removeItem('corevest_withdrawals');
  localStorage.removeItem('corevest_last_click');
  localStorage.removeItem('corevest_ref_by');
  localStorage.removeItem('corevest_tickets');
  localStorage.removeItem('corevest_last_ticket');
  localStorage.removeItem('corevest_referrals');
}
