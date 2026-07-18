import { DATA_CLASSIFICATION } from "./classification.js";
import {
  COMPLIANCE_GAPS,
  FEATURE_EXPOSURE_MATRIX,
  REGULATORY_MAPPING,
  SECURITY_CONTROLS,
  SERVICE_INVENTORY,
  SANCTIONS_RESCREEN_MS,
} from "./posture.js";
import type { Store } from "../services/store.js";
import { KycIssuanceService } from "./services/kycIssuance.js";
import { KycRegistryWriter } from "./services/kycRegistry.js";
import { RevocationService } from "./services/revocation.js";
import { EnrollmentRelayService } from "./services/enrollmentRelay.js";
import { ProofVerificationService } from "./services/proofVerification.js";
import { SettlementRelayService } from "./services/settlementRelay.js";
import { RecoveryVaultCoordinator } from "./services/recoveryCoordinator.js";
import { AuditReportingService } from "./services/auditReporting.js";
import { SanctionsRescreenService } from "./services/sanctionsRescreen.js";
import { SelectiveDisclosureService } from "./services/selectiveDisclosure.js";

export function createComplianceStack(store: Store) {
  return {
    kycIssuance: new KycIssuanceService(store),
    kycRegistry: new KycRegistryWriter(store),
    revocation: new RevocationService(store),
    enrollmentRelay: new EnrollmentRelayService(store),
    proofVerification: new ProofVerificationService(),
    settlementRelay: new SettlementRelayService(store),
    recoveryCoordinator: new RecoveryVaultCoordinator(store),
    auditReporting: new AuditReportingService(store),
    sanctionsRescreen: new SanctionsRescreenService(store),
    selectiveDisclosure: new SelectiveDisclosureService(store),
  };
}

export type ComplianceStack = ReturnType<typeof createComplianceStack>;

/** Full compliance document as machine-readable API payload */
export function complianceDocument() {
  return {
    title: "Circled — Backend Compliance & Feature Document",
    version: "1.0.0",
    designInvariant:
      "No backend service has both (a) enough data to identify a user and (b) enough data to know what they did. Enforced by ZK revelation boundaries, not access-control promises on a full database.",
    serviceInventory: SERVICE_INVENTORY,
    featureExposureMatrix: FEATURE_EXPOSURE_MATRIX,
    dataClassification: DATA_CLASSIFICATION,
    regulatoryMapping: REGULATORY_MAPPING,
    securityControls: SECURITY_CONTROLS,
    gapsToDisclose: COMPLIANCE_GAPS,
    operationalPolicy: {
      sanctionsRescreenMs: SANCTIONS_RESCREEN_MS,
      class3Retention: "24–72h (configured 48h)",
      class2Retention: "Per AML regime (placeholder 5 years — confirm with counsel)",
      disclaimer: "Not legal advice. Confirm applicability with counsel before real deployment.",
    },
  };
}

export {
  DATA_CLASSIFICATION,
  COMPLIANCE_GAPS,
  SERVICE_INVENTORY,
  FEATURE_EXPOSURE_MATRIX,
};
