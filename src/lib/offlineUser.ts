import type { PublicUser } from "./api";
import type { DeviceVaultState } from "./deviceVault";

/** Minimal PublicUser from local vault when the API is unreachable. */
export function publicUserFromVault(vault: DeviceVaultState): PublicUser {
  return {
    id: vault.userId,
    displayName: vault.displayName || "You",
    deviceId: "device-local",
    pubkey: vault.keypair.pubkey,
    credentialCommitment: vault.credentialCommitment,
    balanceCommitment: vault.balanceCommitment,
    policyCommitment: vault.policy.commitment,
    policyActive: vault.policy.active ?? [],
    policyParams: null,
    contacts: (vault.contacts ?? []).map((c) => ({
      label: c.label,
      displayContext: c.displayContext,
      addressCommitment: c.address,
      hasEnrollmentSig: Boolean(c.enrollmentSig),
    })),
    createdAt: Date.now(),
    class0DeviceOnly: true,
  };
}
