import { describe, expect, it } from "vitest";
import {
  MEMBER_PROMOTION_BONUS,
  PROMOTION_MINIMUM_DEPOSIT,
  REFERRER_PROMOTION_BONUS,
  qualifiesForDepositPromotion,
} from "./deposit-promotion";

describe("deposit promotion", () => {
  it("does not include deposits created before the campaign", () => {
    expect(qualifiesForDepositPromotion({ amount: 1000, promotionEligible: 0, promotionApplied: 0 })).toBe(false);
  });

  it("requires a deposit of at least 100 dollars", () => {
    expect(qualifiesForDepositPromotion({ amount: 99.99, promotionEligible: 1, promotionApplied: 0 })).toBe(false);
    expect(qualifiesForDepositPromotion({ amount: PROMOTION_MINIMUM_DEPOSIT, promotionEligible: 1, promotionApplied: 0 })).toBe(true);
  });

  it("allows each new qualifying deposit once", () => {
    expect(qualifiesForDepositPromotion({ amount: 250, promotionEligible: 1, promotionApplied: 0 })).toBe(true);
    expect(qualifiesForDepositPromotion({ amount: 250, promotionEligible: 1, promotionApplied: 1 })).toBe(false);
  });

  it("uses fixed bonuses per qualifying request", () => {
    expect(MEMBER_PROMOTION_BONUS).toBe(5);
    expect(REFERRER_PROMOTION_BONUS).toBe(10);
  });
});
