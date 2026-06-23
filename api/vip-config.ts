export const VIP_TABLE = [
  { level: 0, min: 0, max: 49, rate: 0, rateMin: 0, rateMax: 0, refsRequired: 0, balanceCap: 0, bonus: 0 },
  { level: 1, min: 50, max: 499, rate: 2.3, rateMin: 2.0, rateMax: 2.6, refsRequired: 0, balanceCap: 3_000, bonus: 0 },
  { level: 2, min: 500, max: 1_999, rate: 2.95, rateMin: 2.6, rateMax: 3.3, refsRequired: 5, balanceCap: 10_000, bonus: 30 },
  { level: 3, min: 2_000, max: 5_999, rate: 3.55, rateMin: 3.3, rateMax: 3.8, refsRequired: 10, balanceCap: 20_000, bonus: 60 },
  { level: 4, min: 6_000, max: 19_999, rate: 4.05, rateMin: 3.8, rateMax: 4.3, refsRequired: 16, balanceCap: 100_000, bonus: 120 },
  { level: 5, min: 20_000, max: 49_999, rate: 4.55, rateMin: 4.3, rateMax: 4.8, refsRequired: 25, balanceCap: 500_000, bonus: 240 },
  { level: 6, min: 50_000, max: Infinity, rate: 5.4, rateMin: 4.8, rateMax: 6.0, refsRequired: 40, balanceCap: 1_000_000, bonus: 500 },
];

export function getVipLevel(investment: number, activeRefs: number): number {
  for (let i = VIP_TABLE.length - 1; i >= 0; i--) {
    const vip = VIP_TABLE[i];
    if (investment >= vip.min && activeRefs >= vip.refsRequired) {
      return vip.level;
    }
  }
  return 0;
}

export function getVipInfo(level: number) {
  return VIP_TABLE.find((vip) => vip.level === level) || VIP_TABLE[0];
}

export function getRandomDailyRate(level: number): number {
  const vip = getVipInfo(level);
  if (vip.rateMax <= 0) return 0;
  const rate = vip.rateMin + Math.random() * (vip.rateMax - vip.rateMin);
  return Number(rate.toFixed(2));
}

export function capAmount(currentBalance: number, amountToAdd: number, vipLevel: number): number {
  const cap = getVipInfo(vipLevel).balanceCap;
  if (cap <= 0) return 0;
  const remaining = Math.max(0, cap - currentBalance);
  return Number(Math.min(amountToAdd, remaining).toFixed(2));
}
