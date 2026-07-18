import * as __compactRuntime from '@midnight-ntwrk/compact-runtime';
__compactRuntime.checkRuntimeVersion('0.16.0');

const _descriptor_0 = new __compactRuntime.CompactTypeUnsignedInteger(65535n, 2);

const _descriptor_1 = new __compactRuntime.CompactTypeBytes(32);

const _descriptor_2 = __compactRuntime.CompactTypeField;

class _MerkleTreeDigest_0 {
  alignment() {
    return _descriptor_2.alignment();
  }
  fromValue(value_0) {
    return {
      field: _descriptor_2.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_2.toValue(value_0.field);
  }
}

const _descriptor_3 = new _MerkleTreeDigest_0();

const _descriptor_4 = __compactRuntime.CompactTypeBoolean;

class _MerkleTreePathEntry_0 {
  alignment() {
    return _descriptor_3.alignment().concat(_descriptor_4.alignment());
  }
  fromValue(value_0) {
    return {
      sibling: _descriptor_3.fromValue(value_0),
      goes_left: _descriptor_4.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_3.toValue(value_0.sibling).concat(_descriptor_4.toValue(value_0.goes_left));
  }
}

const _descriptor_5 = new _MerkleTreePathEntry_0();

const _descriptor_6 = new __compactRuntime.CompactTypeVector(16, _descriptor_5);

class _MerkleTreePath_0 {
  alignment() {
    return _descriptor_1.alignment().concat(_descriptor_6.alignment());
  }
  fromValue(value_0) {
    return {
      leaf: _descriptor_1.fromValue(value_0),
      path: _descriptor_6.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_1.toValue(value_0.leaf).concat(_descriptor_6.toValue(value_0.path));
  }
}

const _descriptor_7 = new _MerkleTreePath_0();

const _descriptor_8 = new __compactRuntime.CompactTypeVector(4, _descriptor_1);

const _descriptor_9 = new __compactRuntime.CompactTypeVector(3, _descriptor_1);

const _descriptor_10 = new __compactRuntime.CompactTypeBytes(6);

class _LeafPreimage_0 {
  alignment() {
    return _descriptor_10.alignment().concat(_descriptor_1.alignment());
  }
  fromValue(value_0) {
    return {
      domain_sep: _descriptor_10.fromValue(value_0),
      data: _descriptor_1.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_10.toValue(value_0.domain_sep).concat(_descriptor_1.toValue(value_0.data));
  }
}

const _descriptor_11 = new _LeafPreimage_0();

const _descriptor_12 = new __compactRuntime.CompactTypeVector(5, _descriptor_1);

const _descriptor_13 = new __compactRuntime.CompactTypeVector(2, _descriptor_2);

const _descriptor_14 = new __compactRuntime.CompactTypeVector(2, _descriptor_1);

const _descriptor_15 = new __compactRuntime.CompactTypeUnsignedInteger(18446744073709551615n, 8);

class _Either_0 {
  alignment() {
    return _descriptor_4.alignment().concat(_descriptor_1.alignment().concat(_descriptor_1.alignment()));
  }
  fromValue(value_0) {
    return {
      is_left: _descriptor_4.fromValue(value_0),
      left: _descriptor_1.fromValue(value_0),
      right: _descriptor_1.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_4.toValue(value_0.is_left).concat(_descriptor_1.toValue(value_0.left).concat(_descriptor_1.toValue(value_0.right)));
  }
}

const _descriptor_16 = new _Either_0();

const _descriptor_17 = new __compactRuntime.CompactTypeUnsignedInteger(340282366920938463463374607431768211455n, 16);

class _ContractAddress_0 {
  alignment() {
    return _descriptor_1.alignment();
  }
  fromValue(value_0) {
    return {
      bytes: _descriptor_1.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_1.toValue(value_0.bytes);
  }
}

const _descriptor_18 = new _ContractAddress_0();

const _descriptor_19 = new __compactRuntime.CompactTypeUnsignedInteger(255n, 1);

export class Contract {
  witnesses;
  constructor(...args_0) {
    if (args_0.length !== 1) {
      throw new __compactRuntime.CompactError(`Contract constructor: expected 1 argument, received ${args_0.length}`);
    }
    const witnesses_0 = args_0[0];
    if (typeof(witnesses_0) !== 'object') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor is not an object');
    }
    if (typeof(witnesses_0.localSecretKey) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named localSecretKey');
    }
    if (typeof(witnesses_0.kycMembershipPath) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named kycMembershipPath');
    }
    if (typeof(witnesses_0.spendOldBalance) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named spendOldBalance');
    }
    if (typeof(witnesses_0.spendAmount) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named spendAmount');
    }
    if (typeof(witnesses_0.spendOldOpening) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named spendOldOpening');
    }
    if (typeof(witnesses_0.spendNewOpening) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named spendNewOpening');
    }
    if (typeof(witnesses_0.creditOldBalance) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named creditOldBalance');
    }
    if (typeof(witnesses_0.creditAmount) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named creditAmount');
    }
    if (typeof(witnesses_0.creditOldOpening) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named creditOldOpening');
    }
    if (typeof(witnesses_0.creditNewOpening) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named creditNewOpening');
    }
    if (typeof(witnesses_0.policyAmount) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named policyAmount');
    }
    if (typeof(witnesses_0.lockOldBalance) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named lockOldBalance');
    }
    if (typeof(witnesses_0.lockCollateralAmount) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named lockCollateralAmount');
    }
    if (typeof(witnesses_0.lockLoanAmount) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named lockLoanAmount');
    }
    if (typeof(witnesses_0.lockOldOpening) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named lockOldOpening');
    }
    if (typeof(witnesses_0.lockNewOpening) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named lockNewOpening');
    }
    if (typeof(witnesses_0.lockCollateralOpening) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named lockCollateralOpening');
    }
    if (typeof(witnesses_0.poolOldTotal) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named poolOldTotal');
    }
    if (typeof(witnesses_0.poolDepositAmount) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named poolDepositAmount');
    }
    if (typeof(witnesses_0.poolOldOpening) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named poolOldOpening');
    }
    if (typeof(witnesses_0.poolNewOpening) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named poolNewOpening');
    }
    if (typeof(witnesses_0.poolLenderOldBalance) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named poolLenderOldBalance');
    }
    if (typeof(witnesses_0.poolLenderNewOpening) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named poolLenderNewOpening');
    }
    if (typeof(witnesses_0.poolLenderOldOpening) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named poolLenderOldOpening');
    }
    if (typeof(witnesses_0.repayInstallmentAmount) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named repayInstallmentAmount');
    }
    if (typeof(witnesses_0.repayRemainingOld) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named repayRemainingOld');
    }
    if (typeof(witnesses_0.repayRemainingNew) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named repayRemainingNew');
    }
    if (typeof(witnesses_0.standingOnTimeCount) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named standingOnTimeCount');
    }
    if (typeof(witnesses_0.standingDefaultCount) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named standingDefaultCount');
    }
    if (typeof(witnesses_0.standingOnTimeThreshold) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named standingOnTimeThreshold');
    }
    if (typeof(witnesses_0.standingMaxDefaults) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named standingMaxDefaults');
    }
    if (typeof(witnesses_0.standingThrOpening) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named standingThrOpening');
    }
    if (typeof(witnesses_0.standingMaxDefOpening) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named standingMaxDefOpening');
    }
    this.witnesses = witnesses_0;
    this.circuits = {
      publish_kyc_root: (...args_1) => {
        if (args_1.length !== 2) {
          throw new __compactRuntime.CompactError(`publish_kyc_root: expected 2 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const root_0 = args_1[1];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('publish_kyc_root',
                                     'argument 1 (as invoked from Typescript)',
                                     'nyxpay.compact line 72 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(root_0.buffer instanceof ArrayBuffer && root_0.BYTES_PER_ELEMENT === 1 && root_0.length === 32)) {
          __compactRuntime.typeError('publish_kyc_root',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'nyxpay.compact line 72 char 1',
                                     'Bytes<32>',
                                     root_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_1.toValue(root_0),
            alignment: _descriptor_1.alignment()
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._publish_kyc_root_0(context,
                                                  partialProofData,
                                                  root_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      publish_settlement_anchor: (...args_1) => {
        if (args_1.length !== 2) {
          throw new __compactRuntime.CompactError(`publish_settlement_anchor: expected 2 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const settlement_id_0 = args_1[1];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('publish_settlement_anchor',
                                     'argument 1 (as invoked from Typescript)',
                                     'nyxpay.compact line 81 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(settlement_id_0.buffer instanceof ArrayBuffer && settlement_id_0.BYTES_PER_ELEMENT === 1 && settlement_id_0.length === 32)) {
          __compactRuntime.typeError('publish_settlement_anchor',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'nyxpay.compact line 81 char 1',
                                     'Bytes<32>',
                                     settlement_id_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_1.toValue(settlement_id_0),
            alignment: _descriptor_1.alignment()
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._publish_settlement_anchor_0(context,
                                                           partialProofData,
                                                           settlement_id_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      publish_kyc_leaf: (...args_1) => {
        if (args_1.length !== 2) {
          throw new __compactRuntime.CompactError(`publish_kyc_leaf: expected 2 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const leaf_0 = args_1[1];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('publish_kyc_leaf',
                                     'argument 1 (as invoked from Typescript)',
                                     'nyxpay.compact line 92 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(leaf_0.buffer instanceof ArrayBuffer && leaf_0.BYTES_PER_ELEMENT === 1 && leaf_0.length === 32)) {
          __compactRuntime.typeError('publish_kyc_leaf',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'nyxpay.compact line 92 char 1',
                                     'Bytes<32>',
                                     leaf_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_1.toValue(leaf_0),
            alignment: _descriptor_1.alignment()
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._publish_kyc_leaf_0(context,
                                                  partialProofData,
                                                  leaf_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      prove_kyc_membership: (...args_1) => {
        if (args_1.length !== 3) {
          throw new __compactRuntime.CompactError(`prove_kyc_membership: expected 3 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const leaf_0 = args_1[1];
        const root_0 = args_1[2];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('prove_kyc_membership',
                                     'argument 1 (as invoked from Typescript)',
                                     'nyxpay.compact line 100 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(leaf_0.buffer instanceof ArrayBuffer && leaf_0.BYTES_PER_ELEMENT === 1 && leaf_0.length === 32)) {
          __compactRuntime.typeError('prove_kyc_membership',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'nyxpay.compact line 100 char 1',
                                     'Bytes<32>',
                                     leaf_0)
        }
        if (!(root_0.buffer instanceof ArrayBuffer && root_0.BYTES_PER_ELEMENT === 1 && root_0.length === 32)) {
          __compactRuntime.typeError('prove_kyc_membership',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'nyxpay.compact line 100 char 1',
                                     'Bytes<32>',
                                     root_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_1.toValue(leaf_0).concat(_descriptor_1.toValue(root_0)),
            alignment: _descriptor_1.alignment().concat(_descriptor_1.alignment())
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._prove_kyc_membership_0(context,
                                                      partialProofData,
                                                      leaf_0,
                                                      root_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      prove_recipient_valid: (...args_1) => {
        if (args_1.length !== 4) {
          throw new __compactRuntime.CompactError(`prove_recipient_valid: expected 4 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const leaf_0 = args_1[1];
        const root_0 = args_1[2];
        const contact_commitment_0 = args_1[3];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('prove_recipient_valid',
                                     'argument 1 (as invoked from Typescript)',
                                     'nyxpay.compact line 112 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(leaf_0.buffer instanceof ArrayBuffer && leaf_0.BYTES_PER_ELEMENT === 1 && leaf_0.length === 32)) {
          __compactRuntime.typeError('prove_recipient_valid',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'nyxpay.compact line 112 char 1',
                                     'Bytes<32>',
                                     leaf_0)
        }
        if (!(root_0.buffer instanceof ArrayBuffer && root_0.BYTES_PER_ELEMENT === 1 && root_0.length === 32)) {
          __compactRuntime.typeError('prove_recipient_valid',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'nyxpay.compact line 112 char 1',
                                     'Bytes<32>',
                                     root_0)
        }
        if (!(contact_commitment_0.buffer instanceof ArrayBuffer && contact_commitment_0.BYTES_PER_ELEMENT === 1 && contact_commitment_0.length === 32)) {
          __compactRuntime.typeError('prove_recipient_valid',
                                     'argument 3 (argument 4 as invoked from Typescript)',
                                     'nyxpay.compact line 112 char 1',
                                     'Bytes<32>',
                                     contact_commitment_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_1.toValue(leaf_0).concat(_descriptor_1.toValue(root_0).concat(_descriptor_1.toValue(contact_commitment_0))),
            alignment: _descriptor_1.alignment().concat(_descriptor_1.alignment().concat(_descriptor_1.alignment()))
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._prove_recipient_valid_0(context,
                                                       partialProofData,
                                                       leaf_0,
                                                       root_0,
                                                       contact_commitment_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      prove_policy_update: (...args_1) => {
        if (args_1.length !== 3) {
          throw new __compactRuntime.CompactError(`prove_policy_update: expected 3 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const old_policy_commitment_0 = args_1[1];
        const new_policy_commitment_0 = args_1[2];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('prove_policy_update',
                                     'argument 1 (as invoked from Typescript)',
                                     'nyxpay.compact line 132 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(old_policy_commitment_0.buffer instanceof ArrayBuffer && old_policy_commitment_0.BYTES_PER_ELEMENT === 1 && old_policy_commitment_0.length === 32)) {
          __compactRuntime.typeError('prove_policy_update',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'nyxpay.compact line 132 char 1',
                                     'Bytes<32>',
                                     old_policy_commitment_0)
        }
        if (!(new_policy_commitment_0.buffer instanceof ArrayBuffer && new_policy_commitment_0.BYTES_PER_ELEMENT === 1 && new_policy_commitment_0.length === 32)) {
          __compactRuntime.typeError('prove_policy_update',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'nyxpay.compact line 132 char 1',
                                     'Bytes<32>',
                                     new_policy_commitment_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_1.toValue(old_policy_commitment_0).concat(_descriptor_1.toValue(new_policy_commitment_0)),
            alignment: _descriptor_1.alignment().concat(_descriptor_1.alignment())
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._prove_policy_update_0(context,
                                                     partialProofData,
                                                     old_policy_commitment_0,
                                                     new_policy_commitment_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      prove_spend_update: (...args_1) => {
        if (args_1.length !== 4) {
          throw new __compactRuntime.CompactError(`prove_spend_update: expected 4 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const old_balance_commitment_0 = args_1[1];
        const new_balance_commitment_0 = args_1[2];
        const recipient_proof_digest_0 = args_1[3];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('prove_spend_update',
                                     'argument 1 (as invoked from Typescript)',
                                     'nyxpay.compact line 153 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(old_balance_commitment_0.buffer instanceof ArrayBuffer && old_balance_commitment_0.BYTES_PER_ELEMENT === 1 && old_balance_commitment_0.length === 32)) {
          __compactRuntime.typeError('prove_spend_update',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'nyxpay.compact line 153 char 1',
                                     'Bytes<32>',
                                     old_balance_commitment_0)
        }
        if (!(new_balance_commitment_0.buffer instanceof ArrayBuffer && new_balance_commitment_0.BYTES_PER_ELEMENT === 1 && new_balance_commitment_0.length === 32)) {
          __compactRuntime.typeError('prove_spend_update',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'nyxpay.compact line 153 char 1',
                                     'Bytes<32>',
                                     new_balance_commitment_0)
        }
        if (!(recipient_proof_digest_0.buffer instanceof ArrayBuffer && recipient_proof_digest_0.BYTES_PER_ELEMENT === 1 && recipient_proof_digest_0.length === 32)) {
          __compactRuntime.typeError('prove_spend_update',
                                     'argument 3 (argument 4 as invoked from Typescript)',
                                     'nyxpay.compact line 153 char 1',
                                     'Bytes<32>',
                                     recipient_proof_digest_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_1.toValue(old_balance_commitment_0).concat(_descriptor_1.toValue(new_balance_commitment_0).concat(_descriptor_1.toValue(recipient_proof_digest_0))),
            alignment: _descriptor_1.alignment().concat(_descriptor_1.alignment().concat(_descriptor_1.alignment()))
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._prove_spend_update_0(context,
                                                    partialProofData,
                                                    old_balance_commitment_0,
                                                    new_balance_commitment_0,
                                                    recipient_proof_digest_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      prove_credit_update: (...args_1) => {
        if (args_1.length !== 4) {
          throw new __compactRuntime.CompactError(`prove_credit_update: expected 4 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const old_balance_commitment_0 = args_1[1];
        const new_balance_commitment_0 = args_1[2];
        const inbound_proof_digest_0 = args_1[3];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('prove_credit_update',
                                     'argument 1 (as invoked from Typescript)',
                                     'nyxpay.compact line 191 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(old_balance_commitment_0.buffer instanceof ArrayBuffer && old_balance_commitment_0.BYTES_PER_ELEMENT === 1 && old_balance_commitment_0.length === 32)) {
          __compactRuntime.typeError('prove_credit_update',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'nyxpay.compact line 191 char 1',
                                     'Bytes<32>',
                                     old_balance_commitment_0)
        }
        if (!(new_balance_commitment_0.buffer instanceof ArrayBuffer && new_balance_commitment_0.BYTES_PER_ELEMENT === 1 && new_balance_commitment_0.length === 32)) {
          __compactRuntime.typeError('prove_credit_update',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'nyxpay.compact line 191 char 1',
                                     'Bytes<32>',
                                     new_balance_commitment_0)
        }
        if (!(inbound_proof_digest_0.buffer instanceof ArrayBuffer && inbound_proof_digest_0.BYTES_PER_ELEMENT === 1 && inbound_proof_digest_0.length === 32)) {
          __compactRuntime.typeError('prove_credit_update',
                                     'argument 3 (argument 4 as invoked from Typescript)',
                                     'nyxpay.compact line 191 char 1',
                                     'Bytes<32>',
                                     inbound_proof_digest_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_1.toValue(old_balance_commitment_0).concat(_descriptor_1.toValue(new_balance_commitment_0).concat(_descriptor_1.toValue(inbound_proof_digest_0))),
            alignment: _descriptor_1.alignment().concat(_descriptor_1.alignment().concat(_descriptor_1.alignment()))
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._prove_credit_update_0(context,
                                                     partialProofData,
                                                     old_balance_commitment_0,
                                                     new_balance_commitment_0,
                                                     inbound_proof_digest_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      prove_session_auth: (...args_1) => {
        if (args_1.length !== 6) {
          throw new __compactRuntime.CompactError(`prove_session_auth: expected 6 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const leaf_0 = args_1[1];
        const root_0 = args_1[2];
        const challenge_0 = args_1[3];
        const relying_party_id_0 = args_1[4];
        const time_window_0 = args_1[5];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('prove_session_auth',
                                     'argument 1 (as invoked from Typescript)',
                                     'nyxpay.compact line 225 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(leaf_0.buffer instanceof ArrayBuffer && leaf_0.BYTES_PER_ELEMENT === 1 && leaf_0.length === 32)) {
          __compactRuntime.typeError('prove_session_auth',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'nyxpay.compact line 225 char 1',
                                     'Bytes<32>',
                                     leaf_0)
        }
        if (!(root_0.buffer instanceof ArrayBuffer && root_0.BYTES_PER_ELEMENT === 1 && root_0.length === 32)) {
          __compactRuntime.typeError('prove_session_auth',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'nyxpay.compact line 225 char 1',
                                     'Bytes<32>',
                                     root_0)
        }
        if (!(challenge_0.buffer instanceof ArrayBuffer && challenge_0.BYTES_PER_ELEMENT === 1 && challenge_0.length === 32)) {
          __compactRuntime.typeError('prove_session_auth',
                                     'argument 3 (argument 4 as invoked from Typescript)',
                                     'nyxpay.compact line 225 char 1',
                                     'Bytes<32>',
                                     challenge_0)
        }
        if (!(relying_party_id_0.buffer instanceof ArrayBuffer && relying_party_id_0.BYTES_PER_ELEMENT === 1 && relying_party_id_0.length === 32)) {
          __compactRuntime.typeError('prove_session_auth',
                                     'argument 4 (argument 5 as invoked from Typescript)',
                                     'nyxpay.compact line 225 char 1',
                                     'Bytes<32>',
                                     relying_party_id_0)
        }
        if (!(time_window_0.buffer instanceof ArrayBuffer && time_window_0.BYTES_PER_ELEMENT === 1 && time_window_0.length === 32)) {
          __compactRuntime.typeError('prove_session_auth',
                                     'argument 5 (argument 6 as invoked from Typescript)',
                                     'nyxpay.compact line 225 char 1',
                                     'Bytes<32>',
                                     time_window_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_1.toValue(leaf_0).concat(_descriptor_1.toValue(root_0).concat(_descriptor_1.toValue(challenge_0).concat(_descriptor_1.toValue(relying_party_id_0).concat(_descriptor_1.toValue(time_window_0))))),
            alignment: _descriptor_1.alignment().concat(_descriptor_1.alignment().concat(_descriptor_1.alignment().concat(_descriptor_1.alignment().concat(_descriptor_1.alignment()))))
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._prove_session_auth_0(context,
                                                    partialProofData,
                                                    leaf_0,
                                                    root_0,
                                                    challenge_0,
                                                    relying_party_id_0,
                                                    time_window_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      publicKey(context, ...args_1) {
        return { result: pureCircuits.publicKey(...args_1), context };
      },
      prove_authorized_transaction: (...args_1) => {
        if (args_1.length !== 6) {
          throw new __compactRuntime.CompactError(`prove_authorized_transaction: expected 6 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const leaf_0 = args_1[1];
        const brand_registry_root_0 = args_1[2];
        const platform_challenge_0 = args_1[3];
        const intent_commitment_0 = args_1[4];
        const intent_signature_0 = args_1[5];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('prove_authorized_transaction',
                                     'argument 1 (as invoked from Typescript)',
                                     'nyxpay.compact line 252 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(leaf_0.buffer instanceof ArrayBuffer && leaf_0.BYTES_PER_ELEMENT === 1 && leaf_0.length === 32)) {
          __compactRuntime.typeError('prove_authorized_transaction',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'nyxpay.compact line 252 char 1',
                                     'Bytes<32>',
                                     leaf_0)
        }
        if (!(brand_registry_root_0.buffer instanceof ArrayBuffer && brand_registry_root_0.BYTES_PER_ELEMENT === 1 && brand_registry_root_0.length === 32)) {
          __compactRuntime.typeError('prove_authorized_transaction',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'nyxpay.compact line 252 char 1',
                                     'Bytes<32>',
                                     brand_registry_root_0)
        }
        if (!(platform_challenge_0.buffer instanceof ArrayBuffer && platform_challenge_0.BYTES_PER_ELEMENT === 1 && platform_challenge_0.length === 32)) {
          __compactRuntime.typeError('prove_authorized_transaction',
                                     'argument 3 (argument 4 as invoked from Typescript)',
                                     'nyxpay.compact line 252 char 1',
                                     'Bytes<32>',
                                     platform_challenge_0)
        }
        if (!(intent_commitment_0.buffer instanceof ArrayBuffer && intent_commitment_0.BYTES_PER_ELEMENT === 1 && intent_commitment_0.length === 32)) {
          __compactRuntime.typeError('prove_authorized_transaction',
                                     'argument 4 (argument 5 as invoked from Typescript)',
                                     'nyxpay.compact line 252 char 1',
                                     'Bytes<32>',
                                     intent_commitment_0)
        }
        if (!(intent_signature_0.buffer instanceof ArrayBuffer && intent_signature_0.BYTES_PER_ELEMENT === 1 && intent_signature_0.length === 32)) {
          __compactRuntime.typeError('prove_authorized_transaction',
                                     'argument 5 (argument 6 as invoked from Typescript)',
                                     'nyxpay.compact line 252 char 1',
                                     'Bytes<32>',
                                     intent_signature_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_1.toValue(leaf_0).concat(_descriptor_1.toValue(brand_registry_root_0).concat(_descriptor_1.toValue(platform_challenge_0).concat(_descriptor_1.toValue(intent_commitment_0).concat(_descriptor_1.toValue(intent_signature_0))))),
            alignment: _descriptor_1.alignment().concat(_descriptor_1.alignment().concat(_descriptor_1.alignment().concat(_descriptor_1.alignment().concat(_descriptor_1.alignment()))))
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._prove_authorized_transaction_0(context,
                                                              partialProofData,
                                                              leaf_0,
                                                              brand_registry_root_0,
                                                              platform_challenge_0,
                                                              intent_commitment_0,
                                                              intent_signature_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      prove_collateral_lock: (...args_1) => {
        if (args_1.length !== 5) {
          throw new __compactRuntime.CompactError(`prove_collateral_lock: expected 5 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const old_balance_commitment_0 = args_1[1];
        const new_balance_commitment_0 = args_1[2];
        const collateral_commitment_0 = args_1[3];
        const loan_commitment_0 = args_1[4];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('prove_collateral_lock',
                                     'argument 1 (as invoked from Typescript)',
                                     'nyxpay.compact line 287 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(old_balance_commitment_0.buffer instanceof ArrayBuffer && old_balance_commitment_0.BYTES_PER_ELEMENT === 1 && old_balance_commitment_0.length === 32)) {
          __compactRuntime.typeError('prove_collateral_lock',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'nyxpay.compact line 287 char 1',
                                     'Bytes<32>',
                                     old_balance_commitment_0)
        }
        if (!(new_balance_commitment_0.buffer instanceof ArrayBuffer && new_balance_commitment_0.BYTES_PER_ELEMENT === 1 && new_balance_commitment_0.length === 32)) {
          __compactRuntime.typeError('prove_collateral_lock',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'nyxpay.compact line 287 char 1',
                                     'Bytes<32>',
                                     new_balance_commitment_0)
        }
        if (!(collateral_commitment_0.buffer instanceof ArrayBuffer && collateral_commitment_0.BYTES_PER_ELEMENT === 1 && collateral_commitment_0.length === 32)) {
          __compactRuntime.typeError('prove_collateral_lock',
                                     'argument 3 (argument 4 as invoked from Typescript)',
                                     'nyxpay.compact line 287 char 1',
                                     'Bytes<32>',
                                     collateral_commitment_0)
        }
        if (!(loan_commitment_0.buffer instanceof ArrayBuffer && loan_commitment_0.BYTES_PER_ELEMENT === 1 && loan_commitment_0.length === 32)) {
          __compactRuntime.typeError('prove_collateral_lock',
                                     'argument 4 (argument 5 as invoked from Typescript)',
                                     'nyxpay.compact line 287 char 1',
                                     'Bytes<32>',
                                     loan_commitment_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_1.toValue(old_balance_commitment_0).concat(_descriptor_1.toValue(new_balance_commitment_0).concat(_descriptor_1.toValue(collateral_commitment_0).concat(_descriptor_1.toValue(loan_commitment_0)))),
            alignment: _descriptor_1.alignment().concat(_descriptor_1.alignment().concat(_descriptor_1.alignment().concat(_descriptor_1.alignment())))
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._prove_collateral_lock_0(context,
                                                       partialProofData,
                                                       old_balance_commitment_0,
                                                       new_balance_commitment_0,
                                                       collateral_commitment_0,
                                                       loan_commitment_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      prove_pool_deposit: (...args_1) => {
        if (args_1.length !== 5) {
          throw new __compactRuntime.CompactError(`prove_pool_deposit: expected 5 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const old_pool_commitment_0 = args_1[1];
        const new_pool_commitment_0 = args_1[2];
        const old_lender_balance_commitment_0 = args_1[3];
        const new_lender_balance_commitment_0 = args_1[4];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('prove_pool_deposit',
                                     'argument 1 (as invoked from Typescript)',
                                     'nyxpay.compact line 337 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(old_pool_commitment_0.buffer instanceof ArrayBuffer && old_pool_commitment_0.BYTES_PER_ELEMENT === 1 && old_pool_commitment_0.length === 32)) {
          __compactRuntime.typeError('prove_pool_deposit',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'nyxpay.compact line 337 char 1',
                                     'Bytes<32>',
                                     old_pool_commitment_0)
        }
        if (!(new_pool_commitment_0.buffer instanceof ArrayBuffer && new_pool_commitment_0.BYTES_PER_ELEMENT === 1 && new_pool_commitment_0.length === 32)) {
          __compactRuntime.typeError('prove_pool_deposit',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'nyxpay.compact line 337 char 1',
                                     'Bytes<32>',
                                     new_pool_commitment_0)
        }
        if (!(old_lender_balance_commitment_0.buffer instanceof ArrayBuffer && old_lender_balance_commitment_0.BYTES_PER_ELEMENT === 1 && old_lender_balance_commitment_0.length === 32)) {
          __compactRuntime.typeError('prove_pool_deposit',
                                     'argument 3 (argument 4 as invoked from Typescript)',
                                     'nyxpay.compact line 337 char 1',
                                     'Bytes<32>',
                                     old_lender_balance_commitment_0)
        }
        if (!(new_lender_balance_commitment_0.buffer instanceof ArrayBuffer && new_lender_balance_commitment_0.BYTES_PER_ELEMENT === 1 && new_lender_balance_commitment_0.length === 32)) {
          __compactRuntime.typeError('prove_pool_deposit',
                                     'argument 4 (argument 5 as invoked from Typescript)',
                                     'nyxpay.compact line 337 char 1',
                                     'Bytes<32>',
                                     new_lender_balance_commitment_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_1.toValue(old_pool_commitment_0).concat(_descriptor_1.toValue(new_pool_commitment_0).concat(_descriptor_1.toValue(old_lender_balance_commitment_0).concat(_descriptor_1.toValue(new_lender_balance_commitment_0)))),
            alignment: _descriptor_1.alignment().concat(_descriptor_1.alignment().concat(_descriptor_1.alignment().concat(_descriptor_1.alignment())))
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._prove_pool_deposit_0(context,
                                                    partialProofData,
                                                    old_pool_commitment_0,
                                                    new_pool_commitment_0,
                                                    old_lender_balance_commitment_0,
                                                    new_lender_balance_commitment_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      prove_loan_repayment: (...args_1) => {
        if (args_1.length !== 5) {
          throw new __compactRuntime.CompactError(`prove_loan_repayment: expected 5 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const loan_commitment_old_0 = args_1[1];
        const loan_commitment_new_0 = args_1[2];
        const installment_nullifier_0 = args_1[3];
        const credit_identity_0 = args_1[4];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('prove_loan_repayment',
                                     'argument 1 (as invoked from Typescript)',
                                     'nyxpay.compact line 384 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(loan_commitment_old_0.buffer instanceof ArrayBuffer && loan_commitment_old_0.BYTES_PER_ELEMENT === 1 && loan_commitment_old_0.length === 32)) {
          __compactRuntime.typeError('prove_loan_repayment',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'nyxpay.compact line 384 char 1',
                                     'Bytes<32>',
                                     loan_commitment_old_0)
        }
        if (!(loan_commitment_new_0.buffer instanceof ArrayBuffer && loan_commitment_new_0.BYTES_PER_ELEMENT === 1 && loan_commitment_new_0.length === 32)) {
          __compactRuntime.typeError('prove_loan_repayment',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'nyxpay.compact line 384 char 1',
                                     'Bytes<32>',
                                     loan_commitment_new_0)
        }
        if (!(installment_nullifier_0.buffer instanceof ArrayBuffer && installment_nullifier_0.BYTES_PER_ELEMENT === 1 && installment_nullifier_0.length === 32)) {
          __compactRuntime.typeError('prove_loan_repayment',
                                     'argument 3 (argument 4 as invoked from Typescript)',
                                     'nyxpay.compact line 384 char 1',
                                     'Bytes<32>',
                                     installment_nullifier_0)
        }
        if (!(credit_identity_0.buffer instanceof ArrayBuffer && credit_identity_0.BYTES_PER_ELEMENT === 1 && credit_identity_0.length === 32)) {
          __compactRuntime.typeError('prove_loan_repayment',
                                     'argument 4 (argument 5 as invoked from Typescript)',
                                     'nyxpay.compact line 384 char 1',
                                     'Bytes<32>',
                                     credit_identity_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_1.toValue(loan_commitment_old_0).concat(_descriptor_1.toValue(loan_commitment_new_0).concat(_descriptor_1.toValue(installment_nullifier_0).concat(_descriptor_1.toValue(credit_identity_0)))),
            alignment: _descriptor_1.alignment().concat(_descriptor_1.alignment().concat(_descriptor_1.alignment().concat(_descriptor_1.alignment())))
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._prove_loan_repayment_0(context,
                                                      partialProofData,
                                                      loan_commitment_old_0,
                                                      loan_commitment_new_0,
                                                      installment_nullifier_0,
                                                      credit_identity_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      prove_credit_standing: (...args_1) => {
        if (args_1.length !== 4) {
          throw new __compactRuntime.CompactError(`prove_credit_standing: expected 4 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const credit_identity_0 = args_1[1];
        const on_time_threshold_0 = args_1[2];
        const max_defaults_allowed_0 = args_1[3];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('prove_credit_standing',
                                     'argument 1 (as invoked from Typescript)',
                                     'nyxpay.compact line 416 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(credit_identity_0.buffer instanceof ArrayBuffer && credit_identity_0.BYTES_PER_ELEMENT === 1 && credit_identity_0.length === 32)) {
          __compactRuntime.typeError('prove_credit_standing',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'nyxpay.compact line 416 char 1',
                                     'Bytes<32>',
                                     credit_identity_0)
        }
        if (!(on_time_threshold_0.buffer instanceof ArrayBuffer && on_time_threshold_0.BYTES_PER_ELEMENT === 1 && on_time_threshold_0.length === 32)) {
          __compactRuntime.typeError('prove_credit_standing',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'nyxpay.compact line 416 char 1',
                                     'Bytes<32>',
                                     on_time_threshold_0)
        }
        if (!(max_defaults_allowed_0.buffer instanceof ArrayBuffer && max_defaults_allowed_0.BYTES_PER_ELEMENT === 1 && max_defaults_allowed_0.length === 32)) {
          __compactRuntime.typeError('prove_credit_standing',
                                     'argument 3 (argument 4 as invoked from Typescript)',
                                     'nyxpay.compact line 416 char 1',
                                     'Bytes<32>',
                                     max_defaults_allowed_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_1.toValue(credit_identity_0).concat(_descriptor_1.toValue(on_time_threshold_0).concat(_descriptor_1.toValue(max_defaults_allowed_0))),
            alignment: _descriptor_1.alignment().concat(_descriptor_1.alignment().concat(_descriptor_1.alignment()))
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._prove_credit_standing_0(context,
                                                       partialProofData,
                                                       credit_identity_0,
                                                       on_time_threshold_0,
                                                       max_defaults_allowed_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      prove_pool_solvency: (...args_1) => {
        if (args_1.length !== 3) {
          throw new __compactRuntime.CompactError(`prove_pool_solvency: expected 3 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const pool_commitment_0 = args_1[1];
        const coverage_ok_0 = args_1[2];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('prove_pool_solvency',
                                     'argument 1 (as invoked from Typescript)',
                                     'nyxpay.compact line 453 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(pool_commitment_0.buffer instanceof ArrayBuffer && pool_commitment_0.BYTES_PER_ELEMENT === 1 && pool_commitment_0.length === 32)) {
          __compactRuntime.typeError('prove_pool_solvency',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'nyxpay.compact line 453 char 1',
                                     'Bytes<32>',
                                     pool_commitment_0)
        }
        if (!(coverage_ok_0.buffer instanceof ArrayBuffer && coverage_ok_0.BYTES_PER_ELEMENT === 1 && coverage_ok_0.length === 32)) {
          __compactRuntime.typeError('prove_pool_solvency',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'nyxpay.compact line 453 char 1',
                                     'Bytes<32>',
                                     coverage_ok_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_1.toValue(pool_commitment_0).concat(_descriptor_1.toValue(coverage_ok_0)),
            alignment: _descriptor_1.alignment().concat(_descriptor_1.alignment())
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._prove_pool_solvency_0(context,
                                                     partialProofData,
                                                     pool_commitment_0,
                                                     coverage_ok_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      }
    };
    this.impureCircuits = {
      publish_kyc_root: this.circuits.publish_kyc_root,
      publish_settlement_anchor: this.circuits.publish_settlement_anchor,
      publish_kyc_leaf: this.circuits.publish_kyc_leaf,
      prove_kyc_membership: this.circuits.prove_kyc_membership,
      prove_recipient_valid: this.circuits.prove_recipient_valid,
      prove_policy_update: this.circuits.prove_policy_update,
      prove_spend_update: this.circuits.prove_spend_update,
      prove_credit_update: this.circuits.prove_credit_update,
      prove_session_auth: this.circuits.prove_session_auth,
      prove_authorized_transaction: this.circuits.prove_authorized_transaction,
      prove_collateral_lock: this.circuits.prove_collateral_lock,
      prove_pool_deposit: this.circuits.prove_pool_deposit,
      prove_loan_repayment: this.circuits.prove_loan_repayment,
      prove_credit_standing: this.circuits.prove_credit_standing,
      prove_pool_solvency: this.circuits.prove_pool_solvency
    };
    this.provableCircuits = {
      publish_kyc_root: this.circuits.publish_kyc_root,
      publish_settlement_anchor: this.circuits.publish_settlement_anchor,
      publish_kyc_leaf: this.circuits.publish_kyc_leaf,
      prove_kyc_membership: this.circuits.prove_kyc_membership,
      prove_recipient_valid: this.circuits.prove_recipient_valid,
      prove_policy_update: this.circuits.prove_policy_update,
      prove_spend_update: this.circuits.prove_spend_update,
      prove_credit_update: this.circuits.prove_credit_update,
      prove_session_auth: this.circuits.prove_session_auth,
      prove_authorized_transaction: this.circuits.prove_authorized_transaction,
      prove_collateral_lock: this.circuits.prove_collateral_lock,
      prove_pool_deposit: this.circuits.prove_pool_deposit,
      prove_loan_repayment: this.circuits.prove_loan_repayment,
      prove_credit_standing: this.circuits.prove_credit_standing,
      prove_pool_solvency: this.circuits.prove_pool_solvency
    };
  }
  initialState(...args_0) {
    if (args_0.length !== 1) {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 1 argument (as invoked from Typescript), received ${args_0.length}`);
    }
    const constructorContext_0 = args_0[0];
    if (typeof(constructorContext_0) !== 'object') {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'constructorContext' in argument 1 (as invoked from Typescript) to be an object`);
    }
    if (!('initialPrivateState' in constructorContext_0)) {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'initialPrivateState' in argument 1 (as invoked from Typescript)`);
    }
    if (!('initialZswapLocalState' in constructorContext_0)) {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'initialZswapLocalState' in argument 1 (as invoked from Typescript)`);
    }
    if (typeof(constructorContext_0.initialZswapLocalState) !== 'object') {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'initialZswapLocalState' in argument 1 (as invoked from Typescript) to be an object`);
    }
    const state_0 = new __compactRuntime.ContractState();
    let stateValue_0 = __compactRuntime.StateValue.newArray();
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    state_0.data = new __compactRuntime.ChargedState(stateValue_0);
    state_0.setOperation('publish_kyc_root', new __compactRuntime.ContractOperation());
    state_0.setOperation('publish_settlement_anchor', new __compactRuntime.ContractOperation());
    state_0.setOperation('publish_kyc_leaf', new __compactRuntime.ContractOperation());
    state_0.setOperation('prove_kyc_membership', new __compactRuntime.ContractOperation());
    state_0.setOperation('prove_recipient_valid', new __compactRuntime.ContractOperation());
    state_0.setOperation('prove_policy_update', new __compactRuntime.ContractOperation());
    state_0.setOperation('prove_spend_update', new __compactRuntime.ContractOperation());
    state_0.setOperation('prove_credit_update', new __compactRuntime.ContractOperation());
    state_0.setOperation('prove_session_auth', new __compactRuntime.ContractOperation());
    state_0.setOperation('prove_authorized_transaction', new __compactRuntime.ContractOperation());
    state_0.setOperation('prove_collateral_lock', new __compactRuntime.ContractOperation());
    state_0.setOperation('prove_pool_deposit', new __compactRuntime.ContractOperation());
    state_0.setOperation('prove_loan_repayment', new __compactRuntime.ContractOperation());
    state_0.setOperation('prove_credit_standing', new __compactRuntime.ContractOperation());
    state_0.setOperation('prove_pool_solvency', new __compactRuntime.ContractOperation());
    const context = __compactRuntime.createCircuitContext(__compactRuntime.dummyContractAddress(), constructorContext_0.initialZswapLocalState.coinPublicKey, state_0.data, constructorContext_0.initialPrivateState);
    const partialProofData = {
      input: { value: [], alignment: [] },
      output: undefined,
      publicTranscript: [],
      privateTranscriptOutputs: []
    };
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_19.toValue(0n),
                                                                                              alignment: _descriptor_19.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(new Uint8Array(32)),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_19.toValue(1n),
                                                                                              alignment: _descriptor_19.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newArray()
                                                          .arrayPush(__compactRuntime.StateValue.newBoundedMerkleTree(
                                                                       new __compactRuntime.StateBoundedMerkleTree(16)
                                                                     )).arrayPush(__compactRuntime.StateValue.newCell({ value: _descriptor_15.toValue(0n),
                                                                                                                        alignment: _descriptor_15.alignment() })).arrayPush(__compactRuntime.StateValue.newMap(
                                                                                                                                                                              new __compactRuntime.StateMap()
                                                                                                                                                                            ))
                                                          .encode() } },
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_19.toValue(2n),
                                                                  alignment: _descriptor_19.alignment() } }] } },
                                       { dup: { n: 2 } },
                                       { idx: { cached: false,
                                                pushPath: false,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_19.toValue(0n),
                                                                  alignment: _descriptor_19.alignment() } }] } },
                                       'root',
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newNull().encode() } },
                                       { ins: { cached: true, n: 2 } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_19.toValue(2n),
                                                                                              alignment: _descriptor_19.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_15.toValue(0n),
                                                                                              alignment: _descriptor_15.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_19.toValue(3n),
                                                                                              alignment: _descriptor_19.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_15.toValue(0n),
                                                                                              alignment: _descriptor_15.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_19.toValue(4n),
                                                                                              alignment: _descriptor_19.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_15.toValue(0n),
                                                                                              alignment: _descriptor_15.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_19.toValue(5n),
                                                                                              alignment: _descriptor_19.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_15.toValue(0n),
                                                                                              alignment: _descriptor_15.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_19.toValue(6n),
                                                                                              alignment: _descriptor_19.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_15.toValue(0n),
                                                                                              alignment: _descriptor_15.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_19.toValue(7n),
                                                                                              alignment: _descriptor_19.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_15.toValue(0n),
                                                                                              alignment: _descriptor_15.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_19.toValue(8n),
                                                                                              alignment: _descriptor_19.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_15.toValue(0n),
                                                                                              alignment: _descriptor_15.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_19.toValue(9n),
                                                                                              alignment: _descriptor_19.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_15.toValue(0n),
                                                                                              alignment: _descriptor_15.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_19.toValue(10n),
                                                                                              alignment: _descriptor_19.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_15.toValue(0n),
                                                                                              alignment: _descriptor_15.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_19.toValue(11n),
                                                                                              alignment: _descriptor_19.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_15.toValue(0n),
                                                                                              alignment: _descriptor_15.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_19.toValue(12n),
                                                                                              alignment: _descriptor_19.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_15.toValue(0n),
                                                                                              alignment: _descriptor_15.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_19.toValue(13n),
                                                                                              alignment: _descriptor_19.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_15.toValue(0n),
                                                                                              alignment: _descriptor_15.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    state_0.data = new __compactRuntime.ChargedState(context.currentQueryContext.state.state);
    return {
      currentContractState: state_0,
      currentPrivateState: context.currentPrivateState,
      currentZswapLocalState: context.currentZswapLocalState
    }
  }
  _merkleTreePathRoot_0(path_0) {
    return { field:
               this._folder_0((...args_0) =>
                                this._merkleTreePathEntryRoot_0(...args_0),
                              this._degradeToTransient_0(this._persistentHash_1({ domain_sep:
                                                                                    new Uint8Array([109, 100, 110, 58, 108, 104]),
                                                                                  data:
                                                                                    path_0.leaf })),
                              path_0.path) };
  }
  _merkleTreePathEntryRoot_0(recursiveDigest_0, entry_0) {
    const left_0 = entry_0.goes_left ? recursiveDigest_0 : entry_0.sibling.field;
    const right_0 = entry_0.goes_left ?
                    entry_0.sibling.field :
                    recursiveDigest_0;
    return this._transientHash_0([left_0, right_0]);
  }
  _transientHash_0(value_0) {
    const result_0 = __compactRuntime.transientHash(_descriptor_13, value_0);
    return result_0;
  }
  _persistentHash_0(value_0) {
    const result_0 = __compactRuntime.persistentHash(_descriptor_14, value_0);
    return result_0;
  }
  _persistentHash_1(value_0) {
    const result_0 = __compactRuntime.persistentHash(_descriptor_11, value_0);
    return result_0;
  }
  _persistentHash_2(value_0) {
    const result_0 = __compactRuntime.persistentHash(_descriptor_12, value_0);
    return result_0;
  }
  _persistentHash_3(value_0) {
    const result_0 = __compactRuntime.persistentHash(_descriptor_8, value_0);
    return result_0;
  }
  _persistentHash_4(value_0) {
    const result_0 = __compactRuntime.persistentHash(_descriptor_9, value_0);
    return result_0;
  }
  _persistentCommit_0(value_0, rand_0) {
    const result_0 = __compactRuntime.persistentCommit(_descriptor_2,
                                                       value_0,
                                                       rand_0);
    return result_0;
  }
  _degradeToTransient_0(x_0) {
    const result_0 = __compactRuntime.degradeToTransient(x_0);
    return result_0;
  }
  _localSecretKey_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.localSecretKey(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(result_0.buffer instanceof ArrayBuffer && result_0.BYTES_PER_ELEMENT === 1 && result_0.length === 32)) {
      __compactRuntime.typeError('localSecretKey',
                                 'return value',
                                 'nyxpay.compact line 23 char 1',
                                 'Bytes<32>',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_1.toValue(result_0),
      alignment: _descriptor_1.alignment()
    });
    return result_0;
  }
  _kycMembershipPath_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.kycMembershipPath(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(typeof(result_0) === 'object' && result_0.leaf.buffer instanceof ArrayBuffer && result_0.leaf.BYTES_PER_ELEMENT === 1 && result_0.leaf.length === 32 && Array.isArray(result_0.path) && result_0.path.length === 16 && result_0.path.every((t) => typeof(t) === 'object' && typeof(t.sibling) === 'object' && typeof(t.sibling.field) === 'bigint' && t.sibling.field >= 0 && t.sibling.field <= __compactRuntime.MAX_FIELD && typeof(t.goes_left) === 'boolean'))) {
      __compactRuntime.typeError('kycMembershipPath',
                                 'return value',
                                 'nyxpay.compact line 24 char 1',
                                 'struct MerkleTreePath<leaf: Bytes<32>, path: Vector<16, struct MerkleTreePathEntry<sibling: struct MerkleTreeDigest<field: Field>, goes_left: Boolean>>>',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_7.toValue(result_0),
      alignment: _descriptor_7.alignment()
    });
    return result_0;
  }
  _spendOldBalance_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.spendOldBalance(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(typeof(result_0) === 'bigint' && result_0 >= 0 && result_0 <= __compactRuntime.MAX_FIELD)) {
      __compactRuntime.typeError('spendOldBalance',
                                 'return value',
                                 'nyxpay.compact line 26 char 1',
                                 'Field',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_2.toValue(result_0),
      alignment: _descriptor_2.alignment()
    });
    return result_0;
  }
  _spendAmount_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.spendAmount(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(typeof(result_0) === 'bigint' && result_0 >= 0 && result_0 <= __compactRuntime.MAX_FIELD)) {
      __compactRuntime.typeError('spendAmount',
                                 'return value',
                                 'nyxpay.compact line 27 char 1',
                                 'Field',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_2.toValue(result_0),
      alignment: _descriptor_2.alignment()
    });
    return result_0;
  }
  _spendOldOpening_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.spendOldOpening(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(result_0.buffer instanceof ArrayBuffer && result_0.BYTES_PER_ELEMENT === 1 && result_0.length === 32)) {
      __compactRuntime.typeError('spendOldOpening',
                                 'return value',
                                 'nyxpay.compact line 28 char 1',
                                 'Bytes<32>',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_1.toValue(result_0),
      alignment: _descriptor_1.alignment()
    });
    return result_0;
  }
  _spendNewOpening_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.spendNewOpening(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(result_0.buffer instanceof ArrayBuffer && result_0.BYTES_PER_ELEMENT === 1 && result_0.length === 32)) {
      __compactRuntime.typeError('spendNewOpening',
                                 'return value',
                                 'nyxpay.compact line 29 char 1',
                                 'Bytes<32>',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_1.toValue(result_0),
      alignment: _descriptor_1.alignment()
    });
    return result_0;
  }
  _creditOldBalance_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.creditOldBalance(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(typeof(result_0) === 'bigint' && result_0 >= 0 && result_0 <= __compactRuntime.MAX_FIELD)) {
      __compactRuntime.typeError('creditOldBalance',
                                 'return value',
                                 'nyxpay.compact line 31 char 1',
                                 'Field',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_2.toValue(result_0),
      alignment: _descriptor_2.alignment()
    });
    return result_0;
  }
  _creditAmount_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.creditAmount(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(typeof(result_0) === 'bigint' && result_0 >= 0 && result_0 <= __compactRuntime.MAX_FIELD)) {
      __compactRuntime.typeError('creditAmount',
                                 'return value',
                                 'nyxpay.compact line 32 char 1',
                                 'Field',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_2.toValue(result_0),
      alignment: _descriptor_2.alignment()
    });
    return result_0;
  }
  _creditOldOpening_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.creditOldOpening(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(result_0.buffer instanceof ArrayBuffer && result_0.BYTES_PER_ELEMENT === 1 && result_0.length === 32)) {
      __compactRuntime.typeError('creditOldOpening',
                                 'return value',
                                 'nyxpay.compact line 33 char 1',
                                 'Bytes<32>',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_1.toValue(result_0),
      alignment: _descriptor_1.alignment()
    });
    return result_0;
  }
  _creditNewOpening_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.creditNewOpening(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(result_0.buffer instanceof ArrayBuffer && result_0.BYTES_PER_ELEMENT === 1 && result_0.length === 32)) {
      __compactRuntime.typeError('creditNewOpening',
                                 'return value',
                                 'nyxpay.compact line 34 char 1',
                                 'Bytes<32>',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_1.toValue(result_0),
      alignment: _descriptor_1.alignment()
    });
    return result_0;
  }
  _policyAmount_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.policyAmount(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(typeof(result_0) === 'bigint' && result_0 >= 0 && result_0 <= __compactRuntime.MAX_FIELD)) {
      __compactRuntime.typeError('policyAmount',
                                 'return value',
                                 'nyxpay.compact line 37 char 1',
                                 'Field',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_2.toValue(result_0),
      alignment: _descriptor_2.alignment()
    });
    return result_0;
  }
  _lockOldBalance_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.lockOldBalance(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(typeof(result_0) === 'bigint' && result_0 >= 0 && result_0 <= __compactRuntime.MAX_FIELD)) {
      __compactRuntime.typeError('lockOldBalance',
                                 'return value',
                                 'nyxpay.compact line 46 char 1',
                                 'Field',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_2.toValue(result_0),
      alignment: _descriptor_2.alignment()
    });
    return result_0;
  }
  _lockCollateralAmount_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.lockCollateralAmount(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(typeof(result_0) === 'bigint' && result_0 >= 0 && result_0 <= __compactRuntime.MAX_FIELD)) {
      __compactRuntime.typeError('lockCollateralAmount',
                                 'return value',
                                 'nyxpay.compact line 47 char 1',
                                 'Field',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_2.toValue(result_0),
      alignment: _descriptor_2.alignment()
    });
    return result_0;
  }
  _lockLoanAmount_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.lockLoanAmount(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(typeof(result_0) === 'bigint' && result_0 >= 0 && result_0 <= __compactRuntime.MAX_FIELD)) {
      __compactRuntime.typeError('lockLoanAmount',
                                 'return value',
                                 'nyxpay.compact line 48 char 1',
                                 'Field',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_2.toValue(result_0),
      alignment: _descriptor_2.alignment()
    });
    return result_0;
  }
  _lockOldOpening_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.lockOldOpening(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(result_0.buffer instanceof ArrayBuffer && result_0.BYTES_PER_ELEMENT === 1 && result_0.length === 32)) {
      __compactRuntime.typeError('lockOldOpening',
                                 'return value',
                                 'nyxpay.compact line 49 char 1',
                                 'Bytes<32>',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_1.toValue(result_0),
      alignment: _descriptor_1.alignment()
    });
    return result_0;
  }
  _lockNewOpening_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.lockNewOpening(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(result_0.buffer instanceof ArrayBuffer && result_0.BYTES_PER_ELEMENT === 1 && result_0.length === 32)) {
      __compactRuntime.typeError('lockNewOpening',
                                 'return value',
                                 'nyxpay.compact line 50 char 1',
                                 'Bytes<32>',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_1.toValue(result_0),
      alignment: _descriptor_1.alignment()
    });
    return result_0;
  }
  _lockCollateralOpening_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.lockCollateralOpening(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(result_0.buffer instanceof ArrayBuffer && result_0.BYTES_PER_ELEMENT === 1 && result_0.length === 32)) {
      __compactRuntime.typeError('lockCollateralOpening',
                                 'return value',
                                 'nyxpay.compact line 51 char 1',
                                 'Bytes<32>',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_1.toValue(result_0),
      alignment: _descriptor_1.alignment()
    });
    return result_0;
  }
  _poolOldTotal_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.poolOldTotal(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(typeof(result_0) === 'bigint' && result_0 >= 0 && result_0 <= __compactRuntime.MAX_FIELD)) {
      __compactRuntime.typeError('poolOldTotal',
                                 'return value',
                                 'nyxpay.compact line 53 char 1',
                                 'Field',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_2.toValue(result_0),
      alignment: _descriptor_2.alignment()
    });
    return result_0;
  }
  _poolDepositAmount_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.poolDepositAmount(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(typeof(result_0) === 'bigint' && result_0 >= 0 && result_0 <= __compactRuntime.MAX_FIELD)) {
      __compactRuntime.typeError('poolDepositAmount',
                                 'return value',
                                 'nyxpay.compact line 54 char 1',
                                 'Field',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_2.toValue(result_0),
      alignment: _descriptor_2.alignment()
    });
    return result_0;
  }
  _poolOldOpening_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.poolOldOpening(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(result_0.buffer instanceof ArrayBuffer && result_0.BYTES_PER_ELEMENT === 1 && result_0.length === 32)) {
      __compactRuntime.typeError('poolOldOpening',
                                 'return value',
                                 'nyxpay.compact line 55 char 1',
                                 'Bytes<32>',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_1.toValue(result_0),
      alignment: _descriptor_1.alignment()
    });
    return result_0;
  }
  _poolNewOpening_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.poolNewOpening(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(result_0.buffer instanceof ArrayBuffer && result_0.BYTES_PER_ELEMENT === 1 && result_0.length === 32)) {
      __compactRuntime.typeError('poolNewOpening',
                                 'return value',
                                 'nyxpay.compact line 56 char 1',
                                 'Bytes<32>',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_1.toValue(result_0),
      alignment: _descriptor_1.alignment()
    });
    return result_0;
  }
  _poolLenderOldBalance_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.poolLenderOldBalance(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(typeof(result_0) === 'bigint' && result_0 >= 0 && result_0 <= __compactRuntime.MAX_FIELD)) {
      __compactRuntime.typeError('poolLenderOldBalance',
                                 'return value',
                                 'nyxpay.compact line 57 char 1',
                                 'Field',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_2.toValue(result_0),
      alignment: _descriptor_2.alignment()
    });
    return result_0;
  }
  _poolLenderNewOpening_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.poolLenderNewOpening(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(result_0.buffer instanceof ArrayBuffer && result_0.BYTES_PER_ELEMENT === 1 && result_0.length === 32)) {
      __compactRuntime.typeError('poolLenderNewOpening',
                                 'return value',
                                 'nyxpay.compact line 58 char 1',
                                 'Bytes<32>',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_1.toValue(result_0),
      alignment: _descriptor_1.alignment()
    });
    return result_0;
  }
  _poolLenderOldOpening_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.poolLenderOldOpening(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(result_0.buffer instanceof ArrayBuffer && result_0.BYTES_PER_ELEMENT === 1 && result_0.length === 32)) {
      __compactRuntime.typeError('poolLenderOldOpening',
                                 'return value',
                                 'nyxpay.compact line 59 char 1',
                                 'Bytes<32>',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_1.toValue(result_0),
      alignment: _descriptor_1.alignment()
    });
    return result_0;
  }
  _repayInstallmentAmount_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.repayInstallmentAmount(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(typeof(result_0) === 'bigint' && result_0 >= 0 && result_0 <= __compactRuntime.MAX_FIELD)) {
      __compactRuntime.typeError('repayInstallmentAmount',
                                 'return value',
                                 'nyxpay.compact line 61 char 1',
                                 'Field',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_2.toValue(result_0),
      alignment: _descriptor_2.alignment()
    });
    return result_0;
  }
  _repayRemainingOld_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.repayRemainingOld(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(typeof(result_0) === 'bigint' && result_0 >= 0 && result_0 <= __compactRuntime.MAX_FIELD)) {
      __compactRuntime.typeError('repayRemainingOld',
                                 'return value',
                                 'nyxpay.compact line 62 char 1',
                                 'Field',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_2.toValue(result_0),
      alignment: _descriptor_2.alignment()
    });
    return result_0;
  }
  _repayRemainingNew_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.repayRemainingNew(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(typeof(result_0) === 'bigint' && result_0 >= 0 && result_0 <= __compactRuntime.MAX_FIELD)) {
      __compactRuntime.typeError('repayRemainingNew',
                                 'return value',
                                 'nyxpay.compact line 63 char 1',
                                 'Field',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_2.toValue(result_0),
      alignment: _descriptor_2.alignment()
    });
    return result_0;
  }
  _standingOnTimeCount_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.standingOnTimeCount(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(typeof(result_0) === 'bigint' && result_0 >= 0 && result_0 <= __compactRuntime.MAX_FIELD)) {
      __compactRuntime.typeError('standingOnTimeCount',
                                 'return value',
                                 'nyxpay.compact line 65 char 1',
                                 'Field',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_2.toValue(result_0),
      alignment: _descriptor_2.alignment()
    });
    return result_0;
  }
  _standingDefaultCount_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.standingDefaultCount(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(typeof(result_0) === 'bigint' && result_0 >= 0 && result_0 <= __compactRuntime.MAX_FIELD)) {
      __compactRuntime.typeError('standingDefaultCount',
                                 'return value',
                                 'nyxpay.compact line 66 char 1',
                                 'Field',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_2.toValue(result_0),
      alignment: _descriptor_2.alignment()
    });
    return result_0;
  }
  _standingOnTimeThreshold_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.standingOnTimeThreshold(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(typeof(result_0) === 'bigint' && result_0 >= 0 && result_0 <= __compactRuntime.MAX_FIELD)) {
      __compactRuntime.typeError('standingOnTimeThreshold',
                                 'return value',
                                 'nyxpay.compact line 67 char 1',
                                 'Field',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_2.toValue(result_0),
      alignment: _descriptor_2.alignment()
    });
    return result_0;
  }
  _standingMaxDefaults_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.standingMaxDefaults(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(typeof(result_0) === 'bigint' && result_0 >= 0 && result_0 <= __compactRuntime.MAX_FIELD)) {
      __compactRuntime.typeError('standingMaxDefaults',
                                 'return value',
                                 'nyxpay.compact line 68 char 1',
                                 'Field',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_2.toValue(result_0),
      alignment: _descriptor_2.alignment()
    });
    return result_0;
  }
  _standingThrOpening_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.standingThrOpening(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(result_0.buffer instanceof ArrayBuffer && result_0.BYTES_PER_ELEMENT === 1 && result_0.length === 32)) {
      __compactRuntime.typeError('standingThrOpening',
                                 'return value',
                                 'nyxpay.compact line 69 char 1',
                                 'Bytes<32>',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_1.toValue(result_0),
      alignment: _descriptor_1.alignment()
    });
    return result_0;
  }
  _standingMaxDefOpening_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.standingMaxDefOpening(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(result_0.buffer instanceof ArrayBuffer && result_0.BYTES_PER_ELEMENT === 1 && result_0.length === 32)) {
      __compactRuntime.typeError('standingMaxDefOpening',
                                 'return value',
                                 'nyxpay.compact line 70 char 1',
                                 'Bytes<32>',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_1.toValue(result_0),
      alignment: _descriptor_1.alignment()
    });
    return result_0;
  }
  _publish_kyc_root_0(context, partialProofData, root_0) {
    __compactRuntime.assert(!this._equal_0(root_0,
                                           new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
                            'empty KYC root');
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_19.toValue(0n),
                                                                                              alignment: _descriptor_19.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(root_0),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    return [];
  }
  _publish_settlement_anchor_0(context, partialProofData, settlement_id_0) {
    __compactRuntime.assert(!this._equal_1(settlement_id_0,
                                           new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
                            'empty settlement id');
    const bind_0 = this._persistentHash_0([new Uint8Array([99, 105, 114, 99, 108, 101, 100, 58, 115, 101, 116, 116, 108, 101, 58, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
                                           settlement_id_0]);
    __compactRuntime.assert(!this._equal_2(bind_0,
                                           new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
                            'settlement bind failed');
    const tmp_0 = 1n;
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_19.toValue(8n),
                                                                  alignment: _descriptor_19.alignment() } }] } },
                                       { addi: { immediate: parseInt(__compactRuntime.valueToBigInt(
                                                              { value: _descriptor_0.toValue(tmp_0),
                                                                alignment: _descriptor_0.alignment() }
                                                                .value
                                                            )) } },
                                       { ins: { cached: true, n: 1 } }]);
    return [];
  }
  _publish_kyc_leaf_0(context, partialProofData, leaf_0) {
    __compactRuntime.assert(!this._equal_3(leaf_0,
                                           new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
                            'empty KYC leaf');
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_19.toValue(1n),
                                                                  alignment: _descriptor_19.alignment() } }] } },
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_19.toValue(0n),
                                                                  alignment: _descriptor_19.alignment() } }] } },
                                       { dup: { n: 2 } },
                                       { idx: { cached: false,
                                                pushPath: false,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_19.toValue(1n),
                                                                  alignment: _descriptor_19.alignment() } }] } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell(__compactRuntime.leafHash(
                                                                                              { value: _descriptor_1.toValue(leaf_0),
                                                                                                alignment: _descriptor_1.alignment() }
                                                                                            )).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } },
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_19.toValue(1n),
                                                                  alignment: _descriptor_19.alignment() } }] } },
                                       { addi: { immediate: 1 } },
                                       { ins: { cached: true, n: 1 } },
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_19.toValue(2n),
                                                                  alignment: _descriptor_19.alignment() } }] } },
                                       { dup: { n: 2 } },
                                       { idx: { cached: false,
                                                pushPath: false,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_19.toValue(0n),
                                                                  alignment: _descriptor_19.alignment() } }] } },
                                       'root',
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newNull().encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 2 } }]);
    return [];
  }
  _prove_kyc_membership_0(context, partialProofData, leaf_0, root_0) {
    __compactRuntime.assert(this._equal_4(root_0,
                                          _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                                    partialProofData,
                                                                                                    [
                                                                                                     { dup: { n: 0 } },
                                                                                                     { idx: { cached: false,
                                                                                                              pushPath: false,
                                                                                                              path: [
                                                                                                                     { tag: 'value',
                                                                                                                       value: { value: _descriptor_19.toValue(0n),
                                                                                                                                alignment: _descriptor_19.alignment() } }] } },
                                                                                                     { popeq: { cached: false,
                                                                                                                result: undefined } }]).value)),
                            'KYC root mismatch');
    __compactRuntime.assert(!this._equal_5(leaf_0,
                                           new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
                            'empty KYC leaf');
    const path_0 = this._kycMembershipPath_0(context, partialProofData);
    __compactRuntime.assert(this._equal_6(path_0.leaf, leaf_0),
                            'path leaf mismatch');
    const digest_0 = this._merkleTreePathRoot_0(path_0);
    __compactRuntime.assert(_descriptor_4.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                      partialProofData,
                                                                                      [
                                                                                       { dup: { n: 0 } },
                                                                                       { idx: { cached: false,
                                                                                                pushPath: false,
                                                                                                path: [
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_19.toValue(1n),
                                                                                                                  alignment: _descriptor_19.alignment() } }] } },
                                                                                       { idx: { cached: false,
                                                                                                pushPath: false,
                                                                                                path: [
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_19.toValue(2n),
                                                                                                                  alignment: _descriptor_19.alignment() } }] } },
                                                                                       { push: { storage: false,
                                                                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_3.toValue(digest_0),
                                                                                                                                              alignment: _descriptor_3.alignment() }).encode() } },
                                                                                       'member',
                                                                                       { popeq: { cached: true,
                                                                                                  result: undefined } }]).value),
                            'merkle membership invalid');
    return [];
  }
  _prove_recipient_valid_0(context,
                           partialProofData,
                           leaf_0,
                           root_0,
                           contact_commitment_0)
  {
    this._prove_kyc_membership_0(context, partialProofData, leaf_0, root_0);
    __compactRuntime.assert(!this._equal_7(contact_commitment_0,
                                           new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
                            'empty contact commitment');
    const bind_0 = this._persistentHash_4([new Uint8Array([99, 105, 114, 99, 108, 101, 100, 58, 114, 101, 99, 105, 112, 105, 101, 110, 116, 58, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
                                           leaf_0,
                                           contact_commitment_0]);
    __compactRuntime.assert(!this._equal_8(bind_0,
                                           new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
                            'recipient bind failed');
    return [];
  }
  _prove_policy_update_0(context,
                         partialProofData,
                         old_policy_commitment_0,
                         new_policy_commitment_0)
  {
    __compactRuntime.assert(!this._equal_9(old_policy_commitment_0,
                                           new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
                            'missing policy');
    __compactRuntime.assert(!this._equal_10(new_policy_commitment_0,
                                            new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
                            'missing new policy');
    __compactRuntime.assert(!this._equal_11(old_policy_commitment_0,
                                            new_policy_commitment_0),
                            'unchanged policy');
    const amount_0 = this._policyAmount_0(context, partialProofData);
    let t_0;
    __compactRuntime.assert((t_0 = ((t1) => {
                                     if (t1 > 18446744073709551615n) {
                                       throw new __compactRuntime.CompactError('nyxpay.compact line 140 char 10: cast from Field or Uint value to smaller Uint value failed: ' + t1 + ' is greater than 18446744073709551615');
                                     }
                                     return t1;
                                   })(amount_0),
                             t_0 > 0n),
                            'amount must be positive');
    const bind_0 = this._persistentHash_4([new Uint8Array([99, 105, 114, 99, 108, 101, 100, 58, 112, 111, 108, 105, 99, 121, 58, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
                                           old_policy_commitment_0,
                                           new_policy_commitment_0]);
    __compactRuntime.assert(!this._equal_12(bind_0,
                                            new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
                            'policy bind failed');
    const tmp_0 = 1n;
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_19.toValue(7n),
                                                                  alignment: _descriptor_19.alignment() } }] } },
                                       { addi: { immediate: parseInt(__compactRuntime.valueToBigInt(
                                                              { value: _descriptor_0.toValue(tmp_0),
                                                                alignment: _descriptor_0.alignment() }
                                                                .value
                                                            )) } },
                                       { ins: { cached: true, n: 1 } }]);
    return [];
  }
  _prove_spend_update_0(context,
                        partialProofData,
                        old_balance_commitment_0,
                        new_balance_commitment_0,
                        recipient_proof_digest_0)
  {
    const old_bal_0 = this._spendOldBalance_0(context, partialProofData);
    const amount_0 = this._spendAmount_0(context, partialProofData);
    const old_open_0 = this._spendOldOpening_0(context, partialProofData);
    const new_open_0 = this._spendNewOpening_0(context, partialProofData);
    let t_0;
    __compactRuntime.assert((t_0 = ((t1) => {
                                     if (t1 > 18446744073709551615n) {
                                       throw new __compactRuntime.CompactError('nyxpay.compact line 163 char 10: cast from Field or Uint value to smaller Uint value failed: ' + t1 + ' is greater than 18446744073709551615');
                                     }
                                     return t1;
                                   })(amount_0),
                             t_0 > 0n),
                            'amount must be positive');
    let t_1;
    __compactRuntime.assert((t_1 = ((t1) => {
                                     if (t1 > 18446744073709551615n) {
                                       throw new __compactRuntime.CompactError('nyxpay.compact line 164 char 10: cast from Field or Uint value to smaller Uint value failed: ' + t1 + ' is greater than 18446744073709551615');
                                     }
                                     return t1;
                                   })(old_bal_0),
                             t_1
                             >=
                             ((t1) => {
                               if (t1 > 18446744073709551615n) {
                                 throw new __compactRuntime.CompactError('nyxpay.compact line 164 char 33: cast from Field or Uint value to smaller Uint value failed: ' + t1 + ' is greater than 18446744073709551615');
                               }
                               return t1;
                             })(amount_0)),
                            'insufficient balance');
    __compactRuntime.assert(this._equal_13(this._persistentCommit_0(old_bal_0,
                                                                    old_open_0),
                                           old_balance_commitment_0),
                            'old balance commitment mismatch');
    const new_bal_0 = __compactRuntime.subField(old_bal_0, amount_0);
    __compactRuntime.assert(this._equal_14(this._persistentCommit_0(new_bal_0,
                                                                    new_open_0),
                                           new_balance_commitment_0),
                            'new balance commitment mismatch');
    __compactRuntime.assert(!this._equal_15(old_balance_commitment_0,
                                            new_balance_commitment_0),
                            'no state change');
    __compactRuntime.assert(!this._equal_16(recipient_proof_digest_0,
                                            new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
                            'empty recipient digest');
    const bind_0 = this._persistentHash_3([new Uint8Array([99, 105, 114, 99, 108, 101, 100, 58, 115, 112, 101, 110, 100, 58, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
                                           old_balance_commitment_0,
                                           new_balance_commitment_0,
                                           recipient_proof_digest_0]);
    __compactRuntime.assert(!this._equal_17(bind_0,
                                            new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
                            'spend bind failed');
    const tmp_0 = 1n;
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_19.toValue(2n),
                                                                  alignment: _descriptor_19.alignment() } }] } },
                                       { addi: { immediate: parseInt(__compactRuntime.valueToBigInt(
                                                              { value: _descriptor_0.toValue(tmp_0),
                                                                alignment: _descriptor_0.alignment() }
                                                                .value
                                                            )) } },
                                       { ins: { cached: true, n: 1 } }]);
    const tmp_1 = 1n;
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_19.toValue(4n),
                                                                  alignment: _descriptor_19.alignment() } }] } },
                                       { addi: { immediate: parseInt(__compactRuntime.valueToBigInt(
                                                              { value: _descriptor_0.toValue(tmp_1),
                                                                alignment: _descriptor_0.alignment() }
                                                                .value
                                                            )) } },
                                       { ins: { cached: true, n: 1 } }]);
    return [];
  }
  _prove_credit_update_0(context,
                         partialProofData,
                         old_balance_commitment_0,
                         new_balance_commitment_0,
                         inbound_proof_digest_0)
  {
    const old_bal_0 = this._creditOldBalance_0(context, partialProofData);
    const amount_0 = this._creditAmount_0(context, partialProofData);
    const old_open_0 = this._creditOldOpening_0(context, partialProofData);
    const new_open_0 = this._creditNewOpening_0(context, partialProofData);
    let t_0;
    __compactRuntime.assert((t_0 = ((t1) => {
                                     if (t1 > 18446744073709551615n) {
                                       throw new __compactRuntime.CompactError('nyxpay.compact line 201 char 10: cast from Field or Uint value to smaller Uint value failed: ' + t1 + ' is greater than 18446744073709551615');
                                     }
                                     return t1;
                                   })(amount_0),
                             t_0 > 0n),
                            'credit amount must be positive');
    __compactRuntime.assert(this._equal_18(this._persistentCommit_0(old_bal_0,
                                                                    old_open_0),
                                           old_balance_commitment_0),
                            'old balance commitment mismatch');
    const new_bal_0 = __compactRuntime.addField(old_bal_0, amount_0);
    let t_1;
    __compactRuntime.assert((t_1 = ((t1) => {
                                     if (t1 > 18446744073709551615n) {
                                       throw new __compactRuntime.CompactError('nyxpay.compact line 207 char 10: cast from Field or Uint value to smaller Uint value failed: ' + t1 + ' is greater than 18446744073709551615');
                                     }
                                     return t1;
                                   })(new_bal_0),
                             t_1
                             >=
                             ((t1) => {
                               if (t1 > 18446744073709551615n) {
                                 throw new __compactRuntime.CompactError('nyxpay.compact line 207 char 33: cast from Field or Uint value to smaller Uint value failed: ' + t1 + ' is greater than 18446744073709551615');
                               }
                               return t1;
                             })(old_bal_0)),
                            'credit overflow');
    __compactRuntime.assert(this._equal_19(this._persistentCommit_0(new_bal_0,
                                                                    new_open_0),
                                           new_balance_commitment_0),
                            'new balance commitment mismatch');
    __compactRuntime.assert(!this._equal_20(inbound_proof_digest_0,
                                            new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
                            'empty inbound digest');
    const bind_0 = this._persistentHash_3([new Uint8Array([99, 105, 114, 99, 108, 101, 100, 58, 99, 114, 101, 100, 105, 116, 58, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
                                           old_balance_commitment_0,
                                           new_balance_commitment_0,
                                           inbound_proof_digest_0]);
    __compactRuntime.assert(!this._equal_21(bind_0,
                                            new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
                            'credit bind failed');
    const tmp_0 = 1n;
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_19.toValue(5n),
                                                                  alignment: _descriptor_19.alignment() } }] } },
                                       { addi: { immediate: parseInt(__compactRuntime.valueToBigInt(
                                                              { value: _descriptor_0.toValue(tmp_0),
                                                                alignment: _descriptor_0.alignment() }
                                                                .value
                                                            )) } },
                                       { ins: { cached: true, n: 1 } }]);
    const tmp_1 = 1n;
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_19.toValue(4n),
                                                                  alignment: _descriptor_19.alignment() } }] } },
                                       { addi: { immediate: parseInt(__compactRuntime.valueToBigInt(
                                                              { value: _descriptor_0.toValue(tmp_1),
                                                                alignment: _descriptor_0.alignment() }
                                                                .value
                                                            )) } },
                                       { ins: { cached: true, n: 1 } }]);
    return [];
  }
  _prove_session_auth_0(context,
                        partialProofData,
                        leaf_0,
                        root_0,
                        challenge_0,
                        relying_party_id_0,
                        time_window_0)
  {
    this._prove_kyc_membership_0(context, partialProofData, leaf_0, root_0);
    __compactRuntime.assert(!this._equal_22(challenge_0,
                                            new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
                            'empty challenge');
    __compactRuntime.assert(!this._equal_23(relying_party_id_0,
                                            new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
                            'empty relying party');
    __compactRuntime.assert(!this._equal_24(time_window_0,
                                            new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
                            'empty time window');
    const sk_0 = this._localSecretKey_0(context, partialProofData);
    const bind_0 = this._persistentHash_2([new Uint8Array([99, 105, 114, 99, 108, 101, 100, 58, 115, 101, 115, 115, 105, 111, 110, 58, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
                                           challenge_0,
                                           relying_party_id_0,
                                           time_window_0,
                                           sk_0]);
    __compactRuntime.assert(!this._equal_25(bind_0,
                                            new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
                            'session bind failed');
    const tmp_0 = 1n;
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_19.toValue(6n),
                                                                  alignment: _descriptor_19.alignment() } }] } },
                                       { addi: { immediate: parseInt(__compactRuntime.valueToBigInt(
                                                              { value: _descriptor_0.toValue(tmp_0),
                                                                alignment: _descriptor_0.alignment() }
                                                                .value
                                                            )) } },
                                       { ins: { cached: true, n: 1 } }]);
    return [];
  }
  _publicKey_0(sk_0, domain_0) {
    return this._persistentHash_4([new Uint8Array([99, 105, 114, 99, 108, 101, 100, 58, 112, 107, 58, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
                                   domain_0,
                                   sk_0]);
  }
  _prove_authorized_transaction_0(context,
                                  partialProofData,
                                  leaf_0,
                                  brand_registry_root_0,
                                  platform_challenge_0,
                                  intent_commitment_0,
                                  intent_signature_0)
  {
    __compactRuntime.assert(!this._equal_26(leaf_0,
                                            new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
                            'empty merchant leaf');
    __compactRuntime.assert(!this._equal_27(brand_registry_root_0,
                                            new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
                            'empty brand registry root');
    __compactRuntime.assert(!this._equal_28(platform_challenge_0,
                                            new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
                            'empty platform challenge');
    __compactRuntime.assert(!this._equal_29(intent_commitment_0,
                                            new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
                            'empty intent commitment');
    __compactRuntime.assert(!this._equal_30(intent_signature_0,
                                            new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
                            'empty intent signature');
    const bind_0 = this._persistentHash_2([new Uint8Array([97, 50, 54, 122, 58, 116, 120, 97, 117, 116, 104, 58, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
                                           brand_registry_root_0,
                                           platform_challenge_0,
                                           intent_commitment_0,
                                           intent_signature_0]);
    __compactRuntime.assert(!this._equal_31(bind_0,
                                            new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
                            'authorization bind failed');
    const leafBind_0 = this._persistentHash_4([new Uint8Array([97, 50, 54, 122, 58, 109, 108, 101, 97, 102, 58, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
                                               leaf_0,
                                               brand_registry_root_0]);
    __compactRuntime.assert(!this._equal_32(leafBind_0,
                                            new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
                            'leaf registry bind failed');
    const tmp_0 = 1n;
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_19.toValue(6n),
                                                                  alignment: _descriptor_19.alignment() } }] } },
                                       { addi: { immediate: parseInt(__compactRuntime.valueToBigInt(
                                                              { value: _descriptor_0.toValue(tmp_0),
                                                                alignment: _descriptor_0.alignment() }
                                                                .value
                                                            )) } },
                                       { ins: { cached: true, n: 1 } }]);
    return [];
  }
  _prove_collateral_lock_0(context,
                           partialProofData,
                           old_balance_commitment_0,
                           new_balance_commitment_0,
                           collateral_commitment_0,
                           loan_commitment_0)
  {
    const old_bal_0 = this._lockOldBalance_0(context, partialProofData);
    const collateral_0 = this._lockCollateralAmount_0(context, partialProofData);
    const loan_0 = this._lockLoanAmount_0(context, partialProofData);
    const old_open_0 = this._lockOldOpening_0(context, partialProofData);
    const new_open_0 = this._lockNewOpening_0(context, partialProofData);
    const col_open_0 = this._lockCollateralOpening_0(context, partialProofData);
    let t_0;
    __compactRuntime.assert((t_0 = ((t1) => {
                                     if (t1 > 18446744073709551615n) {
                                       throw new __compactRuntime.CompactError('nyxpay.compact line 300 char 10: cast from Field or Uint value to smaller Uint value failed: ' + t1 + ' is greater than 18446744073709551615');
                                     }
                                     return t1;
                                   })(loan_0),
                             t_0 > 0n),
                            'loan must be positive');
    let t_1;
    __compactRuntime.assert((t_1 = ((t1) => {
                                     if (t1 > 18446744073709551615n) {
                                       throw new __compactRuntime.CompactError('nyxpay.compact line 301 char 10: cast from Field or Uint value to smaller Uint value failed: ' + t1 + ' is greater than 18446744073709551615');
                                     }
                                     return t1;
                                   })(collateral_0),
                             t_1 > 0n),
                            'collateral must be positive');
    let t_2;
    __compactRuntime.assert((t_2 = ((t1) => {
                                     if (t1 > 18446744073709551615n) {
                                       throw new __compactRuntime.CompactError('nyxpay.compact line 304 char 6: cast from Field or Uint value to smaller Uint value failed: ' + t1 + ' is greater than 18446744073709551615');
                                     }
                                     return t1;
                                   })(collateral_0)
                                   +
                                   ((t1) => {
                                     if (t1 > 18446744073709551615n) {
                                       throw new __compactRuntime.CompactError('nyxpay.compact line 304 char 33: cast from Field or Uint value to smaller Uint value failed: ' + t1 + ' is greater than 18446744073709551615');
                                     }
                                     return t1;
                                   })(collateral_0),
                             t_2
                             >=
                             ((t1) => {
                               if (t1 > 18446744073709551615n) {
                                 throw new __compactRuntime.CompactError('nyxpay.compact line 305 char 11: cast from Field or Uint value to smaller Uint value failed: ' + t1 + ' is greater than 18446744073709551615');
                               }
                               return t1;
                             })(loan_0)
                             +
                             ((t1) => {
                               if (t1 > 18446744073709551615n) {
                                 throw new __compactRuntime.CompactError('nyxpay.compact line 305 char 32: cast from Field or Uint value to smaller Uint value failed: ' + t1 + ' is greater than 18446744073709551615');
                               }
                               return t1;
                             })(loan_0)
                             +
                             ((t1) => {
                               if (t1 > 18446744073709551615n) {
                                 throw new __compactRuntime.CompactError('nyxpay.compact line 305 char 53: cast from Field or Uint value to smaller Uint value failed: ' + t1 + ' is greater than 18446744073709551615');
                               }
                               return t1;
                             })(loan_0)),
                            'collateral below 150% of loan');
    let t_3;
    __compactRuntime.assert((t_3 = ((t1) => {
                                     if (t1 > 18446744073709551615n) {
                                       throw new __compactRuntime.CompactError('nyxpay.compact line 308 char 10: cast from Field or Uint value to smaller Uint value failed: ' + t1 + ' is greater than 18446744073709551615');
                                     }
                                     return t1;
                                   })(old_bal_0),
                             t_3
                             >=
                             ((t1) => {
                               if (t1 > 18446744073709551615n) {
                                 throw new __compactRuntime.CompactError('nyxpay.compact line 308 char 33: cast from Field or Uint value to smaller Uint value failed: ' + t1 + ' is greater than 18446744073709551615');
                               }
                               return t1;
                             })(collateral_0)),
                            'insufficient free balance');
    __compactRuntime.assert(this._equal_33(this._persistentCommit_0(old_bal_0,
                                                                    old_open_0),
                                           old_balance_commitment_0),
                            'old balance commitment mismatch');
    const new_bal_0 = __compactRuntime.subField(old_bal_0, collateral_0);
    __compactRuntime.assert(this._equal_34(this._persistentCommit_0(new_bal_0,
                                                                    new_open_0),
                                           new_balance_commitment_0),
                            'new balance commitment mismatch');
    __compactRuntime.assert(this._equal_35(this._persistentCommit_0(collateral_0,
                                                                    col_open_0),
                                           collateral_commitment_0),
                            'collateral commitment mismatch');
    __compactRuntime.assert(!this._equal_36(loan_commitment_0,
                                            new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
                            'empty loan commitment');
    const bind_0 = this._persistentHash_3([new Uint8Array([99, 105, 114, 99, 108, 101, 100, 58, 99, 114, 101, 100, 105, 116, 58, 108, 111, 99, 107, 58, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
                                           collateral_commitment_0,
                                           loan_commitment_0,
                                           new_balance_commitment_0]);
    __compactRuntime.assert(!this._equal_37(bind_0,
                                            new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
                            'collateral lock bind failed');
    const tmp_0 = 1n;
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_19.toValue(2n),
                                                                  alignment: _descriptor_19.alignment() } }] } },
                                       { addi: { immediate: parseInt(__compactRuntime.valueToBigInt(
                                                              { value: _descriptor_0.toValue(tmp_0),
                                                                alignment: _descriptor_0.alignment() }
                                                                .value
                                                            )) } },
                                       { ins: { cached: true, n: 1 } }]);
    const tmp_1 = 1n;
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_19.toValue(9n),
                                                                  alignment: _descriptor_19.alignment() } }] } },
                                       { addi: { immediate: parseInt(__compactRuntime.valueToBigInt(
                                                              { value: _descriptor_0.toValue(tmp_1),
                                                                alignment: _descriptor_0.alignment() }
                                                                .value
                                                            )) } },
                                       { ins: { cached: true, n: 1 } }]);
    return [];
  }
  _prove_pool_deposit_0(context,
                        partialProofData,
                        old_pool_commitment_0,
                        new_pool_commitment_0,
                        old_lender_balance_commitment_0,
                        new_lender_balance_commitment_0)
  {
    const pool_old_0 = this._poolOldTotal_0(context, partialProofData);
    const deposit_0 = this._poolDepositAmount_0(context, partialProofData);
    const pool_old_open_0 = this._poolOldOpening_0(context, partialProofData);
    const pool_new_open_0 = this._poolNewOpening_0(context, partialProofData);
    const lender_old_0 = this._poolLenderOldBalance_0(context, partialProofData);
    const lender_old_open_0 = this._poolLenderOldOpening_0(context,
                                                           partialProofData);
    const lender_new_open_0 = this._poolLenderNewOpening_0(context,
                                                           partialProofData);
    let t_0;
    __compactRuntime.assert((t_0 = ((t1) => {
                                     if (t1 > 18446744073709551615n) {
                                       throw new __compactRuntime.CompactError('nyxpay.compact line 351 char 10: cast from Field or Uint value to smaller Uint value failed: ' + t1 + ' is greater than 18446744073709551615');
                                     }
                                     return t1;
                                   })(deposit_0),
                             t_0 > 0n),
                            'deposit must be positive');
    let t_1;
    __compactRuntime.assert((t_1 = ((t1) => {
                                     if (t1 > 18446744073709551615n) {
                                       throw new __compactRuntime.CompactError('nyxpay.compact line 352 char 10: cast from Field or Uint value to smaller Uint value failed: ' + t1 + ' is greater than 18446744073709551615');
                                     }
                                     return t1;
                                   })(lender_old_0),
                             t_1
                             >=
                             ((t1) => {
                               if (t1 > 18446744073709551615n) {
                                 throw new __compactRuntime.CompactError('nyxpay.compact line 352 char 36: cast from Field or Uint value to smaller Uint value failed: ' + t1 + ' is greater than 18446744073709551615');
                               }
                               return t1;
                             })(deposit_0)),
                            'lender insufficient balance');
    __compactRuntime.assert(this._equal_38(this._persistentCommit_0(pool_old_0,
                                                                    pool_old_open_0),
                                           old_pool_commitment_0),
                            'old pool commitment mismatch');
    const pool_new_0 = __compactRuntime.addField(pool_old_0, deposit_0);
    __compactRuntime.assert(this._equal_39(this._persistentCommit_0(pool_new_0,
                                                                    pool_new_open_0),
                                           new_pool_commitment_0),
                            'new pool commitment mismatch');
    __compactRuntime.assert(this._equal_40(this._persistentCommit_0(lender_old_0,
                                                                    lender_old_open_0),
                                           old_lender_balance_commitment_0),
                            'old lender balance mismatch');
    const lender_new_0 = __compactRuntime.subField(lender_old_0, deposit_0);
    __compactRuntime.assert(this._equal_41(this._persistentCommit_0(lender_new_0,
                                                                    lender_new_open_0),
                                           new_lender_balance_commitment_0),
                            'new lender balance mismatch');
    const bind_0 = this._persistentHash_4([new Uint8Array([99, 105, 114, 99, 108, 101, 100, 58, 99, 114, 101, 100, 105, 116, 58, 112, 111, 111, 108, 58, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
                                           old_pool_commitment_0,
                                           new_pool_commitment_0]);
    __compactRuntime.assert(!this._equal_42(bind_0,
                                            new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
                            'pool deposit bind failed');
    const tmp_0 = 1n;
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_19.toValue(10n),
                                                                  alignment: _descriptor_19.alignment() } }] } },
                                       { addi: { immediate: parseInt(__compactRuntime.valueToBigInt(
                                                              { value: _descriptor_0.toValue(tmp_0),
                                                                alignment: _descriptor_0.alignment() }
                                                                .value
                                                            )) } },
                                       { ins: { cached: true, n: 1 } }]);
    const tmp_1 = 1n;
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_19.toValue(2n),
                                                                  alignment: _descriptor_19.alignment() } }] } },
                                       { addi: { immediate: parseInt(__compactRuntime.valueToBigInt(
                                                              { value: _descriptor_0.toValue(tmp_1),
                                                                alignment: _descriptor_0.alignment() }
                                                                .value
                                                            )) } },
                                       { ins: { cached: true, n: 1 } }]);
    return [];
  }
  _prove_loan_repayment_0(context,
                          partialProofData,
                          loan_commitment_old_0,
                          loan_commitment_new_0,
                          installment_nullifier_0,
                          credit_identity_0)
  {
    const installment_0 = this._repayInstallmentAmount_0(context,
                                                         partialProofData);
    const remaining_old_0 = this._repayRemainingOld_0(context, partialProofData);
    const remaining_new_0 = this._repayRemainingNew_0(context, partialProofData);
    let t_0;
    __compactRuntime.assert((t_0 = ((t1) => {
                                     if (t1 > 18446744073709551615n) {
                                       throw new __compactRuntime.CompactError('nyxpay.compact line 394 char 10: cast from Field or Uint value to smaller Uint value failed: ' + t1 + ' is greater than 18446744073709551615');
                                     }
                                     return t1;
                                   })(installment_0),
                             t_0 > 0n),
                            'installment must be positive');
    let t_1;
    __compactRuntime.assert((t_1 = ((t1) => {
                                     if (t1 > 18446744073709551615n) {
                                       throw new __compactRuntime.CompactError('nyxpay.compact line 395 char 10: cast from Field or Uint value to smaller Uint value failed: ' + t1 + ' is greater than 18446744073709551615');
                                     }
                                     return t1;
                                   })(remaining_old_0),
                             t_1
                             >=
                             ((t1) => {
                               if (t1 > 18446744073709551615n) {
                                 throw new __compactRuntime.CompactError('nyxpay.compact line 395 char 39: cast from Field or Uint value to smaller Uint value failed: ' + t1 + ' is greater than 18446744073709551615');
                               }
                               return t1;
                             })(installment_0)),
                            'overpay');
    __compactRuntime.assert(remaining_new_0
                            ===
                            __compactRuntime.subField(remaining_old_0,
                                                      installment_0),
                            'remaining arithmetic');
    __compactRuntime.assert(!this._equal_43(loan_commitment_old_0,
                                            new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
                            'empty old loan');
    __compactRuntime.assert(!this._equal_44(loan_commitment_new_0,
                                            new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
                            'empty new loan');
    __compactRuntime.assert(!this._equal_45(installment_nullifier_0,
                                            new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
                            'empty installment nullifier');
    __compactRuntime.assert(!this._equal_46(credit_identity_0,
                                            new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
                            'empty credit identity');
    const bind_0 = this._persistentHash_3([new Uint8Array([99, 105, 114, 99, 108, 101, 100, 58, 99, 114, 101, 100, 105, 116, 58, 114, 101, 112, 97, 121, 58, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
                                           credit_identity_0,
                                           loan_commitment_old_0,
                                           installment_nullifier_0]);
    __compactRuntime.assert(!this._equal_47(bind_0,
                                            new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
                            'repayment bind failed');
    const tmp_0 = 1n;
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_19.toValue(11n),
                                                                  alignment: _descriptor_19.alignment() } }] } },
                                       { addi: { immediate: parseInt(__compactRuntime.valueToBigInt(
                                                              { value: _descriptor_0.toValue(tmp_0),
                                                                alignment: _descriptor_0.alignment() }
                                                                .value
                                                            )) } },
                                       { ins: { cached: true, n: 1 } }]);
    return [];
  }
  _prove_credit_standing_0(context,
                           partialProofData,
                           credit_identity_0,
                           on_time_threshold_0,
                           max_defaults_allowed_0)
  {
    __compactRuntime.assert(!this._equal_48(credit_identity_0,
                                            new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
                            'empty credit identity');
    const on_time_0 = this._standingOnTimeCount_0(context, partialProofData);
    const defaults_0 = this._standingDefaultCount_0(context, partialProofData);
    const thr_0 = this._standingOnTimeThreshold_0(context, partialProofData);
    const max_def_0 = this._standingMaxDefaults_0(context, partialProofData);
    const thr_open_0 = this._standingThrOpening_0(context, partialProofData);
    const max_open_0 = this._standingMaxDefOpening_0(context, partialProofData);
    let t_0;
    __compactRuntime.assert((t_0 = ((t1) => {
                                     if (t1 > 18446744073709551615n) {
                                       throw new __compactRuntime.CompactError('nyxpay.compact line 429 char 10: cast from Field or Uint value to smaller Uint value failed: ' + t1 + ' is greater than 18446744073709551615');
                                     }
                                     return t1;
                                   })(on_time_0),
                             t_0
                             >=
                             ((t1) => {
                               if (t1 > 18446744073709551615n) {
                                 throw new __compactRuntime.CompactError('nyxpay.compact line 429 char 33: cast from Field or Uint value to smaller Uint value failed: ' + t1 + ' is greater than 18446744073709551615');
                               }
                               return t1;
                             })(thr_0)),
                            'on_time below threshold');
    let t_1;
    __compactRuntime.assert((t_1 = ((t1) => {
                                     if (t1 > 18446744073709551615n) {
                                       throw new __compactRuntime.CompactError('nyxpay.compact line 430 char 10: cast from Field or Uint value to smaller Uint value failed: ' + t1 + ' is greater than 18446744073709551615');
                                     }
                                     return t1;
                                   })(defaults_0),
                             t_1
                             <=
                             ((t1) => {
                               if (t1 > 18446744073709551615n) {
                                 throw new __compactRuntime.CompactError('nyxpay.compact line 430 char 34: cast from Field or Uint value to smaller Uint value failed: ' + t1 + ' is greater than 18446744073709551615');
                               }
                               return t1;
                             })(max_def_0)),
                            'defaults exceed allowed');
    __compactRuntime.assert(this._equal_49(this._persistentCommit_0(thr_0,
                                                                    thr_open_0),
                                           on_time_threshold_0),
                            'on_time threshold bind failed');
    __compactRuntime.assert(this._equal_50(this._persistentCommit_0(max_def_0,
                                                                    max_open_0),
                                           max_defaults_allowed_0),
                            'max defaults bind failed');
    const bind_0 = this._persistentHash_3([new Uint8Array([99, 105, 114, 99, 108, 101, 100, 58, 99, 114, 101, 100, 105, 116, 58, 115, 116, 97, 110, 100, 105, 110, 103, 58, 0, 0, 0, 0, 0, 0, 0, 0]),
                                           credit_identity_0,
                                           on_time_threshold_0,
                                           max_defaults_allowed_0]);
    __compactRuntime.assert(!this._equal_51(bind_0,
                                            new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
                            'standing bind failed');
    const tmp_0 = 1n;
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_19.toValue(12n),
                                                                  alignment: _descriptor_19.alignment() } }] } },
                                       { addi: { immediate: parseInt(__compactRuntime.valueToBigInt(
                                                              { value: _descriptor_0.toValue(tmp_0),
                                                                alignment: _descriptor_0.alignment() }
                                                                .value
                                                            )) } },
                                       { ins: { cached: true, n: 1 } }]);
    return [];
  }
  _prove_pool_solvency_0(context,
                         partialProofData,
                         pool_commitment_0,
                         coverage_ok_0)
  {
    __compactRuntime.assert(!this._equal_52(pool_commitment_0,
                                            new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
                            'empty pool');
    __compactRuntime.assert(!this._equal_53(coverage_ok_0,
                                            new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
                            'empty coverage flag');
    const bind_0 = this._persistentHash_4([new Uint8Array([99, 105, 114, 99, 108, 101, 100, 58, 99, 114, 101, 100, 105, 116, 58, 115, 111, 108, 118, 101, 110, 99, 121, 58, 0, 0, 0, 0, 0, 0, 0, 0]),
                                           pool_commitment_0,
                                           coverage_ok_0]);
    __compactRuntime.assert(!this._equal_54(bind_0,
                                            new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
                            'solvency bind failed');
    const tmp_0 = 1n;
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_19.toValue(13n),
                                                                  alignment: _descriptor_19.alignment() } }] } },
                                       { addi: { immediate: parseInt(__compactRuntime.valueToBigInt(
                                                              { value: _descriptor_0.toValue(tmp_0),
                                                                alignment: _descriptor_0.alignment() }
                                                                .value
                                                            )) } },
                                       { ins: { cached: true, n: 1 } }]);
    return [];
  }
  _folder_0(f, x, a0) {
    for (let i = 0; i < 16; i++) { x = f(x, a0[i]); }
    return x;
  }
  _equal_0(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_1(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_2(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_3(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_4(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_5(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_6(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_7(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_8(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_9(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_10(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_11(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_12(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_13(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_14(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_15(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_16(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_17(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_18(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_19(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_20(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_21(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_22(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_23(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_24(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_25(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_26(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_27(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_28(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_29(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_30(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_31(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_32(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_33(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_34(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_35(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_36(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_37(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_38(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_39(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_40(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_41(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_42(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_43(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_44(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_45(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_46(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_47(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_48(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_49(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_50(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_51(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_52(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_53(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_54(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
}
export function ledger(stateOrChargedState) {
  const state = stateOrChargedState instanceof __compactRuntime.StateValue ? stateOrChargedState : stateOrChargedState.state;
  const chargedState = stateOrChargedState instanceof __compactRuntime.StateValue ? new __compactRuntime.ChargedState(stateOrChargedState) : stateOrChargedState;
  const context = {
    currentQueryContext: new __compactRuntime.QueryContext(chargedState, __compactRuntime.dummyContractAddress()),
    costModel: __compactRuntime.CostModel.initialCostModel()
  };
  const partialProofData = {
    input: { value: [], alignment: [] },
    output: undefined,
    publicTranscript: [],
    privateTranscriptOutputs: []
  };
  return {
    get kyc_registry_root() {
      return _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                       partialProofData,
                                                                       [
                                                                        { dup: { n: 0 } },
                                                                        { idx: { cached: false,
                                                                                 pushPath: false,
                                                                                 path: [
                                                                                        { tag: 'value',
                                                                                          value: { value: _descriptor_19.toValue(0n),
                                                                                                   alignment: _descriptor_19.alignment() } }] } },
                                                                        { popeq: { cached: false,
                                                                                   result: undefined } }]).value);
    },
    kyc_tree: {
      isFull(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`isFull: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_4.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_19.toValue(1n),
                                                                                                     alignment: _descriptor_19.alignment() } }] } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_19.toValue(1n),
                                                                                                     alignment: _descriptor_19.alignment() } }] } },
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_15.toValue(65536n),
                                                                                                                                 alignment: _descriptor_15.alignment() }).encode() } },
                                                                          'lt',
                                                                          'neg',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      checkRoot(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`checkRoot: expected 1 argument, received ${args_0.length}`);
        }
        const rt_0 = args_0[0];
        if (!(typeof(rt_0) === 'object' && typeof(rt_0.field) === 'bigint' && rt_0.field >= 0 && rt_0.field <= __compactRuntime.MAX_FIELD)) {
          __compactRuntime.typeError('checkRoot',
                                     'argument 1',
                                     'nyxpay.compact line 12 char 1',
                                     'struct MerkleTreeDigest<field: Field>',
                                     rt_0)
        }
        return _descriptor_4.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_19.toValue(1n),
                                                                                                     alignment: _descriptor_19.alignment() } }] } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_19.toValue(2n),
                                                                                                     alignment: _descriptor_19.alignment() } }] } },
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_3.toValue(rt_0),
                                                                                                                                 alignment: _descriptor_3.alignment() }).encode() } },
                                                                          'member',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      root(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`root: expected 0 arguments, received ${args_0.length}`);
        }
        const self_0 = state.asArray()[1];
        return ((result) => result             ? __compactRuntime.CompactTypeMerkleTreeDigest.fromValue(result)             : undefined)(self_0.asArray()[0].asBoundedMerkleTree().rehash().root()?.value);
      },
      firstFree(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`first_free: expected 0 arguments, received ${args_0.length}`);
        }
        const self_0 = state.asArray()[1];
        return __compactRuntime.CompactTypeField.fromValue(self_0.asArray()[1].asCell().value);
      },
      pathForLeaf(...args_0) {
        if (args_0.length !== 2) {
          throw new __compactRuntime.CompactError(`path_for_leaf: expected 2 arguments, received ${args_0.length}`);
        }
        const index_0 = args_0[0];
        const leaf_0 = args_0[1];
        if (!(typeof(index_0) === 'bigint' && index_0 >= 0 && index_0 <= __compactRuntime.MAX_FIELD)) {
          __compactRuntime.typeError('path_for_leaf',
                                     'argument 1',
                                     'nyxpay.compact line 12 char 1',
                                     'Field',
                                     index_0)
        }
        if (!(leaf_0.buffer instanceof ArrayBuffer && leaf_0.BYTES_PER_ELEMENT === 1 && leaf_0.length === 32)) {
          __compactRuntime.typeError('path_for_leaf',
                                     'argument 2',
                                     'nyxpay.compact line 12 char 1',
                                     'Bytes<32>',
                                     leaf_0)
        }
        const self_0 = state.asArray()[1];
        return ((result) => result             ? new __compactRuntime.CompactTypeMerkleTreePath(16, _descriptor_1).fromValue(result)             : undefined)(  self_0.asArray()[0].asBoundedMerkleTree().rehash().pathForLeaf(    index_0,    {      value: _descriptor_1.toValue(leaf_0),      alignment: _descriptor_1.alignment()    }  )?.value);
      },
      findPathForLeaf(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`find_path_for_leaf: expected 1 argument, received ${args_0.length}`);
        }
        const leaf_0 = args_0[0];
        if (!(leaf_0.buffer instanceof ArrayBuffer && leaf_0.BYTES_PER_ELEMENT === 1 && leaf_0.length === 32)) {
          __compactRuntime.typeError('find_path_for_leaf',
                                     'argument 1',
                                     'nyxpay.compact line 12 char 1',
                                     'Bytes<32>',
                                     leaf_0)
        }
        const self_0 = state.asArray()[1];
        return ((result) => result             ? new __compactRuntime.CompactTypeMerkleTreePath(16, _descriptor_1).fromValue(result)             : undefined)(  self_0.asArray()[0].asBoundedMerkleTree().rehash().findPathForLeaf(    {      value: _descriptor_1.toValue(leaf_0),      alignment: _descriptor_1.alignment()    }  )?.value);
      },
      history(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`history: expected 0 arguments, received ${args_0.length}`);
        }
        const self_0 = state.asArray()[1];
        return self_0.asArray()[2].asMap().keys().map(  (elem) => __compactRuntime.CompactTypeMerkleTreeDigest.fromValue(elem.value))[Symbol.iterator]();
      }
    },
    get spent_nullifier_count() {
      return _descriptor_15.fromValue(__compactRuntime.queryLedgerState(context,
                                                                        partialProofData,
                                                                        [
                                                                         { dup: { n: 0 } },
                                                                         { idx: { cached: false,
                                                                                  pushPath: false,
                                                                                  path: [
                                                                                         { tag: 'value',
                                                                                           value: { value: _descriptor_19.toValue(2n),
                                                                                                    alignment: _descriptor_19.alignment() } }] } },
                                                                         { popeq: { cached: true,
                                                                                    result: undefined } }]).value);
    },
    get revoked_nullifier_count() {
      return _descriptor_15.fromValue(__compactRuntime.queryLedgerState(context,
                                                                        partialProofData,
                                                                        [
                                                                         { dup: { n: 0 } },
                                                                         { idx: { cached: false,
                                                                                  pushPath: false,
                                                                                  path: [
                                                                                         { tag: 'value',
                                                                                           value: { value: _descriptor_19.toValue(3n),
                                                                                                    alignment: _descriptor_19.alignment() } }] } },
                                                                         { popeq: { cached: true,
                                                                                    result: undefined } }]).value);
    },
    get transfer_count() {
      return _descriptor_15.fromValue(__compactRuntime.queryLedgerState(context,
                                                                        partialProofData,
                                                                        [
                                                                         { dup: { n: 0 } },
                                                                         { idx: { cached: false,
                                                                                  pushPath: false,
                                                                                  path: [
                                                                                         { tag: 'value',
                                                                                           value: { value: _descriptor_19.toValue(4n),
                                                                                                    alignment: _descriptor_19.alignment() } }] } },
                                                                         { popeq: { cached: true,
                                                                                    result: undefined } }]).value);
    },
    get credit_count() {
      return _descriptor_15.fromValue(__compactRuntime.queryLedgerState(context,
                                                                        partialProofData,
                                                                        [
                                                                         { dup: { n: 0 } },
                                                                         { idx: { cached: false,
                                                                                  pushPath: false,
                                                                                  path: [
                                                                                         { tag: 'value',
                                                                                           value: { value: _descriptor_19.toValue(5n),
                                                                                                    alignment: _descriptor_19.alignment() } }] } },
                                                                         { popeq: { cached: true,
                                                                                    result: undefined } }]).value);
    },
    get spent_challenge_count() {
      return _descriptor_15.fromValue(__compactRuntime.queryLedgerState(context,
                                                                        partialProofData,
                                                                        [
                                                                         { dup: { n: 0 } },
                                                                         { idx: { cached: false,
                                                                                  pushPath: false,
                                                                                  path: [
                                                                                         { tag: 'value',
                                                                                           value: { value: _descriptor_19.toValue(6n),
                                                                                                    alignment: _descriptor_19.alignment() } }] } },
                                                                         { popeq: { cached: true,
                                                                                    result: undefined } }]).value);
    },
    get policy_update_count() {
      return _descriptor_15.fromValue(__compactRuntime.queryLedgerState(context,
                                                                        partialProofData,
                                                                        [
                                                                         { dup: { n: 0 } },
                                                                         { idx: { cached: false,
                                                                                  pushPath: false,
                                                                                  path: [
                                                                                         { tag: 'value',
                                                                                           value: { value: _descriptor_19.toValue(7n),
                                                                                                    alignment: _descriptor_19.alignment() } }] } },
                                                                         { popeq: { cached: true,
                                                                                    result: undefined } }]).value);
    },
    get settlement_anchor_count() {
      return _descriptor_15.fromValue(__compactRuntime.queryLedgerState(context,
                                                                        partialProofData,
                                                                        [
                                                                         { dup: { n: 0 } },
                                                                         { idx: { cached: false,
                                                                                  pushPath: false,
                                                                                  path: [
                                                                                         { tag: 'value',
                                                                                           value: { value: _descriptor_19.toValue(8n),
                                                                                                    alignment: _descriptor_19.alignment() } }] } },
                                                                         { popeq: { cached: true,
                                                                                    result: undefined } }]).value);
    },
    get loan_count() {
      return _descriptor_15.fromValue(__compactRuntime.queryLedgerState(context,
                                                                        partialProofData,
                                                                        [
                                                                         { dup: { n: 0 } },
                                                                         { idx: { cached: false,
                                                                                  pushPath: false,
                                                                                  path: [
                                                                                         { tag: 'value',
                                                                                           value: { value: _descriptor_19.toValue(9n),
                                                                                                    alignment: _descriptor_19.alignment() } }] } },
                                                                         { popeq: { cached: true,
                                                                                    result: undefined } }]).value);
    },
    get pool_deposit_count() {
      return _descriptor_15.fromValue(__compactRuntime.queryLedgerState(context,
                                                                        partialProofData,
                                                                        [
                                                                         { dup: { n: 0 } },
                                                                         { idx: { cached: false,
                                                                                  pushPath: false,
                                                                                  path: [
                                                                                         { tag: 'value',
                                                                                           value: { value: _descriptor_19.toValue(10n),
                                                                                                    alignment: _descriptor_19.alignment() } }] } },
                                                                         { popeq: { cached: true,
                                                                                    result: undefined } }]).value);
    },
    get repayment_count() {
      return _descriptor_15.fromValue(__compactRuntime.queryLedgerState(context,
                                                                        partialProofData,
                                                                        [
                                                                         { dup: { n: 0 } },
                                                                         { idx: { cached: false,
                                                                                  pushPath: false,
                                                                                  path: [
                                                                                         { tag: 'value',
                                                                                           value: { value: _descriptor_19.toValue(11n),
                                                                                                    alignment: _descriptor_19.alignment() } }] } },
                                                                         { popeq: { cached: true,
                                                                                    result: undefined } }]).value);
    },
    get credit_standing_count() {
      return _descriptor_15.fromValue(__compactRuntime.queryLedgerState(context,
                                                                        partialProofData,
                                                                        [
                                                                         { dup: { n: 0 } },
                                                                         { idx: { cached: false,
                                                                                  pushPath: false,
                                                                                  path: [
                                                                                         { tag: 'value',
                                                                                           value: { value: _descriptor_19.toValue(12n),
                                                                                                    alignment: _descriptor_19.alignment() } }] } },
                                                                         { popeq: { cached: true,
                                                                                    result: undefined } }]).value);
    },
    get pool_solvency_count() {
      return _descriptor_15.fromValue(__compactRuntime.queryLedgerState(context,
                                                                        partialProofData,
                                                                        [
                                                                         { dup: { n: 0 } },
                                                                         { idx: { cached: false,
                                                                                  pushPath: false,
                                                                                  path: [
                                                                                         { tag: 'value',
                                                                                           value: { value: _descriptor_19.toValue(13n),
                                                                                                    alignment: _descriptor_19.alignment() } }] } },
                                                                         { popeq: { cached: true,
                                                                                    result: undefined } }]).value);
    }
  };
}
const _emptyContext = {
  currentQueryContext: new __compactRuntime.QueryContext(new __compactRuntime.ContractState().data, __compactRuntime.dummyContractAddress())
};
const _dummyContract = new Contract({
  localSecretKey: (...args) => undefined,
  kycMembershipPath: (...args) => undefined,
  spendOldBalance: (...args) => undefined,
  spendAmount: (...args) => undefined,
  spendOldOpening: (...args) => undefined,
  spendNewOpening: (...args) => undefined,
  creditOldBalance: (...args) => undefined,
  creditAmount: (...args) => undefined,
  creditOldOpening: (...args) => undefined,
  creditNewOpening: (...args) => undefined,
  policyAmount: (...args) => undefined,
  lockOldBalance: (...args) => undefined,
  lockCollateralAmount: (...args) => undefined,
  lockLoanAmount: (...args) => undefined,
  lockOldOpening: (...args) => undefined,
  lockNewOpening: (...args) => undefined,
  lockCollateralOpening: (...args) => undefined,
  poolOldTotal: (...args) => undefined,
  poolDepositAmount: (...args) => undefined,
  poolOldOpening: (...args) => undefined,
  poolNewOpening: (...args) => undefined,
  poolLenderOldBalance: (...args) => undefined,
  poolLenderNewOpening: (...args) => undefined,
  poolLenderOldOpening: (...args) => undefined,
  repayInstallmentAmount: (...args) => undefined,
  repayRemainingOld: (...args) => undefined,
  repayRemainingNew: (...args) => undefined,
  standingOnTimeCount: (...args) => undefined,
  standingDefaultCount: (...args) => undefined,
  standingOnTimeThreshold: (...args) => undefined,
  standingMaxDefaults: (...args) => undefined,
  standingThrOpening: (...args) => undefined,
  standingMaxDefOpening: (...args) => undefined
});
export const pureCircuits = {
  publicKey: (...args_0) => {
    if (args_0.length !== 2) {
      throw new __compactRuntime.CompactError(`publicKey: expected 2 arguments (as invoked from Typescript), received ${args_0.length}`);
    }
    const sk_0 = args_0[0];
    const domain_0 = args_0[1];
    if (!(sk_0.buffer instanceof ArrayBuffer && sk_0.BYTES_PER_ELEMENT === 1 && sk_0.length === 32)) {
      __compactRuntime.typeError('publicKey',
                                 'argument 1',
                                 'nyxpay.compact line 248 char 1',
                                 'Bytes<32>',
                                 sk_0)
    }
    if (!(domain_0.buffer instanceof ArrayBuffer && domain_0.BYTES_PER_ELEMENT === 1 && domain_0.length === 32)) {
      __compactRuntime.typeError('publicKey',
                                 'argument 2',
                                 'nyxpay.compact line 248 char 1',
                                 'Bytes<32>',
                                 domain_0)
    }
    return _dummyContract._publicKey_0(sk_0, domain_0);
  }
};
export const contractReferenceLocations =
  { tag: 'publicLedgerArray', indices: { } };
//# sourceMappingURL=index.js.map
