/**
 * Production-shaped KYC provider — same interface as DigiLocker/Onfido-class issuers.
 * Does NOT call a live vendor. Simulates liveness + document + sanctions + session id.
 */
import { SandboxKycProvider, type KycProvider } from "../kycIssuance.js";

export class OnfidoShapedKycProvider implements KycProvider {
  id = "onfido-shaped-v1";

  verify(input: { documentReferenceHash: string; jurisdiction: string }) {
    const hashOk = Boolean(
      input.documentReferenceHash && input.documentReferenceHash.length >= 16
    );
    const forceFail =
      /fail$/i.test(input.documentReferenceHash) ||
      /sanction/i.test(input.documentReferenceHash);
    const docFail = /nodoc$/i.test(input.documentReferenceHash);
    const liveFail = /nolive$/i.test(input.documentReferenceHash);

    const documentCheckPass = hashOk && !docFail;
    const livenessPass = hashOk && !liveFail;
    const sanctionsClear = hashOk && !forceFail;
    const pass = documentCheckPass && livenessPass && sanctionsClear;

    return {
      pass,
      sanctionsClear,
      livenessPass,
      documentCheckPass,
      exceptionCode: !pass
        ? forceFail
          ? "SANCTIONS_HIT"
          : docFail
            ? "DOCUMENT_CHECK_FAILED"
            : liveFail
              ? "LIVENESS_FAILED"
              : "PROVIDER_REJECTED"
        : null,
    };
  }
}

export function resolveKycProvider(): KycProvider {
  const id = (process.env.KYC_PROVIDER || "sandbox").toLowerCase();
  if (id === "onfido_shaped" || id === "onfido-shaped" || id === "shaped") {
    return new OnfidoShapedKycProvider();
  }
  return new SandboxKycProvider();
}
