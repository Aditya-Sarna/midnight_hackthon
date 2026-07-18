import { describe, expect, it } from "vitest";
import {
  bindDeviceKeysToUser,
  keyRefForPubkey,
  putDeviceKeys,
  resolveDeviceKeys,
  signWithDeviceKey,
} from "./keyStore";

async function fakeKeys(): Promise<{ signPrivate: CryptoKey; encPrivate: CryptoKey }> {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign", "verify"]
  );
  const enc = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveBits"]
  );
  return { signPrivate: pair.privateKey, encPrivate: enc.privateKey };
}

describe("keyStore rebinding", () => {
  it("resolves keys after tmp → server userId bind via pubkey", async () => {
    const pubkey = "ab".repeat(32);
    const keys = await fakeKeys();
    await putDeviceKeys(`tmp-demo`, keys);
    await putDeviceKeys(keyRefForPubkey(pubkey), keys);

    const ok = await bindDeviceKeysToUser({
      fromUserId: "tmp-demo",
      toUserId: "server-user-1",
      pubkey,
    });
    expect(ok).toBe(true);

    const resolved = await resolveDeviceKeys({ userId: "server-user-1", pubkey });
    expect(resolved).toBeTruthy();

    const sig = await signWithDeviceKey({ userId: "server-user-1", pubkey }, "hello");
    expect(sig).toMatch(/^[0-9a-f]+$/);
    expect(sig!.length).toBeGreaterThan(64);
  });
});
