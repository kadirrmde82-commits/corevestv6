import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check, Users, DollarSign, Link2, UserPlus, QrCode, Download, Share2 } from 'lucide-react';
import * as QRCode from 'qrcode';
import Layout from '../components/Layout';
import { trpc } from '@/providers/trpc';
import { REFERRAL_COMMISSIONS } from '../store';

export default function Referral() {
  const { t } = useTranslation();
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const utils = trpc.useUtils();

  const { data: profile } = trpc.profile.me.useQuery(undefined, {
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
    retry: false,
  });
  const { data: overview, refetch: refetchOverview } = trpc.referral.overview.useQuery(undefined, {
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 15,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    retry: false,
  });

  useEffect(() => {
    refetchOverview();
    utils.referral.count.invalidate();
    utils.referral.myNetwork.invalidate();
    utils.referral.earningsSummary.invalidate();
  }, [refetchOverview, utils]);

  const myCode = profile?.referralCode || 'CV-----';
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const referralLink = `${baseUrl}/#/register?ref=${myCode}`;

  useEffect(() => {
    QRCode.toDataURL(referralLink, {
      width: 420,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#04070d',
        light: '#ffffff',
      },
    }).then(setQrDataUrl).catch(() => setQrDataUrl(''));
  }, [referralLink]);

  const network = overview?.network;
  const counts = overview?.counts;
  const earningsSummary = overview?.earningsSummary;
  const tier1 = network?.tier1 || [];
  const tier2 = network?.tier2 || [];
  const tier3 = network?.tier3 || [];

  const tier1Commission = earningsSummary?.tier1 ?? 0;
  const tier2Commission = earningsSummary?.tier2 ?? 0;
  const tier3Commission = earningsSummary?.tier3 ?? 0;
  const totalCommission = earningsSummary?.total ?? 0;
  const totalRefs = tier1.length + tier2.length + tier3.length;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(myCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `corevest-referral-${myCode}.png`;
    link.click();
  };

  const handleShareReferral = async () => {
    if (!navigator.share) {
      handleCopyLink();
      return;
    }
    await navigator.share({
      title: t('referral.yourLink'),
      text: t('referralExtra.shareText'),
      url: referralLink,
    });
  };

  const allReferrals = [
    ...tier1.map(r => ({ ...r, tier: 1 as const })),
    ...tier2.map(r => ({ ...r, tier: 2 as const })),
    ...tier3.map(r => ({ ...r, tier: 3 as const })),
  ];

  return (
    <Layout>
      <div className="grid gap-3">
        <div className="animate-fade-in">
          <h1 className="text-2xl font-bold text-white mb-1">{t('referral.title')}</h1>
          <p className="text-sm" style={{ color: '#8fa5b8' }}>{t('referral.subtitle')}</p>
        </div>

        <div className="glass-card" style={{ background: 'rgba(255,215,0,0.04)', border: '1px solid rgba(255,215,0,0.15)' }}>
          <div className="flex items-center gap-2 mb-3">
            <Link2 size={14} style={{ color: '#FFD700' }} />
            <span className="text-xs font-bold" style={{ color: '#FFD700' }}>{t('referral.yourCode')}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 text-center font-extrabold text-xl tracking-[0.15em]" style={{ background: 'rgba(255,215,0,0.08)', border: '1px dashed rgba(255,215,0,0.25)', borderRadius: '12px', padding: '12px', color: '#FFD700' }}>
              {myCode}
            </div>
            <button onClick={handleCopyCode} className="btn-secondary" style={{ minHeight: '50px', width: '50px', padding: 0 }}>
              {copiedCode ? <Check size={18} /> : <Copy size={18} />}
            </button>
          </div>
          {copiedCode && <p className="text-xs mt-2 text-center" style={{ color: '#10b981' }}>{t('referral.copied')}</p>}
        </div>

        <div className="glass-card">
          <span className="text-xs font-bold block mb-2" style={{ color: '#8fa5b8' }}>{t('referral.yourLink')}</span>
          <div className="flex items-center gap-2">
            <div className="flex-1 text-xs truncate rounded-xl px-3 py-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(248,251,255,0.1)', color: '#c8d6e5' }}>{referralLink}</div>
            <button onClick={handleCopyLink} className="btn-secondary" style={{ minHeight: '42px', width: '42px', padding: 0 }}>{copiedLink ? <Check size={16} /> : <Copy size={16} />}</button>
          </div>
          {copiedLink && <p className="text-xs mt-2 text-center" style={{ color: '#10b981' }}>{t('referral.copied')}</p>}
        </div>

        <div className="glass-card" style={{ background: 'rgba(255,215,0,0.04)', border: '1px solid rgba(255,215,0,0.15)' }}>
          <div className="flex items-center gap-2 mb-3">
            <QrCode size={15} style={{ color: '#FFD700' }} />
            <span className="text-xs font-bold" style={{ color: '#FFD700' }}>{t('referralExtra.qrInvite')}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-[180px_1fr] sm:items-center">
            <div className="mx-auto rounded-2xl p-3" style={{ background: '#fff', width: '180px', height: '180px' }}>
              {qrDataUrl ? (
                <img src={qrDataUrl} alt={t('referralExtra.qrAlt')} className="w-full h-full" />
              ) : (
                <div className="grid place-items-center w-full h-full text-xs" style={{ color: '#5a6a7a' }}>{t('referralExtra.qrPreparing')}</div>
              )}
            </div>
            <div>
              <p className="text-sm font-bold text-white mb-1">{t('referralExtra.qrTitle')}</p>
              <p className="text-xs mb-3" style={{ color: '#8fa5b8' }}>{t('referralExtra.qrDescription')}</p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={handleDownloadQr} className="btn-secondary" style={{ minHeight: '42px' }} disabled={!qrDataUrl}>
                  <Download size={15} /> {t('referralExtra.qrDownload')}
                </button>
                <button onClick={handleShareReferral} className="btn-primary" style={{ minHeight: '42px' }}>
                  <Share2 size={15} /> {t('referralExtra.share')}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="glass-card">
            <div className="flex items-center gap-2 mb-2"><div className="grid place-items-center rounded-xl" style={{ width: '38px', height: '38px', color: '#FFD700', background: 'rgba(255,215,0,0.1)' }}><Users size={18} /></div></div>
            <span className="text-xs font-medium" style={{ color: '#8fa5b8' }}>{t('referral.totalReferrals')}</span>
            <strong className="block text-xl text-white mt-1">{totalRefs}</strong>
            <div className="flex gap-2 mt-1">
              <span className="text-[10px]" style={{ color: '#FFD700' }}>{counts?.tier1 || 0} T1</span>
              <span className="text-[10px]" style={{ color: '#FFA500' }}>{counts?.tier2 || 0} T2</span>
              <span className="text-[10px]" style={{ color: '#FF8C00' }}>{counts?.tier3 || 0} T3</span>
            </div>
          </div>
          <div className="glass-card">
            <div className="flex items-center gap-2 mb-2"><div className="grid place-items-center rounded-xl" style={{ width: '38px', height: '38px', color: '#FFD700', background: 'rgba(255,215,0,0.1)' }}><DollarSign size={18} /></div></div>
            <span className="text-xs font-medium" style={{ color: '#8fa5b8' }}>{t('referral.totalCommission')}</span>
            <strong className="block text-xl mt-1" style={{ color: '#FFD700' }}>${totalCommission.toFixed(2)}</strong>
          </div>
        </div>

        <div className="glass-card">
          <h2 className="text-base font-bold text-white mb-4">{t('referral.howItWorks')}</h2>
          <div className="grid gap-3">
            {[
              { tier: 1, label: t('referral.tier1'), rate: `%${REFERRAL_COMMISSIONS.tier1}`, count: tier1.length, commission: tier1Commission, color: '#FFD700', bg: 'rgba(255,215,0,0.08)', border: 'rgba(255,215,0,0.15)', desc: t('referralExtra.directRefs') },
              { tier: 2, label: t('referral.tier2'), rate: `%${REFERRAL_COMMISSIONS.tier2}`, count: tier2.length, commission: tier2Commission, color: '#FFA500', bg: 'rgba(255,165,0,0.08)', border: 'rgba(255,165,0,0.15)', desc: t('referralExtra.tier2Refs') },
              { tier: 3, label: t('referral.tier3'), rate: `%${REFERRAL_COMMISSIONS.tier3}`, count: tier3.length, commission: tier3Commission, color: '#FF8C00', bg: 'rgba(255,140,0,0.08)', border: 'rgba(255,140,0,0.15)', desc: t('referralExtra.tier3Refs') },
            ].map((tItem) => (
              <div key={tItem.tier} className="rounded-xl px-4 py-3" style={{ background: tItem.bg, border: `1px solid ${tItem.border}` }}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="grid place-items-center rounded-full font-extrabold text-sm shrink-0" style={{ width: '42px', height: '42px', background: `${tItem.color}20`, color: tItem.color }}>{tItem.tier}</div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-bold text-white block">{tItem.label}</span>
                    <span className="text-xs" style={{ color: tItem.color }}>{tItem.rate} - {tItem.count} {t('referralExtra.people')}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-sm font-extrabold" style={{ color: tItem.color }}>${tItem.commission.toFixed(2)}</span>
                  </div>
                </div>
                <p className="text-xs" style={{ color: '#5a6a7a' }}>{tItem.desc}</p>
                {tItem.count > 0 && (
                  <div className="mt-2 space-y-1">
                    {(tItem.tier === 1 ? tier1 : tItem.tier === 2 ? tier2 : tier3).slice(0, 3).map(p => (
                      <div key={p.id} className="flex items-center gap-2 text-xs" style={{ color: '#8fa5b8' }}>
                        <UserPlus size={10} style={{ color: tItem.color }} />
                        <span>{p.name || t('referralExtra.user')}</span>
                        <span className="text-[10px]" style={{ color: '#5a6a7a' }}>{p.email}</span>
                      </div>
                    ))}
                    {tItem.count > 3 && <span className="text-[10px]" style={{ color: '#5a6a7a' }}>+{tItem.count - 3}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-white">{t('referralExtra.myNetwork')}</h2>
            <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: 'rgba(255,215,0,0.1)', color: '#FFD700' }}>{totalRefs} {t('referralExtra.people')}</span>
          </div>

          {allReferrals.length === 0 ? (
            <div className="text-center py-6">
              <Users size={32} style={{ color: '#3a4a5a', margin: '0 auto' }} />
              <p className="text-sm mt-3" style={{ color: '#5a6a7a' }}>{t('referral.noReferrals')}</p>
              <p className="text-xs mt-1" style={{ color: '#5a6a7a' }}>{t('referralExtra.startSharing')}</p>
            </div>
          ) : (
            <div className="grid gap-2">
              {allReferrals.map((person) => {
                const tierColors = ['', '#FFD700', '#FFA500', '#FF8C00'];
                const tierLabels = ['', t('referral.tier1'), t('referral.tier2'), t('referral.tier3')];
                return (
                  <div key={`${person.id}-${person.tier}`} className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(248,251,255,0.05)' }}>
                    <div className="grid place-items-center rounded-full shrink-0" style={{ width: '38px', height: '38px', background: `${tierColors[person.tier]}18`, color: tierColors[person.tier] }}><UserPlus size={16} /></div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-bold text-white block">{person.name || t('referralExtra.user')}</span>
                      <span className="text-xs" style={{ color: '#8fa5b8' }}>{person.date}</span>
                    </div>
                    <div className="text-[10px] font-extrabold px-2 py-1 rounded-full shrink-0" style={{ background: `${tierColors[person.tier]}15`, color: tierColors[person.tier] }}>{tierLabels[person.tier]}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
