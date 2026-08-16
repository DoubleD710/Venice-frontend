import {
  normalizeReflectionProposal,
  validateReflectionProposal
} from './reflection-contracts.js';
import {
  normalizeVerification,
  validateVerification
} from './verification-contracts.js';

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cloneValue(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function createNormalizedError(code, message, category, detail = {}) {
  return {
    code,
    message,
    category,
    detail: cloneValue(detail)
  };
}

function createRuntimeError(message, {
  code = 'reflection_runtime_error',
  category = 'runtime',
  verificationIds = [],
  detail = {}
} = {}) {
  return {
    type: 'reflection_runtime_result',
    status: 'error',
    verificationIds: [...verificationIds],
    proposals: [],
    rejections: [],
    error: message,
    normalizedError: createNormalizedError(code, message, category, detail)
  };
}

function createRuntimeResult(verificationIds, proposals, rejections) {
  return {
    type: 'reflection_runtime_result',
    status: 'complete',
    verificationIds: [...verificationIds],
    proposals: cloneValue(proposals),
    rejections: cloneValue(rejections),
    error: '',
    normalizedError: null
  };
}

function createProposalRejection(index, proposal, message, {
  code = 'reflection_runtime_invalid_proposal',
  category = 'contract',
  detail = {}
} = {}) {
  return {
    type: 'reflection_proposal_rejection',
    status: 'rejected',
    index,
    proposalId: proposal?.proposalId || '',
    proposalType: proposal?.proposalType || '',
    error: message,
    normalizedError: createNormalizedError(code, message, category, detail)
  };
}

function normalizeVerificationInput(verificationInput) {
  if (!Array.isArray(verificationInput) || verificationInput.length === 0) {
    return {
      ok: false,
      error: 'Reflection Runtime requires at least one Verification Result',
      code: 'reflection_runtime_invalid_verification_input',
      verificationIds: []
    };
  }

  const verifications = [];
  const verificationIds = [];
  const seenIds = new Set();

  for (let index = 0; index < verificationInput.length; index += 1) {
    let verification;

    try {
      verification = normalizeVerification(verificationInput[index]);
    } catch {
      return {
        ok: false,
        error: `Verification Result ${index} could not be normalized`,
        code: 'reflection_runtime_verification_normalization_error',
        verificationIds
      };
    }

    const validation = validateVerification(verification);

    if (!validation.ok) {
      return {
        ok: false,
        error: `Verification Result ${index}: ${validation.errors[0]}`,
        code: 'reflection_runtime_invalid_verification',
        verificationIds
      };
    }

    if (seenIds.has(verification.verificationId)) {
      return {
        ok: false,
        error: `Verification Result id is duplicated: ${verification.verificationId}`,
        code: 'reflection_runtime_duplicate_verification',
        verificationIds
      };
    }

    seenIds.add(verification.verificationId);
    verificationIds.push(verification.verificationId);
    verifications.push(verification);
  }

  return {
    ok: true,
    verifications,
    verificationIds
  };
}

function rejectProposalCandidate(candidate, index, verificationIdSet) {
  let proposal;

  try {
    proposal = normalizeReflectionProposal(candidate);
  } catch {
    return createProposalRejection(
      index,
      null,
      'Reflection proposal could not be normalized',
      { code: 'reflection_runtime_proposal_normalization_error' }
    );
  }

  const validation = validateReflectionProposal(proposal);

  if (!validation.ok) {
    return createProposalRejection(index, proposal, validation.errors[0], {
      detail: { errors: validation.errors }
    });
  }

  const missingVerificationIds = proposal.sourceVerificationIds.filter(
    (verificationId) => !verificationIdSet.has(verificationId)
  );

  if (missingVerificationIds.length > 0) {
    return createProposalRejection(
      index,
      proposal,
      `Reflection proposal references unavailable Verification Result: ${missingVerificationIds[0]}`,
      {
        code: 'reflection_runtime_unknown_verification_reference',
        category: 'precondition',
        detail: { missingVerificationIds }
      }
    );
  }

  return null;
}

export function createReflectionRuntime({ strategy } = {}) {
  function reflect(verificationInput, contextInput = {}) {
    const normalizedInput = normalizeVerificationInput(verificationInput);

    if (!normalizedInput.ok) {
      return createRuntimeError(normalizedInput.error, {
        code: normalizedInput.code,
        category: 'contract',
        verificationIds: normalizedInput.verificationIds
      });
    }

    if (!strategy || typeof strategy.reflect !== 'function') {
      return createRuntimeError('Reflection Runtime requires an injected strategy', {
        code: 'reflection_runtime_strategy_unavailable',
        category: 'configuration',
        verificationIds: normalizedInput.verificationIds
      });
    }

    if (!isPlainObject(contextInput)) {
      return createRuntimeError('Reflection context must be an object', {
        code: 'reflection_runtime_invalid_context',
        category: 'precondition',
        verificationIds: normalizedInput.verificationIds
      });
    }

    let candidates;

    try {
      candidates = strategy.reflect(
        cloneValue(normalizedInput.verifications),
        cloneValue(contextInput)
      );
    } catch (error) {
      return createRuntimeError(
        error instanceof Error ? error.message : 'Reflection strategy failed',
        {
          code: 'reflection_runtime_strategy_failure',
          category: 'strategy',
          verificationIds: normalizedInput.verificationIds
        }
      );
    }

    if (candidates && typeof candidates.then === 'function') {
      return createRuntimeError('Asynchronous reflection strategies are not supported', {
        code: 'reflection_runtime_async_strategy_unsupported',
        category: 'strategy',
        verificationIds: normalizedInput.verificationIds
      });
    }

    if (!Array.isArray(candidates)) {
      return createRuntimeError('Reflection strategy must return an array of proposal candidates', {
        code: 'reflection_runtime_malformed_strategy_result',
        category: 'strategy',
        verificationIds: normalizedInput.verificationIds
      });
    }

    const proposals = [];
    const rejections = [];
    const verificationIdSet = new Set(normalizedInput.verificationIds);

    candidates.forEach((candidate, index) => {
      const rejection = rejectProposalCandidate(candidate, index, verificationIdSet);

      if (rejection) {
        rejections.push(rejection);
        return;
      }

      proposals.push(normalizeReflectionProposal(candidate));
    });

    return createRuntimeResult(
      normalizedInput.verificationIds,
      proposals,
      rejections
    );
  }

  return {
    reflect
  };
}
