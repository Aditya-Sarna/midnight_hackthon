/**
 * Recovery posture for Settings / gate — no secrets, device-local only.
 */
import { hasWebauthnCredential, webauthnAvailable } from "./webauthnVault";
import { recoveryBackupStatus } from "./recoveryEnroll";

export type RecoveryHealth = {
  passkeyEnrolled: boolean;
  passkeyAvailable: boolean;
  cloudBackup: boolean;
  kitHint: string;
  score: "strong" | "ok" | "weak";
};

export async function getRecoveryHealth(userId: string): Promise<RecoveryHealth> {
  const passkeyEnrolled = hasWebauthnCredential();
  const passkeyAvailable = webauthnAvailable();
  const cloud = await recoveryBackupStatus(userId);
  const cloudBackup = Boolean(cloud?.enrolled);
  let score: RecoveryHealth["score"] = "weak";
  if (passkeyEnrolled && cloudBackup) score = "strong";
  else if (passkeyEnrolled || cloudBackup) score = "ok";
  return {
    passkeyEnrolled,
    passkeyAvailable,
    cloudBackup,
    kitHint: "Download recovery kit during onboarding — passphrase never leaves the device",
    score,
  };
}
