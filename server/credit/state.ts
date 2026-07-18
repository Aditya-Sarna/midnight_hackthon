import { openingToHex, randomOpening } from "../services/compactCommit.js";
import { randomNonce, sha256 } from "../services/crypto.js";
import type { Store } from "../services/store.js";
import { defaultCreditConfig, type CreditState } from "./types.js";

export function creditState(store: Store): CreditState {
  if (!store.circledCredit) {
    const poolNonce = randomNonce(16);
    const poolOpening = openingToHex(randomOpening());
    store.circledCredit = {
      poolCommitment: sha256(`pool:0:0:${poolNonce}`),
      poolTotal: 0,
      poolOutstanding: 0,
      poolNonce,
      poolOpening,
      shares: [],
      loans: [],
      standing: {},
      spentInstallmentNullifiers: [],
      config: defaultCreditConfig(),
    };
  }
  if (!store.circledCredit.config) {
    store.circledCredit.config = defaultCreditConfig();
  }
  return store.circledCredit;
}
