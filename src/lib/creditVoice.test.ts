import { describe, expect, it } from "vitest";
import {
  defaultCollateralForLoan,
  looksLikeCreditUtterance,
  parseCreditUtterance,
} from "./creditVoice";

describe("creditVoice", () => {
  it("defaults collateral to 150%", () => {
    expect(defaultCollateralForLoan(1000)).toBe(1500);
    expect(defaultCollateralForLoan(1001)).toBe(1502);
  });

  it("parses borrow phrases", () => {
    expect(parseCreditUtterance("borrow 1000")).toMatchObject({
      kind: "borrow",
      loanAmount: 1000,
    });
    expect(parseCreditUtterance("take a loan of 2500")).toMatchObject({
      kind: "borrow",
      loanAmount: 2500,
    });
    expect(parseCreditUtterance("I want a loan of one thousand")).toMatchObject({
      kind: "borrow",
      loanAmount: 1000,
    });
    expect(parseCreditUtterance("1000 ka loan")).toMatchObject({
      kind: "borrow",
      loanAmount: 1000,
    });
    expect(
      parseCreditUtterance("borrow 1000 with 2000 collateral")
    ).toMatchObject({
      kind: "borrow",
      loanAmount: 1000,
      collateralAmount: 2000,
    });
  });

  it("parses repay phrases", () => {
    expect(parseCreditUtterance("repay my loan")?.kind).toBe("repay");
    expect(parseCreditUtterance("pay installment")?.kind).toBe("repay");
    expect(parseCreditUtterance("pay back my loan")?.kind).toBe("repay");
  });

  it("parses standing phrases", () => {
    expect(parseCreditUtterance("check my credit")?.kind).toBe("standing");
    expect(parseCreditUtterance("credit standing")?.kind).toBe("standing");
  });

  it("does not steal normal payments", () => {
    expect(looksLikeCreditUtterance("pay 25 to Nike")).toBe(false);
    expect(parseCreditUtterance("pay 25 to Nike")).toBeNull();
    expect(parseCreditUtterance("send 100 to Deepa")).toBeNull();
  });
});
