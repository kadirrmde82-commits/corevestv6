import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Gift, RotateCcw } from 'lucide-react';
import { trpc } from '@/providers/trpc';

const WHEEL_PRIZES = [
  { label: '$10', value: 10, color: '#10b981' },
  { label: '$25', value: 25, color: '#FFD700' },
  { label: '$50', value: 50, color: '#f97316' },
  { label: '$100', value: 100, color: '#ef4444' },
  { label: '$250', value: 250, color: '#8b5cf6' },
  { label: '$500', value: 500, color: '#3b82f6' },
  { label: '$750', value: 750, color: '#ec4899' },
  { label: '$1K', value: 1000, color: '#FFD700' },
];

const SEGMENT_ANGLE = 360 / WHEEL_PRIZES.length;
const BASE_LANDING_ANGLE = 247.5;

export default function Wheel() {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const [rotation, setRotation] = useState(BASE_LANDING_ANGLE);
  const [isSpinning, setIsSpinning] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [resultAmount, setResultAmount] = useState(10);
  const spinStartedAtRef = useRef(0);

  const { data: status } = trpc.wheel.status.useQuery(undefined, {
    staleTime: 5000,
    refetchInterval: 10000,
    retry: false,
  });

  const spinMutation = trpc.wheel.spin.useMutation({
    onSuccess: (result) => {
      setResultAmount(Number(result.actualPrize || 10));
      utils.wheel.status.setData(undefined, (old) => old ? {
        ...old,
        availableSpins: result.remainingSpins,
        totalSpins: Number(old.totalSpins || 0) + 1,
      } : old);
      utils.profile.me.setData(undefined, (old) => old ? {
        ...old,
        balance: String(result.newBalance),
        totalEarned: String(result.newTotalEarned ?? (Number(old.totalEarned) + Number(result.actualPrize || 0))),
      } : old);
      utils.wheel.status.invalidate();
      utils.wheel.list.invalidate();
      utils.profile.me.invalidate();

      const elapsed = Date.now() - spinStartedAtRef.current;
      const delay = Math.max(0, 4200 - elapsed);
      setTimeout(() => {
        setShowResult(true);
        setIsSpinning(false);
      }, delay);
    },
    onError: (error) => {
      setIsSpinning(false);
      alert(error.message || 'Çark çevrilemedi. Lütfen tekrar deneyin.');
    },
  });

  const handleSpin = useCallback(() => {
    if (isSpinning || !status || status.availableSpins <= 0) return;

    setShowResult(false);
    setIsSpinning(true);
    spinStartedAtRef.current = Date.now();

    const fullSpins = 5 * 360;
    const targetRotation = rotation + fullSpins;
    setRotation(targetRotation);

    spinMutation.mutate();
  }, [isSpinning, status, rotation, spinMutation]);

  const availableSpins = status?.availableSpins || 0;
  const hasSpins = availableSpins > 0;

  return (
    <div className="glass-card text-center">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Gift size={18} style={{ color: '#FFD700' }} />
            {t('wheel.title')}
          </h2>
          <p className="text-xs mt-1" style={{ color: '#8fa5b8' }}>
            {t('wheel.investmentRule')}
          </p>
        </div>
        <div
          className="text-xs font-extrabold px-3 py-1.5 rounded-full"
          style={{
            background: hasSpins ? 'rgba(255,215,0,0.12)' : 'rgba(90,106,122,0.15)',
            color: hasSpins ? '#FFD700' : '#5a6a7a',
            border: hasSpins ? '1px solid rgba(255,215,0,0.2)' : '1px solid rgba(90,106,122,0.2)',
          }}
        >
          {availableSpins} {t('wheel.rights')}
        </div>
      </div>

      <div className="relative mx-auto mb-4" style={{ width: '260px', height: '260px' }}>
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 z-10"
          style={{
            width: 0,
            height: 0,
            borderLeft: '12px solid transparent',
            borderRight: '12px solid transparent',
            borderTop: '20px solid #FFD700',
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))',
            marginTop: '-4px',
          }}
        />

        <div
          className="relative w-full h-full rounded-full overflow-hidden"
          style={{
            border: '3px solid rgba(255,215,0,0.3)',
            boxShadow: '0 0 30px rgba(255,215,0,0.15), inset 0 0 30px rgba(0,0,0,0.3)',
            transition: isSpinning ? 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
            transform: `rotate(${rotation}deg)`,
          }}
        >
          <div
            className="absolute inset-0 m-auto rounded-full z-10 grid place-items-center"
            style={{
              width: '50px',
              height: '50px',
              background: 'linear-gradient(135deg, #FFD700, #FFA500)',
              boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
            }}
          >
            <span className="text-lg font-extrabold" style={{ color: '#04070d' }}>$</span>
          </div>

          <svg viewBox="0 0 260 260" className="absolute inset-0 w-full h-full">
            {WHEEL_PRIZES.map((prize, i) => {
              const startAngle = (i * SEGMENT_ANGLE * Math.PI) / 180;
              const endAngle = ((i + 1) * SEGMENT_ANGLE * Math.PI) / 180;
              const cx = 130;
              const cy = 130;
              const r = 125;
              const x1 = cx + r * Math.cos(startAngle);
              const y1 = cy + r * Math.sin(startAngle);
              const x2 = cx + r * Math.cos(endAngle);
              const y2 = cy + r * Math.sin(endAngle);
              const midAngle = startAngle + SEGMENT_ANGLE * (Math.PI / 360);
              const tx = cx + (r * 0.65) * Math.cos(midAngle);
              const ty = cy + (r * 0.65) * Math.sin(midAngle);

              return (
                <g key={i}>
                  <path
                    d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`}
                    fill={prize.color}
                    opacity={0.85}
                    stroke="rgba(0,0,0,0.2)"
                    strokeWidth={1}
                  />
                  <text
                    x={tx}
                    y={ty}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#fff"
                    fontSize="13"
                    fontWeight="800"
                    transform={`rotate(${i * SEGMENT_ANGLE + SEGMENT_ANGLE / 2}, ${tx}, ${ty})`}
                  >
                    {prize.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      <button
        onClick={handleSpin}
        disabled={!hasSpins || isSpinning}
        className="btn-primary w-full"
        style={{
          opacity: hasSpins && !isSpinning ? 1 : 0.4,
          minHeight: '48px',
          fontSize: '1rem',
        }}
      >
        {isSpinning ? (
          <>
            <RotateCcw size={18} className="animate-spin" />
            {t('wheel.spinning')}
          </>
        ) : hasSpins ? (
          <>
            <Gift size={18} />
            {t('wheel.spin')} ({availableSpins})
          </>
        ) : (
          <>
            <Gift size={18} />
            {t('wheel.noRights')}
          </>
        )}
      </button>

      {status && (
        <div className="mt-2 space-y-1">
          <p className="text-xs" style={{ color: '#5a6a7a' }}>
            {t('wheel.investmentRule')}
            {status.referralBonusSpins ? (
              <> | <span style={{ color: '#FFD700' }}>+{status.referralBonusSpins} {t('wheel.referralBonus')}</span></>
            ) : null}
          </p>
        </div>
      )}

      {showResult && (
        <div
          className="mt-4 p-4 rounded-xl animate-fade-in"
          style={{
            background: 'rgba(255,215,0,0.08)',
            border: '1px solid rgba(255,215,0,0.25)',
          }}
        >
          <p className="text-sm font-bold text-white mb-1">{t('wheel.congrats')}</p>
          <p className="text-xs" style={{ color: '#8fa5b8' }}>{t('wheel.won')}</p>
          <p className="text-xl font-extrabold mt-2" style={{ color: '#FFD700' }}>
            ${resultAmount.toFixed(2)} {t('wheel.added')}
          </p>
        </div>
      )}
    </div>
  );
}
