# CircledProof — A Midnight-Based Replacement for OTP

Instead of sending a secret code and asking the user to type it back, the device
proves — locally, per request — that it holds a valid KYC credential, without
producing anything that can be intercepted, replayed, or phished.

Reuses Circled’s existing `kyc_registry_root` + `prove_kyc_membership`. Adds
`prove_session_auth` in `contracts/nyxpay.compact`.

## Protocol

1. **Challenge** — verifier issues public `challenge = hash(nonce, rp_id, time_window)`
2. **Local proof** — device generates `prove_session_auth` (confirm-tap / biometrics only)
3. **Verify + burn** — verifier checks proof, marks nonce spent (single-use)

## API

| Endpoint | Role |
|---|---|
| `GET /api/nyxproof` | Spec summary |
| `POST /api/nyxproof/challenge` | Issue public challenge (`unlinkable` optional) |
| `POST /api/nyxproof/verify` | Verify proof + burn nonce |
| Payment `POST /api/users/:id/confirm` | Requires `sessionAuth` bound to intent (confirm-tap) |

## Modes

- **Payment confirmation** — Accept tap carries `prove_session_auth` bound to intent commitment
- **External RP login** — UI panel on the proof theater; unlinkable mode logs no stable user handle

## Honest differentiator vs WebAuthn

Anti-phishing is not novel (WebAuthn already does that). Headline claims:

1. **Infrastructure reuse** — same KYC Merkle tree, zero new enrollment
2. **Optional unlinkability** — RP can receive only “valid non-revoked credential holder”

## Regulatory

Validate as “something you have” against jurisdiction-specific 2FA language before
treating as OTP-equivalent — same open-item category as Circled compliance gaps.
