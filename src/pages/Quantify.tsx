import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Crown, Clock, TrendingUp, DollarSign, Calendar,
  MousePointerClick, ChevronRight, Users, X
} from 'lucide-react';
import Layout from '../components/Layout';
import { trpc } from '@/providers/trpc';
import { VIP_TABLE } from '../store';

const PROCESSING_MIN_SECONDS = 10;
const PROCESSING_MAX_SECONDS = 20;

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
  const [selectedVipLevel, setSelectedVipLevel] = useState<number | null>(null);
  const [isProcessingTrade, setIsProcessingTrade] = useState(false);
  const [isCompletingTrade, setIsCompletingTrade] = useState(false);
  const [processingSecondsLeft, setProcessingSecondsLeft] = useState(0);
  const [lastClickEarned, setLastClickEarned] = useState(0);
  const [tradeError, setTradeError] = useState('');
  const processingTimeoutRef = useRef<number | null>(null);
  const processingIntervalRef = useRef<number | null>(null);

  const utils = trpc.useUtils();

  const { data: profile } = trpc.profile.me.useQuery(undefined, {
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
    retry: false,
  });
  const { data: clickStatus } = trpc.click.status.useQuery(undefined, {
    staleTime: 1000 * 20,
    refetchInterval: 1000 * 15,
    retry: false,
  });
  const clearProcessingTimers = useCallback(() => {
    if (processingTimeoutRef.current) window.clearTimeout(processingTimeoutRef.current);
    if (processingIntervalRef.current) window.clearInterval(processingIntervalRef.current);
    processingTimeoutRef.current = null;
    processingIntervalRef.current = null;
  }, []);

  const clickMutation = trpc.click.record.useMutation({
    retry: (failureCount, error) => {
      const message = error?.message?.toLowerCase?.() || '';
      return failureCount < 2 && (message.includes('fetch') || message.includes('network') || message.includes('timeout'));
    },
    retryDelay: (attemptIndex) => Math.min(1200 * (attemptIndex + 1), 3000),
    onSuccess: (result) => {
      clearProcessingTimers();
      Promise.allSettled([
        utils.profile.me.invalidate(),
        utils.click.status.invalidate(),
        utils.click.history.invalidate(),
        utils.referral.earningsList.invalidate(),
        utils.referral.overview.invalidate(),
      ]);
      setIsProcessingTrade(false);
      setIsCompletingTrade(false);
      setProcessingSecondsLeft(0);
      setTradeError('');
      setLastClickEarned(Number(result.earned || 0));
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    },
    onError: (error) => {
      clearProcessingTimers();
      Promise.allSettled([
        utils.profile.me.invalidate(),
        utils.click.status.invalidate(),
      ]);
      setIsProcessingTrade(false);
      setIsCompletingTrade(false);
      setProcessingSecondsLeft(0);
      const rawMessage = error.message || '';
      const isFetchError = rawMessage.toLowerCase().includes('fetch') || rawMessage.toLowerCase().includes('network');
      setTradeError(isFetchError
        ? 'Bağlantı kısa süreli koptu. Lütfen birkaç saniye sonra tekrar deneyin.'
        : rawMessage || t('quantifyExtra.processingError'));
    },
  });

  const currentVipLevel = clickStatus?.vipLevel || 0;
  const dailyRate = clickStatus?.dailyRate || 0;
  const dailyRateMin = clickStatus?.dailyRateMin ?? dailyRate;
  const dailyRateMax = clickStatus?.dailyRateMax ?? dailyRate;
  const dailyEarning = clickStatus?.dailyEarning || 0;
  const dailyEarningMin = clickStatus?.dailyEarningMin ?? dailyEarning;
  const dailyEarningMax = clickStatus?.dailyEarningMax ?? dailyEarning;
  const activeRefs = clickStatus?.activeRefs ?? 0;
  const canClick = clickStatus?.canClick || false;
  const balanceCapReached = clickStatus?.balanceCapReached || false;
  const balanceCap = clickStatus?.balanceCap || 0;
  const investment = Number(profile?.investment || 0);
  const blockedReason = (clickStatus as any)?.blockedReason || '';
  const blockedReasonCode = (clickStatus as any)?.blockedReasonCode || '';
  const minimumInvestment = Number((clickStatus as any)?.minimumInvestment || 50);
  const showEligibilityWarning = !canClick && !balanceCapReached && blockedReason && blockedReasonCode !== 'cooldown';
  const earningsSummary = (profile as any)?.earningsSummary ?? { today: 0, yesterday: 0, total: Number((profile as any)?.totalEarned || 0) };
  const totalBalance = Number((profile as any)?.balance || 0);

  const nextVip = (() => {
    const nv = VIP_TABLE.find(v => v.level === currentVipLevel + 1);
    if (!nv) return null;
    return { nextLevel: nv.level, minInvestment: nv.min, refsRequired: nv.refsRequired };
  })();

  const weekEarning = dailyRate > 0 ? investment * (Math.pow(1 + dailyRate / 100, 7) - 1) : 0;
  const monthEarning = dailyRate > 0 ? investment * (Math.pow(1 + dailyRate / 100, 30) - 1) : 0;

  useEffect(() => {
    const timer = setInterval(() => setCountdown(getTimeRemainingTR()), 1000);
    setCountdown(getTimeRemainingTR());
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => {
      clearProcessingTimers();
    };
  }, [clearProcessingTimers]);

  const handleClick = useCallback(() => {
    if (!canClick || isProcessingTrade || clickMutation.isPending) return;

    clearProcessingTimers();

    const processingSeconds = Math.floor(Math.random() * (PROCESSING_MAX_SECONDS - PROCESSING_MIN_SECONDS + 1)) + PROCESSING_MIN_SECONDS;
    const processingEndsAt = Date.now() + processingSeconds * 1000;
    setShowSuccess(false);
    setTradeError('');
    setIsProcessingTrade(true);
    setIsCompletingTrade(false);
    setProcessingSecondsLeft(processingSeconds);

    processingIntervalRef.current = window.setInterval(() => {
      const secondsLeft = Math.ceil((processingEndsAt - Date.now()) / 1000);
      setProcessingSecondsLeft(Math.max(0, secondsLeft));
    }, 1000);

    processingTimeoutRef.current = window.setTimeout(() => {
      if (processingIntervalRef.current) window.clearInterval(processingIntervalRef.current);
      processingIntervalRef.current = null;
      setProcessingSecondsLeft(0);
      setIsCompletingTrade(true);
      clickMutation.mutate({});
    }, processingSeconds * 1000);
  }, [canClick, clearProcessingTimers, clickMutation, isProcessingTrade]);

  if (!profile) return null;

  const selectedVip = selectedVipLevel !== null ? VIP_TABLE.find(vip => vip.level === selectedVipLevel) : null;

  return (
    <Layout>
      <div className="grid gap-3">
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

        <div className="grid grid-cols-2 gap-3">
          <div className="glass-card">
            <div className="flex items-center gap-2 mb-2"><div className="grid place-items-center rounded-xl" style={{ width: '38px', height: '38px', color: '#FFD700', background: 'rgba(255,215,0,0.1)' }}><DollarSign size={18} /></div></div>
            <span className="text-xs font-medium" style={{ color: '#8fa5b8' }}>{t('quantifyExtra.investment')}</span>
            <strong className="block text-xl text-white mt-1">${investment.toLocaleString()}</strong>
          </div>
          <div className="glass-card">
            <div className="flex items-center gap-2 mb-2"><div className="grid place-items-center rounded-xl" style={{ width: '38px', height: '38px', color: '#FFD700', background: 'rgba(255,215,0,0.1)' }}><TrendingUp size={18} /></div></div>
            <span className="text-xs font-medium" style={{ color: '#8fa5b8' }}>{t('quantifyExtra.dailyRate')}</span>
            <strong className="block text-xl mt-1" style={{ color: dailyRate > 0 ? '#FFD700' : '#5a6a7a' }}>{dailyRate > 0 ? `%${dailyRateMin.toFixed(2)} - %${dailyRateMax.toFixed(2)}` : '-'}</strong>
          </div>
          <div className="glass-card">
            <div className="flex items-center gap-2 mb-2"><div className="grid place-items-center rounded-xl" style={{ width: '38px', height: '38px', color: '#FFD700', background: 'rgba(255,215,0,0.1)' }}><Users size={18} /></div></div>
            <span className="text-xs font-medium" style={{ color: '#8fa5b8' }}>{t('quantifyExtra.activeReferral')}</span>
            <strong className="block text-xl text-white mt-1">{activeRefs}</strong>
          </div>
          <div className="glass-card">
            <div className="flex items-center gap-2 mb-2"><div className="grid place-items-center rounded-xl" style={{ width: '38px', height: '38px', color: '#FFD700', background: 'rgba(255,215,0,0.1)' }}><Calendar size={18} /></div></div>
            <span className="text-xs font-medium" style={{ color: '#8fa5b8' }}>{t('quantifyExtra.lastClick')}</span>
            <strong className="block text-sm text-white mt-1">{clickStatus?.lastClickAt ? new Date(clickStatus.lastClickAt).toLocaleDateString() : '-'}</strong>
          </div>
        </div>

        <div className="glass-card text-center py-8" style={{ background: canClick ? 'radial-gradient(circle at center, rgba(255,215,0,0.12), rgba(3,8,16,0.6))' : currentVipLevel === 0 ? 'rgba(3, 8, 16, 0.4)' : 'rgba(3, 8, 16, 0.52)', borderColor: canClick ? 'rgba(255,215,0,0.35)' : 'rgba(248,251,255,0.08)' }}>
          {showEligibilityWarning || currentVipLevel === 0 ? (
            <>
              <div className="mx-auto mb-4 grid place-items-center rounded-full" style={{ width: '72px', height: '72px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(248,251,255,0.06)' }}><MousePointerClick size={32} style={{ color: '#3a4a5a' }} /></div>
              <p className="text-sm font-bold mb-2 text-white">{blockedReason || t('quantifyExtra.upgradeVip')}</p>
              <p className="text-xs mb-3" style={{ color: '#8fa5b8' }}>
                Mevcut onaylı yatırımınız: <strong style={{ color: '#FFD700' }}>${investment.toLocaleString()}</strong>
                {' · '}
                Minimum: <strong style={{ color: '#FFD700' }}>${minimumInvestment.toLocaleString()}</strong>
              </p>
              <div className="p-3 rounded-xl" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
                <p className="text-xs" style={{ color: '#10b981' }}>{t('quantifyExtra.welcomeBonus')}</p>
              </div>
            </>
          ) : balanceCapReached ? (
            <>
              <div className="mx-auto mb-4 grid place-items-center rounded-full" style={{ width: '72px', height: '72px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(248,251,255,0.1)' }}><Clock size={32} style={{ color: '#FFD700' }} /></div>
              <p className="text-sm font-bold mb-2 text-white">{t('quantifyExtra.balanceCapReached')}</p>
              <p className="text-xs" style={{ color: '#8fa5b8' }}>{t('quantifyExtra.balanceCapReachedDesc', { amount: Number(balanceCap).toLocaleString() })}</p>
            </>
          ) : canClick ? (
            <>
              <div className="mx-auto mb-4 grid place-items-center rounded-full animate-glow" style={{ width: '72px', height: '72px', background: 'linear-gradient(135deg, #FFD700, #FFA500)' }}><MousePointerClick size={32} color="#04070d" /></div>
              <p className="text-sm mb-3" style={{ color: '#8fa5b8' }}>{t('quantifyExtra.dailyEarning')} <strong style={{ color: '#FFD700' }}>${dailyEarningMin.toFixed(2)} - ${dailyEarningMax.toFixed(2)}</strong> (%{dailyRateMin.toFixed(2)} - %{dailyRateMax.toFixed(2)})</p>
              <button disabled={isProcessingTrade || clickMutation.isPending} onClick={handleClick} className="btn-primary" style={{ maxWidth: '300px', margin: '0 auto', fontSize: '1rem', minHeight: '52px', opacity: isProcessingTrade || clickMutation.isPending ? 0.75 : 1 }}>
                {isProcessingTrade || clickMutation.isPending ? t('quantifyExtra.processingButton') : t('quantify.clickButton')}
              </button>
              {isProcessingTrade && (
                <div className="mt-4 mx-auto rounded-2xl p-4 animate-pulse" style={{ maxWidth: '340px', background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.18)' }}>
                  <p className="text-sm font-extrabold" style={{ color: '#FFD700' }}>{t('quantifyExtra.processingTitle')}</p>
                  <p className="text-xs mt-1" style={{ color: '#8fa5b8' }}>{t('quantifyExtra.processingDescription')}</p>
                  <p className="text-xs font-bold mt-2" style={{ color: '#10b981' }}>
                    {isCompletingTrade
                      ? t('quantifyExtra.processingCompleting', 'İşlem sonucu onaylanıyor...')
                      : t('quantifyExtra.processingSecondsLeft', { seconds: processingSecondsLeft })}
                  </p>
                </div>
              )}
              {showSuccess && <p className="mt-3 text-sm font-semibold" style={{ color: '#10b981' }}>{t('quantifyExtra.processingSuccess')} +${(lastClickEarned || dailyEarning).toFixed(2)} {t('quantifyExtra.earned')}</p>}
              {tradeError && (
                <div className="mt-4 mx-auto rounded-2xl p-3" style={{ maxWidth: '340px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <p className="text-xs font-bold" style={{ color: '#ef4444' }}>{tradeError}</p>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="mx-auto mb-4 grid place-items-center rounded-full" style={{ width: '72px', height: '72px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(248,251,255,0.1)' }}><Clock size={32} style={{ color: '#5a6a7a' }} /></div>
              <p className="text-sm font-medium mb-2" style={{ color: '#8fa5b8' }}>{t('quantifyExtra.nextClickRemaining')}</p>
              <p className="text-xs mb-4" style={{ color: '#5a6a7a' }}>{t('quantifyExtra.refreshAt')}</p>
              <div className="flex items-center justify-center gap-3 animate-countdown">
                {[{ value: countdown.hours, label: t('quantifyExtra.hour') }, { value: countdown.minutes, label: t('quantifyExtra.minute') }, { value: countdown.seconds, label: t('quantifyExtra.second') }].map((item, i) => (
                  <div key={i} className="text-center"><div className="font-extrabold text-2xl rounded-xl px-3 py-2" style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.15)', color: '#FFD700', minWidth: '60px' }}>{String(item.value).padStart(2, '0')}</div><span className="text-xs mt-1 block" style={{ color: '#5a6a7a' }}>{item.label}</span></div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="glass-card text-center">
            <span className="text-xs font-medium" style={{ color: '#8fa5b8' }}>Bugünkü Kazanç</span>
            <strong className="block text-lg mt-1" style={{ color: '#10b981' }}>${Number(earningsSummary.today || 0).toFixed(2)}</strong>
          </div>
          <div className="glass-card text-center">
            <span className="text-xs font-medium" style={{ color: '#8fa5b8' }}>Dünkü Kazanç</span>
            <strong className="block text-lg mt-1" style={{ color: '#FFD700' }}>${Number(earningsSummary.yesterday || 0).toFixed(2)}</strong>
          </div>
          <div className="glass-card text-center">
            <span className="text-xs font-medium" style={{ color: '#8fa5b8' }}>Toplam Gelir</span>
            <strong className="block text-lg text-white mt-1">${Number(earningsSummary.total || (profile as any)?.totalEarned || 0).toFixed(2)}</strong>
          </div>
          <div className="glass-card text-center">
            <span className="text-xs font-medium" style={{ color: '#8fa5b8' }}>Toplam Bakiye</span>
            <strong className="block text-lg text-white mt-1">${totalBalance.toFixed(2)}</strong>
          </div>
        </div>

        {currentVipLevel > 0 && (
          <div className="glass-card">
            <h2 className="text-base font-bold text-white mb-3">{t('quantifyExtra.projectionTitle')}</h2>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.12)' }}>
                <span className="text-xs block mb-1" style={{ color: '#8fa5b8' }}>{t('quantifyExtra.today')}</span>
                <span className="text-sm font-extrabold" style={{ color: '#FFD700' }}>${dailyEarning.toFixed(2)}</span>
              </div>
              <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(248,251,255,0.05)' }}>
                <span className="text-xs block mb-1" style={{ color: '#8fa5b8' }}>{t('quantifyExtra.sevenDays')}</span>
                <span className="text-sm font-extrabold text-white">${weekEarning.toFixed(2)}</span>
              </div>
              <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(248,251,255,0.05)' }}>
                <span className="text-xs block mb-1" style={{ color: '#8fa5b8' }}>{t('quantifyExtra.thirtyDays')}</span>
                <span className="text-sm font-extrabold text-white">${monthEarning.toFixed(2)}</span>
              </div>
            </div>
            <p className="text-xs mt-2" style={{ color: '#5a6a7a' }}>{t('quantifyExtra.projectionNote')}</p>
          </div>
        )}

        {nextVip && (
          <div className="glass-card" style={{ background: 'rgba(255,215,0,0.04)', border: '1px solid rgba(255,215,0,0.15)' }}>
            <h2 className="text-sm font-bold text-white mb-2">{t('quantifyExtra.nextVip')}: VIP {nextVip.nextLevel}</h2>
            <div className="space-y-2">
              <div className="flex justify-between"><span className="text-xs" style={{ color: '#8fa5b8' }}>{t('quantifyExtra.minInvestment')}</span><span className="text-xs font-bold" style={{ color: '#FFD700' }}>${nextVip.minInvestment.toLocaleString()}</span></div>
              {nextVip.refsRequired > 0 && <div className="flex justify-between"><span className="text-xs" style={{ color: '#8fa5b8' }}>{t('quantifyExtra.activeReferral')}</span><span className="text-xs font-bold" style={{ color: activeRefs >= nextVip.refsRequired ? '#10b981' : '#FFD700' }}>{activeRefs} / {nextVip.refsRequired}</span></div>}
              <div className="flex justify-between"><span className="text-xs" style={{ color: '#8fa5b8' }}>{t('quantifyExtra.dailyRate')}</span><span className="text-xs font-bold" style={{ color: '#FFD700' }}>{(() => { const vip = VIP_TABLE.find(v => v.level === nextVip.nextLevel); return vip ? `%${vip.rateMin.toFixed(2)} - %${vip.rateMax.toFixed(2)}` : '%0'; })()}</span></div>
            </div>
          </div>
        )}

        <div className="glass-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-white">{t('quantifyExtra.vipLevels')}</h2>
            <ChevronRight size={18} style={{ color: '#8fa5b8' }} />
          </div>
          <div className="grid gap-2.5">
            {VIP_TABLE.filter(v => v.level > 0).map((vip) => {
              const isCurrent = vip.level === currentVipLevel;
              return (
                <button
                  key={vip.level}
                  type="button"
                  onClick={() => setSelectedVipLevel(vip.level)}
                  className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all hover:bg-white/5"
                  style={{ background: isCurrent ? 'rgba(255,215,0,0.08)' : 'rgba(255,255,255,0.03)', border: isCurrent ? '1px solid rgba(255,215,0,0.2)' : '1px solid rgba(248,251,255,0.05)' }}
                >
                  <div className="grid place-items-center rounded-lg shrink-0 font-extrabold text-sm" style={{ width: '42px', height: '42px', color: isCurrent ? '#FFD700' : '#5a6a7a', background: isCurrent ? 'rgba(255,215,0,0.12)' : 'rgba(255,255,255,0.04)' }}>V{vip.level}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">VIP {vip.level}</span>
                      {isCurrent && <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,215,0,0.15)', color: '#FFD700' }}>{t('quantifyExtra.yourLevel')}</span>}
                    </div>
                    <span className="text-xs" style={{ color: '#8fa5b8' }}>${vip.min.toLocaleString()}+ {vip.refsRequired > 0 ? `| ${vip.refsRequired} Ref` : ''}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-sm font-extrabold" style={{ color: '#FFD700' }}>%{vip.rateMin.toFixed(2)} - %{vip.rateMax.toFixed(2)}</span>
                    <span className="text-xs block" style={{ color: '#5a6a7a' }}>{t('quantifyExtra.daily')}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {selectedVip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(5px)' }} onClick={() => setSelectedVipLevel(null)}>
          <div
            className="w-full max-w-sm animate-fade-in"
            style={{ background: 'rgba(5, 9, 20, 0.96)', border: '1px solid rgba(255,215,0,0.18)', borderRadius: '22px', padding: '22px', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <div className="status-badge mb-2"><Crown size={14} />VIP {selectedVip.level}</div>
                <h3 className="text-lg font-bold text-white">{t('quantifyExtra.vipDetailTitle', { level: selectedVip.level })}</h3>
                <p className="text-xs mt-1" style={{ color: '#8fa5b8' }}>{t('quantifyExtra.vipDetailSubtitle')}</p>
              </div>
              <button onClick={() => setSelectedVipLevel(null)} className="btn-secondary" style={{ minHeight: '32px', width: '32px', padding: 0 }}>
                <X size={14} />
              </button>
            </div>

            <div className="grid gap-2">
              {[
                { label: t('quantifyExtra.minInvestment'), value: `$${selectedVip.min.toLocaleString()}` },
                { label: t('quantifyExtra.activeReferral'), value: selectedVip.refsRequired > 0 ? `${selectedVip.refsRequired}` : t('quantifyExtra.noRequirement') },
                { label: t('quantifyExtra.dailyRate'), value: `%${selectedVip.rateMin.toFixed(2)} - %${selectedVip.rateMax.toFixed(2)}` },
                { label: t('quantifyExtra.maxBalance'), value: `$${selectedVip.balanceCap.toLocaleString()}` },
                { label: t('quantifyExtra.levelBonus'), value: selectedVip.bonus > 0 ? `$${selectedVip.bonus.toLocaleString()}` : t('quantifyExtra.noBonus') },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3 rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(248,251,255,0.06)' }}>
                  <span className="text-xs" style={{ color: '#8fa5b8' }}>{item.label}</span>
                  <span className="text-sm font-extrabold text-white text-right">{item.value}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-xl p-3" style={{ background: 'rgba(255,215,0,0.07)', border: '1px solid rgba(255,215,0,0.14)' }}>
              <p className="text-xs" style={{ color: '#FFD700' }}>{t('quantifyExtra.vipCapNote')}</p>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
