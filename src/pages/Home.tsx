import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TrendingUp, TrendingDown, MousePointerClick,
  DollarSign, Wallet, Crown, ChevronRight, X, Gift
} from 'lucide-react';
import Layout from '../components/Layout';
import { trpc } from '@/providers/trpc';
import { VIP_TABLE } from '../store';
import Wheel from '../components/Wheel';
import { ANNOUNCEMENT_CONTENT_KEYS, mergeSiteContent } from '@contracts/site-content';

const BENEFIT_DOMAINS = ['gmail.com', 'hotmail.com', 'yahoo.com'];
const BENEFIT_PREFIXES = ['yt', 'kr', 'mx', 'al', 'cv', 'mn', 'rx', 'tr', 'dk', 'sn', 'pr', 'ay'];

function createBenefitItem(index = Date.now()) {
  const prefix = BENEFIT_PREFIXES[Math.floor(Math.random() * BENEFIT_PREFIXES.length)];
  const domain = BENEFIT_DOMAINS[Math.floor(Math.random() * BENEFIT_DOMAINS.length)];
  const stars = '*'.repeat(Math.floor(Math.random() * 3) + 5);
  const amount = Math.floor(Math.random() * (2500 - 100 + 1)) + 100;
  return {
    id: `${index}-${Math.random().toString(36).slice(2, 8)}`,
    email: `${prefix}${stars}@${domain}`,
    amount,
  };
}

export default function Home() {
  const { t } = useTranslation();
  const [showAnnouncement, setShowAnnouncement] = useState(true);
  const [benefitItems, setBenefitItems] = useState(() => Array.from({ length: 8 }, (_, index) => createBenefitItem(index)));

  // Fetch market prices from API
  const { data: marketCoins = [] } = trpc.marketPrice.list.useQuery(undefined, {
    staleTime: 1000 * 60,
    refetchInterval: 1000 * 30,
  });
  const hasLiveMarketData = marketCoins.some((coin: { live?: boolean }) => coin.live);
  const hasSavedMarketData = marketCoins.some((coin: { source?: string }) => coin.source === 'cached');
  const { data: siteContentData } = trpc.siteContent.public.useQuery(undefined, {
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 30,
    retry: false,
  });
  const siteContent = mergeSiteContent(siteContentData);
  const announcementRules = siteContent[ANNOUNCEMENT_CONTENT_KEYS.rules]
    .split('\n')
    .map((rule) => rule.trim())
    .filter(Boolean);
  const announcementEnabled = siteContent[ANNOUNCEMENT_CONTENT_KEYS.enabled] !== 'false';
  const announcementVersion = siteContent[ANNOUNCEMENT_CONTENT_KEYS.version] || 'v1';
  const announcementSeenKey = `corevest_announcement_seen_${announcementVersion}`;
  const announcementImageUrl = siteContent[ANNOUNCEMENT_CONTENT_KEYS.imageUrl]?.trim();

  useEffect(() => {
    setShowAnnouncement(localStorage.getItem(announcementSeenKey) !== 'true');
  }, [announcementSeenKey]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setBenefitItems((items) => [createBenefitItem(), ...items].slice(0, 8));
    }, 1800);
    return () => window.clearInterval(interval);
  }, []);

  const dismissAnnouncement = () => {
    setShowAnnouncement(false);
    localStorage.setItem(announcementSeenKey, 'true');
  };

  // Fetch profile from tRPC
  const { data: profile } = trpc.profile.me.useQuery(undefined, {
    staleTime: 1000 * 10,
    refetchInterval: 1000 * 10,
    retry: false,
  });

  // Auto-create referral relationship if ref code exists in localStorage
  const { mutate: createReferral } = trpc.referral.create.useMutation();
  useEffect(() => {
    const refCode = localStorage.getItem('corevest_ref_by');
    if (profile && refCode && !profile.referredBy) {
      createReferral(
        { referralCode: refCode },
        {
          onSuccess: () => {
            localStorage.removeItem('corevest_ref_by');
          },
          onError: () => {
            localStorage.removeItem('corevest_ref_by');
          },
        }
      );
    }
  }, [profile, createReferral]);

  // Calculate VIP level from investment
  const currentVip = useMemo(() => {
    if (!profile) return 0;
    return Number(profile.vipLevel || 0);
  }, [profile]);

  const nextVip = useMemo(() => {
    return VIP_TABLE.find(v => v.level === currentVip + 1);
  }, [currentVip]);

  if (!profile) return null;

  return (
    <Layout>
      {/* Announcement Popup */}
      {announcementEnabled && showAnnouncement && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 animate-fade-in"
          style={{
            background: 'rgba(0,0,0,0.68)',
            backdropFilter: 'blur(7px)',
          }}
        >
          <div
            className="relative w-full overflow-hidden"
            style={{
              maxWidth: '560px',
              maxHeight: '92vh',
              overflowY: 'auto',
              border: '1px solid rgba(255,215,0,0.25)',
              borderRadius: '24px',
              padding: '16px',
              background: 'radial-gradient(circle at 30% 20%, rgba(255,215,0,0.14), transparent 50%), radial-gradient(circle at 80% 80%, rgba(255,165,0,0.10), transparent 40%), linear-gradient(135deg, rgba(5,9,20,0.98), rgba(15,10,5,0.98))',
              boxShadow: '0 24px 70px rgba(0,0,0,0.55)',
            }}
          >
            <button
              onClick={dismissAnnouncement}
              className="absolute top-3 right-3 z-10 grid place-items-center rounded-full transition-all hover:scale-110"
              style={{
                width: '38px',
                height: '38px',
                background: 'rgba(0,0,0,0.55)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.15)',
              }}
              aria-label="Duyuruyu kapat"
            >
              <X size={20} />
            </button>

            {announcementImageUrl && (
              <div
                className="mb-4 overflow-hidden"
                style={{
                  width: '100%',
                  aspectRatio: '1 / 1',
                  borderRadius: '18px',
                  border: '1px solid rgba(255,215,0,0.16)',
                  background: 'rgba(255,255,255,0.04)',
                }}
              >
                <img
                  src={announcementImageUrl}
                  alt="Duyuru görseli"
                  className="w-full h-full object-cover"
                  loading="eager"
                />
              </div>
            )}

            <div>
              <h3
                className="text-lg sm:text-xl font-extrabold mb-3 pr-8"
                style={{ color: '#FFD700' }}
              >
                <Gift size={20} className="inline mr-1" />
                {siteContent[ANNOUNCEMENT_CONTENT_KEYS.title]}
              </h3>

              <p className="text-sm sm:text-base font-bold text-white mb-2">
                {siteContent[ANNOUNCEMENT_CONTENT_KEYS.subtitle]}
              </p>

              <p className="text-sm mb-3" style={{ color: '#a9bccf' }}>
                {siteContent[ANNOUNCEMENT_CONTENT_KEYS.body]}
              </p>

              {announcementRules.length > 0 && (
                <div
                  className="rounded-xl p-3 mb-3"
                  style={{
                    background: 'rgba(255,215,0,0.06)',
                    border: '1px solid rgba(255,215,0,0.12)',
                  }}
                >
                  <p className="text-xs font-bold mb-2" style={{ color: '#FFD700' }}>
                    🎁 Kampanya Kuralları:
                  </p>
                  <ul className="space-y-1">
                    {announcementRules.map((rule, i) => (
                      <li key={i} className="text-xs sm:text-sm flex items-start gap-2" style={{ color: '#c8d6e5' }}>
                        <span style={{ color: '#10b981' }}>✅</span>
                        <span>{rule}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-xs sm:text-sm mb-3" style={{ color: '#8fa5b8' }}>
                {siteContent[ANNOUNCEMENT_CONTENT_KEYS.note]}
              </p>

              <p className="text-xs sm:text-sm font-bold mb-4" style={{ color: '#FFD700' }}>
                {siteContent[ANNOUNCEMENT_CONTENT_KEYS.footer]}
              </p>

              <button
                onClick={dismissAnnouncement}
                className="btn-primary w-full"
                style={{ minHeight: '46px', fontSize: '14px' }}
              >
                {siteContent[ANNOUNCEMENT_CONTENT_KEYS.button]}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-3">
        {/* Welcome Banner */}
        <div
          className="relative overflow-hidden animate-fade-in"
          style={{
            border: '1px solid rgba(248,251,255,0.11)',
            borderRadius: '18px',
            padding: '22px',
            background: 'radial-gradient(circle at 76% 22%, rgba(255,215,0,0.15), transparent 26%), radial-gradient(circle at 92% 84%, rgba(255,165,0,0.1), transparent 28%), linear-gradient(135deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02))',
            boxShadow: '0 22px 60px rgba(0,0,0,0.32)',
          }}
        >
          <div className="relative z-10">
            <div className="status-badge mb-3">
              <Crown size={14} />
              {currentVip === 0 ? 'VIP 0' : `VIP ${currentVip}`} - {t('home.vipStatus')}
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">{t('home.welcome')}</h1>
            <p className="text-sm max-w-md" style={{ color: '#a9bccf' }}>
              {currentVip === 0 ? t('home.upgradeVip') : t('home.welcomeText')}
            </p>
            {nextVip && (
              <div className="mt-3 flex items-center gap-2 text-xs" style={{ color: '#8fa5b8' }}>
                <ChevronRight size={14} style={{ color: '#FFD700' }} />
                {t('home.nextVip')}: ${nextVip.min} ({t(`vipLevels.vip${nextVip.level}`)})
              </div>
            )}
          </div>
          <div className="absolute right-[-20px] bottom-[-40px] rounded-full" style={{ width: '130px', height: '130px', border: '1px solid rgba(255,215,0,0.15)', transform: 'rotate(-18deg)' }}>
            <span className="absolute rounded-full" style={{ top: '22px', left: '34px', width: '8px', height: '8px', background: '#FFD700', boxShadow: '0 0 14px rgba(255,215,0,0.7)' }} />
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="glass-card">
            <div className="flex items-center gap-2 mb-2">
              <div className="grid place-items-center rounded-xl" style={{ width: '38px', height: '38px', color: '#FFD700', background: 'rgba(255,215,0,0.1)' }}>
                <MousePointerClick size={18} />
              </div>
            </div>
            <span className="text-xs font-medium" style={{ color: '#8fa5b8' }}>{t('home.totalClicks')}</span>
            <strong className="block text-xl text-white mt-1">{profile.totalClicks}</strong>
          </div>
          <div className="glass-card">
            <div className="flex items-center gap-2 mb-2">
              <div className="grid place-items-center rounded-xl" style={{ width: '38px', height: '38px', color: '#FFD700', background: 'rgba(255,215,0,0.1)' }}>
                <DollarSign size={18} />
              </div>
            </div>
            <span className="text-xs font-medium" style={{ color: '#8fa5b8' }}>{t('home.totalEarnings')}</span>
            <strong className="block text-xl mt-1" style={{ color: '#FFD700' }}>${Number(profile.totalEarned).toFixed(2)}</strong>
          </div>
          <div className="glass-card">
            <div className="flex items-center gap-2 mb-2">
              <div className="grid place-items-center rounded-xl" style={{ width: '38px', height: '38px', color: '#FFD700', background: 'rgba(255,215,0,0.1)' }}>
                <Wallet size={18} />
              </div>
            </div>
            <span className="text-xs font-medium" style={{ color: '#8fa5b8' }}>{t('home.currentInvestment')}</span>
            <strong className="block text-xl text-white mt-1">${Number(profile.investment).toLocaleString()}</strong>
          </div>
          <div className="glass-card">
            <div className="flex items-center gap-2 mb-2">
              <div className="grid place-items-center rounded-xl" style={{ width: '38px', height: '38px', color: '#FFD700', background: 'rgba(255,215,0,0.1)' }}>
                <Crown size={18} />
              </div>
            </div>
            <span className="text-xs font-medium" style={{ color: '#8fa5b8' }}>{t('home.currentLevel')}</span>
            <strong className="block text-xl mt-1" style={{ color: '#FFD700' }}>{`VIP ${currentVip}`}</strong>
          </div>
        </div>

        {/* Wheel of Fortune */}
        <Wheel />

        {/* Benefit List */}
        <div className="glass-card overflow-hidden" style={{ border: '1px solid rgba(16,185,129,0.18)', background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(255,255,255,0.03))' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-extrabold text-white">FAYDA LİSTESİ</h2>
              <p className="text-xs" style={{ color: '#8fa5b8' }}>Son yatırım bildirimleri</p>
            </div>
            <div className="status-badge text-[10px]">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              CANLI
            </div>
          </div>
          <div className="grid gap-2" style={{ maxHeight: '250px', overflow: 'hidden' }}>
            {benefitItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 animate-fade-in"
                style={{
                  background: 'rgba(255,255,255,0.035)',
                  border: '1px solid rgba(248,251,255,0.06)',
                }}
              >
                <span className="text-sm font-bold truncate" style={{ color: '#c8d6e5' }}>{item.email}</span>
                <span className="text-sm font-extrabold shrink-0" style={{ color: '#10b981' }}>+${item.amount}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Market Prices */}
        <div className="glass-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-white">{t('home.marketPrices')}</h2>
              <p className="text-xs" style={{ color: '#8fa5b8' }}>{t('home.marketSubtitle')}</p>
            </div>
            <div className="status-badge text-[10px]">
              <span className={`w-2 h-2 rounded-full ${hasLiveMarketData ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`} />
              {hasLiveMarketData ? 'CANLI' : hasSavedMarketData ? 'SON VERİ' : 'YÜKLENİYOR'}
            </div>
          </div>
          <div className="grid gap-2">
            {marketCoins.length === 0 && (
              <p className="text-xs text-center py-4" style={{ color: '#5a6a7a' }}>Piyasa verisi yukleniyor...</p>
            )}
            {marketCoins.map((coin: { id: number; symbol: string; name: string; basePrice: string | number; change: string | number; color: string; live?: boolean; source?: string }) => {
              const isUp = Number(coin.change) >= 0;
              const livePrice = Number(coin.basePrice);
              return (
                <div key={coin.symbol} className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(248,251,255,0.05)' }}>
                  <div className="grid place-items-center rounded-lg font-extrabold text-xs shrink-0" style={{ width: '40px', height: '40px', background: `${coin.color}18`, color: coin.color }}>{coin.symbol.slice(0, 2)}</div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-bold text-white block">{coin.name}</span>
                    <span className="text-xs" style={{ color: '#8fa5b8' }}>{coin.symbol}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-sm font-bold text-white block">${livePrice < 1 ? livePrice.toFixed(4) : livePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <span className="text-xs font-semibold flex items-center justify-end gap-1" style={{ color: isUp ? '#10b981' : '#ef4444' }}>{isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{isUp ? '+' : ''}{Number(coin.change).toFixed(2)}%</span>
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
