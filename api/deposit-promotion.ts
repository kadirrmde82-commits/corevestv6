export const MEMBER_PROMOTION_BONUS = 5;
export const REFERRER_PROMOTION_BONUS = 10;
export const PROMOTION_MINIMUM_DEPOSIT = 100;

export function qualifiesForDepositPromotion(input: {
  amount: number;
  promotionEligible: number;
  promotionApplied: number;
}) {
  return Boolean(input.promotionEligible)
    && !input.promotionApplied
    && input.amount >= PROMOTION_MINIMUM_DEPOSIT;
}
