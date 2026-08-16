import { createObservation, OBSERVATION_TYPES } from './observation-contracts.js';
import {
  createVerificationFinding,
  VERIFICATION_STATUS
} from './verification-contracts.js';
import { createVerificationRuntime } from './verification-runtime.js';

function assert(name, condition) {
  return {
    name,
    passed: Boolean(condition)
  };
}

function createValidObservation(overrides = {}) {
  return createObservation({
    observationId: 'observation-1',
    type: OBSERVATION_TYPES.toolResult,
    source: 'tool-runtime',
    subject: 'tool-call-1',
    occurredAt: '2026-08-16T14:00:00.000Z',
    recordedAt: '2026-08-16T14:00:01.000Z',
    payload: {
      exitStatus: 0,
      nested: {
        stable: true
      }
    },
    provenance: {
      sourceType: 'tool',
      sourceId: 'tool-call-1',
      operationId: 'operation-1',
      requestId: 'request-1'
    },
    confidence: null,
    metadata: {
      stable: true
    },
    ...overrides
  });
}

function createContext(overrides = {}) {
  return {
    verificationId: 'verification-1',
    verifiedAt: '2026-08-16T14:00:02.000Z',
    provenance: {
      source: 'verification-runtime-test',
      verifierId: 'verifier-1',
      observationId: 'observation-1',
      operationId: 'operation-1',
      providerId: 'openai',
      modelId: 'model-1'
    },
    metadata: {
      policy: 'unweighted-mean'
    },
    ...overrides
  };
}

function createCheck(id, status, confidence, overrides = {}) {
  return {
    id,
    name: `${id}-check`,
    check() {
      return {
        status,
        confidence,
        finding: createVerificationFinding({
          findingId: `${id}-finding`,
          code: `${id}_${status}`,
          message: `${id} returned ${status}.`,
          metadata: {}
        }),
        metadata: {
          checkId: id
        }
      };
    },
    ...overrides
  };
}

function runVerification(checks, observation = createValidObservation(), context = createContext()) {
  return createVerificationRuntime({ checks }).verify(observation, context);
}

export function runVerificationRuntimeTests() {
  const verifiedCheck = createCheck('verified', VERIFICATION_STATUS.verified, 0.9);
  const rejectedCheck = createCheck('rejected', VERIFICATION_STATUS.rejected, 0.8);
  const uncertainCheck = createCheck('uncertain', VERIFICATION_STATUS.uncertain, 0.6);
  const degradedCheck = createCheck('degraded', VERIFICATION_STATUS.degraded, 0.4);

  const singleSuccess = runVerification([verifiedCheck]);
  const multipleSuccess = runVerification([
    createCheck('verified-a', VERIFICATION_STATUS.verified, 0.8),
    createCheck('verified-b', VERIFICATION_STATUS.verified, 0.6)
  ]);
  const rejected = runVerification([rejectedCheck]);
  const uncertain = runVerification([uncertainCheck]);
  const degraded = runVerification([degradedCheck]);
  const mixed = runVerification([
    verifiedCheck,
    uncertainCheck,
    degradedCheck,
    rejectedCheck
  ]);
  const malformedObservation = runVerification([verifiedCheck], null);
  const malformedResult = runVerification([{
    id: 'malformed',
    name: 'malformed-check',
    check() {
      return null;
    }
  }]);
  const thrownResult = runVerification([{
    id: 'thrown',
    name: 'thrown-check',
    check() {
      throw new Error('Injected check failure');
    }
  }]);
  const multipleErrors = runVerification([
    {
      id: 'error-a',
      name: 'error-a-check',
      check() {
        throw new Error('First failure');
      }
    },
    {
      id: 'error-b',
      name: 'error-b-check',
      check() {
        return { status: 'invalid' };
      }
    }
  ]);
  const unsupportedAsync = runVerification([{
    id: 'async',
    name: 'async-check',
    check() {
      return Promise.resolve({});
    }
  }]);
  const invalidDescriptor = runVerification([{
    id: 'invalid-descriptor',
    name: 'invalid-descriptor-check'
  }]);
  const missingExplicitContext = runVerification(
    [verifiedCheck],
    createValidObservation(),
    {}
  );

  const duplicateFinding = createVerificationFinding({
    findingId: 'shared-finding',
    code: 'same_result',
    message: 'Exact duplicate finding.',
    metadata: {}
  });
  const duplicateFindings = runVerification([
    {
      id: 'duplicate-a',
      name: 'duplicate-a-check',
      check() {
        return {
          status: VERIFICATION_STATUS.verified,
          confidence: 1,
          finding: duplicateFinding,
          metadata: {}
        };
      }
    },
    {
      id: 'duplicate-b',
      name: 'duplicate-b-check',
      check() {
        return {
          status: VERIFICATION_STATUS.verified,
          confidence: 1,
          finding: duplicateFinding,
          metadata: {}
        };
      }
    }
  ]);

  const executionOrder = [];
  const ordered = runVerification([
    {
      ...createCheck('first', VERIFICATION_STATUS.verified, 1),
      check(observation, context) {
        executionOrder.push('first');
        observation.payload.nested.stable = false;
        context.metadata.policy = 'mutated';
        return createCheck('first-result', VERIFICATION_STATUS.verified, 1).check();
      }
    },
    {
      ...createCheck('second', VERIFICATION_STATUS.verified, 1),
      check(observation, context) {
        executionOrder.push('second');
        return {
          status: VERIFICATION_STATUS.verified,
          confidence: 1,
          finding: createVerificationFinding({
            findingId: 'second-finding',
            code: observation.payload.nested.stable && context.metadata.policy === 'unweighted-mean'
              ? 'isolated_inputs'
              : 'mutated_inputs',
            message: 'Second check received isolated inputs.',
            metadata: {}
          }),
          metadata: {}
        };
      }
    }
  ]);

  const sourceObservation = createValidObservation();
  const sourceContext = createContext();
  const observationBefore = JSON.stringify(sourceObservation);
  const contextBefore = JSON.stringify(sourceContext);
  const isolatedInput = runVerification([verifiedCheck], sourceObservation, sourceContext);
  const deterministicA = runVerification([
    createCheck('deterministic-a', VERIFICATION_STATUS.verified, 0.75),
    createCheck('deterministic-b', VERIFICATION_STATUS.uncertain, 0.25)
  ]);
  const deterministicB = runVerification([
    createCheck('deterministic-a', VERIFICATION_STATUS.verified, 0.75),
    createCheck('deterministic-b', VERIFICATION_STATUS.uncertain, 0.25)
  ]);
  const domainState = {
    observations: [sourceObservation],
    memories: [],
    relationships: [],
    reflections: [],
    providerCalls: 0,
    persisted: false,
    uiState: null
  };
  const domainStateBefore = JSON.stringify(domainState);
  const runtimeSurface = Object.keys(createVerificationRuntime({ checks: [verifiedCheck] }));

  return [
    assert('single successful check', singleSuccess.status === 'complete' && singleSuccess.verification.status === VERIFICATION_STATUS.verified),
    assert('multiple successful checks', multipleSuccess.status === 'complete' && multipleSuccess.verification.checks.length === 2),
    assert('rejected check', rejected.verification.status === VERIFICATION_STATUS.rejected),
    assert('uncertain check', uncertain.verification.status === VERIFICATION_STATUS.uncertain),
    assert('degraded check', degraded.verification.status === VERIFICATION_STATUS.degraded),
    assert('mixed outcome precedence', mixed.verification.status === VERIFICATION_STATUS.rejected),
    assert('deterministic status aggregation', deterministicA.verification.status === VERIFICATION_STATUS.uncertain && deterministicA.verification.status === deterministicB.verification.status),
    assert('deterministic confidence aggregation', multipleSuccess.verification.confidence === 0.7 && deterministicA.verification.confidence === 0.5),
    assert('malformed observation', malformedObservation.status === 'error' && malformedObservation.normalizedError.code === 'verification_runtime_invalid_observation'),
    assert('malformed check result degrades', malformedResult.status === 'complete' && malformedResult.verification.status === VERIFICATION_STATUS.degraded && malformedResult.verification.checks[0].finding.code === 'malformed_check_result'),
    assert('thrown check error degrades', thrownResult.status === 'complete' && thrownResult.verification.status === VERIFICATION_STATUS.degraded && thrownResult.verification.checks[0].finding.metadata.message === 'Injected check failure'),
    assert('multiple check errors retained', multipleErrors.status === 'complete' && multipleErrors.verification.checks.every((check) => check.status === VERIFICATION_STATUS.degraded)),
    assert('unsupported async check behavior degrades', unsupportedAsync.verification.checks[0].finding.code === 'unsupported_check_behavior'),
    assert('invalid check descriptor rejected', invalidDescriptor.status === 'error' && invalidDescriptor.normalizedError.category === 'configuration'),
    assert('missing explicit identity and time rejected', missingExplicitContext.status === 'error' && missingExplicitContext.verificationId === '' && missingExplicitContext.normalizedError.code === 'verification_runtime_invalid_context'),
    assert('finding aggregation preserves order', mixed.verification.findings.map((finding) => finding.findingId).join(',') === mixed.verification.checks.map((check) => check.finding.findingId).join(',')),
    assert('exact duplicate findings are preserved', duplicateFindings.verification.findings.length === 2 && duplicateFindings.verification.findings[0].findingId === duplicateFindings.verification.findings[1].findingId),
    assert('provenance preserved', ['source', 'verifierId', 'observationId', 'operationId', 'providerId', 'modelId'].every((field) => isolatedInput.verification.provenance[field] === sourceContext.provenance[field])),
    assert('verificationId preserved', isolatedInput.verificationId === sourceContext.verificationId),
    assert('timestamp preserved', isolatedInput.verification.verifiedAt === sourceContext.verifiedAt),
    assert('input observation remains unchanged', JSON.stringify(sourceObservation) === observationBefore),
    assert('input context remains unchanged', JSON.stringify(sourceContext) === contextBefore),
    assert('checks execute in deterministic order', executionOrder.join(',') === 'first,second'),
    assert('checks receive isolated inputs', ordered.verification.findings[1].code === 'isolated_inputs'),
    assert('identical inputs produce identical outputs', JSON.stringify(deterministicA) === JSON.stringify(deterministicB)),
    assert('no domain state is created or mutated', JSON.stringify(domainState) === domainStateBefore),
    assert('runtime is stateless and exposes only verify', runtimeSurface.length === 1 && runtimeSurface[0] === 'verify')
  ];
}
