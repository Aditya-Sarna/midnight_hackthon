import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<PS> = {
  localSecretKey(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  kycMembershipPath(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, { leaf: Uint8Array,
                                                                                  path: { sibling: { field: bigint
                                                                                                   },
                                                                                          goes_left: boolean
                                                                                        }[]
                                                                                }];
  spendOldBalance(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
  spendAmount(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
  spendOldOpening(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  spendNewOpening(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  creditOldBalance(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
  creditAmount(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
  creditOldOpening(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  creditNewOpening(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  policyAmount(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
  lockOldBalance(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
  lockCollateralAmount(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
  lockLoanAmount(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
  lockOldOpening(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  lockNewOpening(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  lockCollateralOpening(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  poolOldTotal(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
  poolDepositAmount(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
  poolOldOpening(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  poolNewOpening(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  poolLenderOldBalance(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
  poolLenderNewOpening(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  poolLenderOldOpening(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  repayInstallmentAmount(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
  repayRemainingOld(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
  repayRemainingNew(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
  standingOnTimeCount(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
  standingDefaultCount(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
  standingOnTimeThreshold(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
  standingMaxDefaults(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
  standingThrOpening(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  standingMaxDefOpening(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  strategyWeight(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
  strategyOpening(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
}

export type ImpureCircuits<PS> = {
  publish_kyc_root(context: __compactRuntime.CircuitContext<PS>,
                   root_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  publish_settlement_anchor(context: __compactRuntime.CircuitContext<PS>,
                            settlement_id_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  publish_kyc_leaf(context: __compactRuntime.CircuitContext<PS>,
                   leaf_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  prove_kyc_membership(context: __compactRuntime.CircuitContext<PS>,
                       leaf_0: Uint8Array,
                       root_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  prove_recipient_valid(context: __compactRuntime.CircuitContext<PS>,
                        leaf_0: Uint8Array,
                        root_0: Uint8Array,
                        contact_commitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  prove_policy_update(context: __compactRuntime.CircuitContext<PS>,
                      old_policy_commitment_0: Uint8Array,
                      new_policy_commitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  prove_spend_update(context: __compactRuntime.CircuitContext<PS>,
                     old_balance_commitment_0: Uint8Array,
                     new_balance_commitment_0: Uint8Array,
                     recipient_proof_digest_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  prove_credit_update(context: __compactRuntime.CircuitContext<PS>,
                      old_balance_commitment_0: Uint8Array,
                      new_balance_commitment_0: Uint8Array,
                      inbound_proof_digest_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  prove_session_auth(context: __compactRuntime.CircuitContext<PS>,
                     leaf_0: Uint8Array,
                     root_0: Uint8Array,
                     challenge_0: Uint8Array,
                     relying_party_id_0: Uint8Array,
                     time_window_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  prove_authorized_transaction(context: __compactRuntime.CircuitContext<PS>,
                               leaf_0: Uint8Array,
                               brand_registry_root_0: Uint8Array,
                               platform_challenge_0: Uint8Array,
                               intent_commitment_0: Uint8Array,
                               intent_signature_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  prove_collateral_lock(context: __compactRuntime.CircuitContext<PS>,
                        old_balance_commitment_0: Uint8Array,
                        new_balance_commitment_0: Uint8Array,
                        collateral_commitment_0: Uint8Array,
                        loan_commitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  prove_pool_deposit(context: __compactRuntime.CircuitContext<PS>,
                     old_pool_commitment_0: Uint8Array,
                     new_pool_commitment_0: Uint8Array,
                     old_lender_balance_commitment_0: Uint8Array,
                     new_lender_balance_commitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  prove_loan_repayment(context: __compactRuntime.CircuitContext<PS>,
                       loan_commitment_old_0: Uint8Array,
                       loan_commitment_new_0: Uint8Array,
                       installment_nullifier_0: Uint8Array,
                       credit_identity_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  prove_credit_standing(context: __compactRuntime.CircuitContext<PS>,
                        credit_identity_0: Uint8Array,
                        on_time_threshold_0: Uint8Array,
                        max_defaults_allowed_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  prove_pool_solvency(context: __compactRuntime.CircuitContext<PS>,
                      pool_commitment_0: Uint8Array,
                      coverage_ok_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  prove_strategy_commitment(context: __compactRuntime.CircuitContext<PS>,
                            strategy_commitment_0: Uint8Array,
                            strategy_id_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  publish_kyc_root(context: __compactRuntime.CircuitContext<PS>,
                   root_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  publish_settlement_anchor(context: __compactRuntime.CircuitContext<PS>,
                            settlement_id_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  publish_kyc_leaf(context: __compactRuntime.CircuitContext<PS>,
                   leaf_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  prove_kyc_membership(context: __compactRuntime.CircuitContext<PS>,
                       leaf_0: Uint8Array,
                       root_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  prove_recipient_valid(context: __compactRuntime.CircuitContext<PS>,
                        leaf_0: Uint8Array,
                        root_0: Uint8Array,
                        contact_commitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  prove_policy_update(context: __compactRuntime.CircuitContext<PS>,
                      old_policy_commitment_0: Uint8Array,
                      new_policy_commitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  prove_spend_update(context: __compactRuntime.CircuitContext<PS>,
                     old_balance_commitment_0: Uint8Array,
                     new_balance_commitment_0: Uint8Array,
                     recipient_proof_digest_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  prove_credit_update(context: __compactRuntime.CircuitContext<PS>,
                      old_balance_commitment_0: Uint8Array,
                      new_balance_commitment_0: Uint8Array,
                      inbound_proof_digest_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  prove_session_auth(context: __compactRuntime.CircuitContext<PS>,
                     leaf_0: Uint8Array,
                     root_0: Uint8Array,
                     challenge_0: Uint8Array,
                     relying_party_id_0: Uint8Array,
                     time_window_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  prove_authorized_transaction(context: __compactRuntime.CircuitContext<PS>,
                               leaf_0: Uint8Array,
                               brand_registry_root_0: Uint8Array,
                               platform_challenge_0: Uint8Array,
                               intent_commitment_0: Uint8Array,
                               intent_signature_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  prove_collateral_lock(context: __compactRuntime.CircuitContext<PS>,
                        old_balance_commitment_0: Uint8Array,
                        new_balance_commitment_0: Uint8Array,
                        collateral_commitment_0: Uint8Array,
                        loan_commitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  prove_pool_deposit(context: __compactRuntime.CircuitContext<PS>,
                     old_pool_commitment_0: Uint8Array,
                     new_pool_commitment_0: Uint8Array,
                     old_lender_balance_commitment_0: Uint8Array,
                     new_lender_balance_commitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  prove_loan_repayment(context: __compactRuntime.CircuitContext<PS>,
                       loan_commitment_old_0: Uint8Array,
                       loan_commitment_new_0: Uint8Array,
                       installment_nullifier_0: Uint8Array,
                       credit_identity_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  prove_credit_standing(context: __compactRuntime.CircuitContext<PS>,
                        credit_identity_0: Uint8Array,
                        on_time_threshold_0: Uint8Array,
                        max_defaults_allowed_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  prove_pool_solvency(context: __compactRuntime.CircuitContext<PS>,
                      pool_commitment_0: Uint8Array,
                      coverage_ok_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  prove_strategy_commitment(context: __compactRuntime.CircuitContext<PS>,
                            strategy_commitment_0: Uint8Array,
                            strategy_id_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
  publicKey(sk_0: Uint8Array, domain_0: Uint8Array): Uint8Array;
}

export type Circuits<PS> = {
  publish_kyc_root(context: __compactRuntime.CircuitContext<PS>,
                   root_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  publish_settlement_anchor(context: __compactRuntime.CircuitContext<PS>,
                            settlement_id_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  publish_kyc_leaf(context: __compactRuntime.CircuitContext<PS>,
                   leaf_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  prove_kyc_membership(context: __compactRuntime.CircuitContext<PS>,
                       leaf_0: Uint8Array,
                       root_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  prove_recipient_valid(context: __compactRuntime.CircuitContext<PS>,
                        leaf_0: Uint8Array,
                        root_0: Uint8Array,
                        contact_commitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  prove_policy_update(context: __compactRuntime.CircuitContext<PS>,
                      old_policy_commitment_0: Uint8Array,
                      new_policy_commitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  prove_spend_update(context: __compactRuntime.CircuitContext<PS>,
                     old_balance_commitment_0: Uint8Array,
                     new_balance_commitment_0: Uint8Array,
                     recipient_proof_digest_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  prove_credit_update(context: __compactRuntime.CircuitContext<PS>,
                      old_balance_commitment_0: Uint8Array,
                      new_balance_commitment_0: Uint8Array,
                      inbound_proof_digest_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  prove_session_auth(context: __compactRuntime.CircuitContext<PS>,
                     leaf_0: Uint8Array,
                     root_0: Uint8Array,
                     challenge_0: Uint8Array,
                     relying_party_id_0: Uint8Array,
                     time_window_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  publicKey(context: __compactRuntime.CircuitContext<PS>,
            sk_0: Uint8Array,
            domain_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  prove_authorized_transaction(context: __compactRuntime.CircuitContext<PS>,
                               leaf_0: Uint8Array,
                               brand_registry_root_0: Uint8Array,
                               platform_challenge_0: Uint8Array,
                               intent_commitment_0: Uint8Array,
                               intent_signature_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  prove_collateral_lock(context: __compactRuntime.CircuitContext<PS>,
                        old_balance_commitment_0: Uint8Array,
                        new_balance_commitment_0: Uint8Array,
                        collateral_commitment_0: Uint8Array,
                        loan_commitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  prove_pool_deposit(context: __compactRuntime.CircuitContext<PS>,
                     old_pool_commitment_0: Uint8Array,
                     new_pool_commitment_0: Uint8Array,
                     old_lender_balance_commitment_0: Uint8Array,
                     new_lender_balance_commitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  prove_loan_repayment(context: __compactRuntime.CircuitContext<PS>,
                       loan_commitment_old_0: Uint8Array,
                       loan_commitment_new_0: Uint8Array,
                       installment_nullifier_0: Uint8Array,
                       credit_identity_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  prove_credit_standing(context: __compactRuntime.CircuitContext<PS>,
                        credit_identity_0: Uint8Array,
                        on_time_threshold_0: Uint8Array,
                        max_defaults_allowed_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  prove_pool_solvency(context: __compactRuntime.CircuitContext<PS>,
                      pool_commitment_0: Uint8Array,
                      coverage_ok_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  prove_strategy_commitment(context: __compactRuntime.CircuitContext<PS>,
                            strategy_commitment_0: Uint8Array,
                            strategy_id_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type Ledger = {
  readonly kyc_registry_root: Uint8Array;
  kyc_tree: {
    isFull(): boolean;
    checkRoot(rt_0: { field: bigint }): boolean;
    root(): __compactRuntime.MerkleTreeDigest;
    firstFree(): bigint;
    pathForLeaf(index_0: bigint, leaf_0: Uint8Array): __compactRuntime.MerkleTreePath<Uint8Array>;
    findPathForLeaf(leaf_0: Uint8Array): __compactRuntime.MerkleTreePath<Uint8Array> | undefined;
    history(): Iterator<__compactRuntime.MerkleTreeDigest>
  };
  readonly spent_nullifier_count: bigint;
  readonly revoked_nullifier_count: bigint;
  readonly transfer_count: bigint;
  readonly credit_count: bigint;
  readonly spent_challenge_count: bigint;
  readonly policy_update_count: bigint;
  readonly settlement_anchor_count: bigint;
  readonly loan_count: bigint;
  readonly pool_deposit_count: bigint;
  readonly repayment_count: bigint;
  readonly credit_standing_count: bigint;
  readonly pool_solvency_count: bigint;
  readonly strategy_commit_count: bigint;
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
