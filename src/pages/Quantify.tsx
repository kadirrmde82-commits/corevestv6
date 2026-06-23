import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Crown, Clock, TrendingUp, DollarSign, Calendar,
  MousePointerClick, ChevronRight, Users
} from 'lucide-react';
import Layout from '../components/Layout';
import { trpc } from '@/providers/trpc';
import { VIP_TABLE } from '../store';

function getTimeRemainingTR(): { hours: number; minutes: number; seconds: number; total: number } {
  const now = Date.now();
  const turkeyOffset = 3;
  const utc = now + (new Date().getTimezoneOffset() * 60000);
  const turkeyNow = utc + (3600000 * turkeyOffset);
  const today = new Date(turkeyNow);
  today.setHours(8, 0, 0, 0);
  let next8am = today.getTime();
  if (new Date(turkeyNow).getHours() >= 8) next8am += 24 * 60 * 60 * 1000;
  const diff = Math.max(0, next8am - turkeyNow);
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  return { hours, minutes, seconds, total: diff };
}

export default function Quantify() {
  const { t } = useTranslation();
  const [countdown, setCountdown] = useState({ hours: 0, minutes: 0, seconds: 0, total: 0 });
  const [showSuccess, setShowSuccess] = useState(false);

  const utils = trpc.useUtils();

  // Fetch profile and click status
  const { data: profile } = trpc.profile.me.useQuery(undefined, {
    staleTime: 1000 * 30,
    retry: false,
  });
  const { data: clickStatus } = trpc.click.status.useQuery(undefined, {
    staleTime: 1000 * 10,
    retry: false,
  });
  const { data: referralCount } = trpc.referral.count.useQuery(undefined, {
    staleTime: 1000 * 60,
    retry: false,
  });

  const clickMutation = trpc.click.record.useMutation({
    onSuccess: () => {
      utils.profile.me.invalidate();
      utils.click.status.invalidate();
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    },
  });

  const currentVipLevel = clickStatus?.vipLevel || 0;
  const dailyRate = clickStatus?.dailyRate || 0;
  const dailyEarning = clickStatus?.dailyEarning || 0;
  const activeRefs = referralCount?.tier1 || 0;
  const canClick = clickStatus?.canClick || false;
  const investment = Number(profile?.investment || 0);

  const nextVip = (() => {
    const nv = VIP_TABLE.find(v => v.level === currentVipLevel + 1);
    if (!nv) return null;
    return { nextLevel: nv.level, minInvestment: nv.min, refsRequired: nv.refsRequired };
  })();

  // Compound projections
  const weekEarning = dailyRate > 0 ? investment * (Math.pow(1 + dailyRate / 100, 7) - 1) : 0;
  const monthEarning = dailyRate > 0 ? investment * (Math.pow(1 + dailyRate / 100, 30) - 1) : 0;

  useEffect(() => {
    const timer = setInterval(() => setCountdown(getTimeRemainingTR()), 1000);
    setCountdown(getTimeRemainingTR());
    return () => clearInterval(timer);
  }, []);

  const handleClick = useCallback(() => {
    if (!canClick) return;
    clickMutation.mutate({ earning: dailyEarning });
  }, [canClick, dailyEarning, clickMutation]);

  if (!profile) return null;

  return (
    <Layout>
      <div className="grid gap-3">
        {/* Hero Banner */}
        <div className="relative overflow-hidden animate-fade-in" style={{ border: '1px solid rgba(248,251,255,0.11)', borderRadius: '18px', padding: '22px', background: 'radial-gradient(circle at 76% 22%, rgba(255,215,0,0.18), transparent 26%), radial-gradient(circle at 92% 84%, rgba(108,99,255,0.1), transparent 28%), linear-gradient(135deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02))', boxShadow: '0 22px 60px rgba(0,0,0,0.32)' }}>
          <div className="relative z-10">
            <div className="status-badge mb-3"><Crown size={14} />VIP {currentVipLevel} - {t('quantify.yourVipLevel')}</div>
            <h1 className="text-2xl font-bold text-white mb-1">{t('quantify.title')}</h1>
            <p className="text-sm max-w-md" style={{ color: '#a9bccf' }}>{currentVipLevel === 0 ? t('quantify.vip0notice') : t('quantify.subtitle')}</p>
          </div>
          <div className="absolute right-[-20px] bottom-[-40px] rounded-full" style={{ width: '140px', height: '140px', border: '1px solid rgba(255,215,0,0.18)', transform: 'rotate(-18deg)' }}>
            <span className="absolute rounded-full" style={{ top: '28px', left: '44px', width: '10px', height: '10px', background: '#FFD700', boxShadow: '0 0 16px rgba(255,215,0,0.8)' }} />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="glass-card">
            <div className="flex items-center gap-2 mb-2"><div className="grid place-items-center rounded-xl" style={{ width: '38px', height: '38px', color: '#FFD700', background: 'rgba(255,215,0,0.1)' }}><DollarSign size={18} /></div></div>
            <span className="text-xs font-medium" style={{ color: '#8fa5b8' }}>Yatırım</span>
            <strong className="block text-xl text-white mt-1">${investment.toLocaleString()}</strong>
          </div>
          <div className="glass-card">
            <div className="flex items-center gap-2 mb-2"><div className="grid place-items-center rounded-xl" style={{ width: '38px', height: '38px', color: '#FFD700', background: 'rgba(255,215,0,0.1)' }}><TrendingUp size={18} /></div></div>
            <span className="text-xs font-medium" style={{ color: '#8fa5b8' }}>Günlük Oran</span>
            <strong className="block text-xl mt-1" style={{ color: dailyRate > 0 ? '#FFD700' : '#5a6a7a' }}>{dailyRate > 0 ? `%${dailyRate}` : '-'}</strong>
          </div>
          <div className="glass-card">
            <div className="flex items-center gap-2 mb-2"><div className="grid place-items-center rounded-xl" style={{ width: '38px', height: '38px', color: '#FFD700', background: 'rgba(255,215,0,0.1)' }}><Users size={18} /></div></div>
            <span className="text-xs font-medium" style={{ color: '#8fa5b8' }}>Aktif Referans</span>
            <strong className="block text-xl text-white mt-1">{activeRefs}</strong>
          </div>
          <div className="glass-card">
            <div className="flex items-center gap-2 mb-2"><div className="grid place-items-center rounded-xl" style={{ width: '38px', height: '38px', color: '#FFD700', background: 'rgba(255,215,0,0.1)' }}><Calendar size={18} /></div></div>
            <span className="text-xs font-medium" style={{ color: '#8fa5b8' }}>Son Tıklama</span>
            <strong className="block text-sm text-white mt-1">{clickStatus?.lastClickAt ? new Date(clickStatus.lastClickAt).toLocaleDateString() : '-'}</strong>
          </div>
        </div>

        {/* Click Area */}
        <div className="glass-card text-center py-8" style={{ background: canClick ? 'radial-gradient(circle at center, rgba(255,215,0,0.12), rgba(3,8,16,0.6))' : currentVipLevel === 0 ? 'rgba(3, 8, 16, 0.4)' : 'rgba(3, 8, 16, 0.52)', borderColor: canClick ? 'rgba(255,215,0,0.35)' : 'rgba(248,251,255,0.08)' }}>
          {currentVipLevel === 0 ? (
            <>
              <div className="mx-auto mb-4 grid place-items-center rounded-full" style={{ width: '72px', height: '72px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(248,251,255,0.06)' }}><MousePointerClick size={32} style={{ color: '#3a4a5a' }} /></div>
              <p className="text-sm font-medium mb-3" style={{ color: '#5a6a7a' }}>Yatırım yaparak VIP seviyenizi yükseltin.</p>
              <div className="p-3 rounded-xl" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
                <p className="text-xs" style={{ color: '#10b981' }}>Hoş geldiniz! Size 5$ bakiye tanımlandı. Yatırım yaparak kazanmaya başlayın.</p>
              </div>
            </>
          ) : canClick ? (
            <>
              <div className="mx-auto mb-4 grid place-items-center rounded-full animate-glow" style={{ width: '72px', height: '72px', background: 'linear-gradient(135deg, #FFD700, #FFA500)' }}><MousePointerClick size={32} color="#04070d" /></div>
              <p className="text-sm mb-3" style={{ color: '#8fa5b8' }}>Günlük kazancınız: <strong style={{ color: '#FFD700' }}>${dailyEarning.toFixed(2)}</strong> (%{dailyRate} bileşik)</p>
              <button onClick={handleClick} className="btn-primary" style={{ maxWidth: '300px', margin: '0 auto', fontSize: '1rem', minHeight: '52px' }}>Ödülü Almak İçin Tıkla</button>
              {showSuccess && <p className="mt-3 text-sm font-semibold" style={{ color: '#10b981' }}>+${dailyEarning.toFixed(2)} kazandınız!</p>}
            </>
          ) : (
            <>
              <div className="mx-auto mb-4 grid place-items-center rounded-full" style={{ width: '72px', height: '72px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(248,251,255,0.1)' }}><Clock size={32} style={{ color: '#5a6a7a' }} /></div>
              <p className="text-sm font-medium mb-2" style={{ color: '#8fa5b8' }}>Sonraki tıklama için kalan süre:</p>
              <p className="text-xs mb-4" style={{ color: '#5a6a7a' }}>Türkiye saati ile 08:00&apos;da yenilenebilir</p>
              <div className="flex items-center justify-center gap-3 animate-countdown">
                {[{ value: countdown.hours, label: 'saat' }, { value: countdown.minutes, label: 'dakika' }, { value: countdown.seconds, label: 'saniye' }].map((item, i) => (
                  <div key={i} className="text-center"><div className="font-extrabold text-2xl rounded-xl px-3 py-2" style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.15)', color: '#FFD700', minWidth: '60px' }}>{String(item.value).padStart(2, '0')}</div><span className="text-xs mt-1 block" style={{ color: '#5a6a7a' }}>{item.label}</span></div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Compound Earnings Preview */}
        {currentVipLevel > 0 && (
          <div className="glass-card">
            <h2 className="text-base font-bold text-white mb-3">Bileşik Kazanç Projeksiyonu</h2>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.12)' }}>
                <span className="text-xs block mb-1" style={{ color: '#8fa5b8' }}>Bugün</span>
                <span className="text-sm font-extrabold" style={{ color: '#FFD700' }}>${dailyEarning.toFixed(2)}</span>
              </div>
              <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(248,251,255,0.05)' }}>
                <span className="text-xs block mb-1" style={{ color: '#8fa5b8' }}>7 Gün</span>
                <span className="text-sm font-extrabold text-white">${weekEarning.toFixed(2)}</span>
              </div>
              <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(248,251,255,0.05)' }}>
                <span className="text-xs block mb-1" style={{ color: '#8fa5b8' }}>30 Gün</span>
                <span className="text-sm font-extrabold text-white">${monthEarning.toFixed(2)}</span>
              </div>
            </div>
            <p className="text-xs mt-2" style={{ color: '#5a6a7a' }}>Bileşik faiz ile hesaplanmıştır. Günlük kazançlar anaparaya eklenir.</p>
          </div>
        )}

        {/* Next VIP Requirement */}
        {nextVip && (
          <div className="glass-card" style={{ background: 'rgba(255,215,0,0.04)', border: '1px solid rgba(255,215,0,0.15)' }}>
            <h2 className="text-sm font-bold text-white mb-2">Sonraki VIP: VIP {nextVip.nextLevel}</h2>
            <div className="space-y-2">
              <div className="flex justify-between"><span className="text-xs" style={{ color: '#8fa5b8' }}>Min. Yatırım</span><span className="text-xs font-bold" style={{ color: '#FFD700' }}>${nextVip.minInvestment.toLocaleString()}</span></div>
              {nextVip.refsRequired > 0 && <div className="flex justify-between"><span className="text-xs" style={{ color: '#8fa5b8' }}>Aktif Referans</span><span className="text-xs font-bold" style={{ color: activeRefs >= nextVip.refsRequired ? '#10b981' : '#FFD700' }}>{activeRefs} / {nextVip.refsRequired}</span></div>}
              <div className="flex justify-between"><span className="text-xs" style={{ color: '#8fa5b8' }}>Günlük Oran</span><span className="text-xs font-bold" style={{ color: '#FFD700' }}>%{VIP_TABLE.find(v => v.level === nextVip.nextLevel)?.rate || 0}</span></div>
            </div>
          </div>
        )}

        {/* VIP Levels Table */}
        <div className="glass-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-white">VIP Seviyeleri</h2>
            <ChevronRight size={18} style={{ color: '#8fa5b8' }} />
          </div>
          <div className="grid gap-2.5">
            {VIP_TABLE.filter(v => v.level > 0).map((vip) => {
              const isCurrent = vip.level === currentVipLevel;
              return (
                <div key={vip.level} className="flex items-center gap-3 rounded-xl px-4 py-3 transition-all" style={{ background: isCurrent ? 'rgba(255,215,0,0.08)' : 'rgba(255,255,255,0.03)', border: isCurrent ? '1px solid rgba(255,215,0,0.2)' : '1px solid rgba(248,251,255,0.05)' }}>
                  <div className="grid place-items-center rounded-lg shrink-0 font-extrabold text-sm" style={{ width: '42px', height: '42px', color: isCurrent ? '#FFD700' : '#5a6a7a', background: isCurrent ? 'rgba(255,215,0,0.12)' : 'rgba(255,255,255,0.04)' }}>V{vip.level}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">VIP {vip.level}</span>
                      {isCurrent && <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,215,0,0.15)', color: '#FFD700' }}>Sizin Seviyeniz</span>}
                    </div>
                    <span className="text-xs" style={{ color: '#8fa5b8' }}>${vip.min.toLocaleString()}+ {vip.refsRequired > 0 ? `| ${vip.refsRequired} Ref` : ''}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-sm font-extrabold" style={{ color: '#FFD700' }}>%{vip.rate}</span>
                    <span className="text-xs block" style={{ color: '#5a6a7a' }}>Günlük</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Layout>
  );
}
