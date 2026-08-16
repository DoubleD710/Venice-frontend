import {
  createVerification,
  createVerificationCheck,
  createVerificationFinding,
  isValidVerificationId,
  isValidVerificationProvenance,
  isValidVerificationTimestamp,
  validateVerification,
  validateVerificationCheck,
  VERIFICATION_STATUS
} from './verification-contracts.js';
import {
  normalizeObservation,
  validateObservation
} from './observation-contracts.js';

const STATUS_PRECEDENCE = [
  VERIFICATION_STATUS.rejected,
  VERIFICATION_STATUS.degraded,
  VERIFICATION_STATUS.uncertain,
  VERIFICATION_STATUS.verified
];

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function cloneObject(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeCheckDescriptor(check) {
  if (!isPlainObject(check)) {
    return check;
  }

  return {
    id: check.id,
    name: check.name,
    check: check.check
  };
}

function validateCheckDescriptors(checks) {
  const errors = [];

  if (!Array.isArray(checks) || checks.length === 0) {
    return {
      ok: false,
      errors: ['Verification Runtime requires at least one check']
    };
  }

  const checkIds = new Set();

  checks.forEach((check, index) => {
    if (!isPlainObject(check)) {
      errors.push(`Verification check ${index} must be an object`);
      return;
    }

    if (!isNonEmptyString(check.id)) {
      errors.push(`Verification check ${index} id is required`);
    } else if (checkIds.has(check.id)) {
      errors.push(`Verification check id is duplicated: ${check.id}`);
    } else {
      checkIds.add(check.id);
    }

    if (!isNonEmptyString(check.name)) {
      errors.push(`Verification check ${index} name is required`);
    }

    if (typeof check.check !== 'function') {
      errors.push(`Verification check ${index} check function is required`);
    }
  });

  return {
    ok: errors.length === 0,
    errors
  };
}

function createNormalizedError(code, message, category) {
  return {
    code,
    message,
    category
  };
}

function createRuntimeError(message, observationId = '', {
  verificationId = '',
  code = 'verification_runtime_error',
  category = 'runtime'
} = {}) {
  return {
    type: 'verification_runtime_result',
    status: 'error',
    verificationId,
    observationId,
    verification: null,
    error: message,
    normalizedError: createNormalizedError(code, message, category)
  };
}

function createRuntimeResult(verification) {
  return {
    type: 'verification_runtime_result',
    status: 'complete',
    verificationId: verification.verificationId,
    observationId: verification.observationId,
    verification,
    error: '',
    normalizedError: null
  };
}

function createFailedCheck(check, code, message, detail = {}) {
  return createVerificationCheck({
    checkId: check.id,
    name: check.name,
    status: VERIFICATION_STATUS.degraded,
    confidence: 0,
    finding: createVerificationFinding({
      findingId: `${check.id}-${code}`,
      code,
      message,
      metadata: detail
    }),
    metadata: {
      runtimeFailure: true,
      code
    }
  });
}

function executeCheck(check, observation, context) {
  let rawResult;

  try {
    rawResult = check.check(
      normalizeObservation(observation),
      cloneObject(context)
    );
  } catch (error) {
    return createFailedCheck(
      check,
      'check_execution_error',
      'Verification check failed during execution',
      {
        message: error instanceof Error ? error.message : 'Unknown check execution error'
      }
    );
  }

  if (rawResult && typeof rawResult.then === 'function') {
    return createFailedCheck(
      check,
      'unsupported_check_behavior',
      'Asynchronous verification checks are not supported in v0.1'
    );
  }

  if (!isPlainObject(rawResult)) {
    return createFailedCheck(
      check,
      'malformed_check_result',
      'Verification check returned a malformed result'
    );
  }

  let checkResult;

  try {
    checkResult = createVerificationCheck({
      ...rawResult,
      checkId: check.id,
      name: check.name
    });
  } catch {
    return createFailedCheck(
      check,
      'malformed_check_result',
      'Verification check returned a malformed result'
    );
  }

  const validation = validateVerificationCheck(checkResult);

  if (!validation.ok) {
    return createFailedCheck(
      check,
      'invalid_check_result',
      'Verification check returned an invalid result',
      { errors: validation.errors }
    );
  }

  return checkResult;
}

function aggregateStatus(checkResults) {
  return STATUS_PRECEDENCE.find((status) => (
    checkResults.some((check) => check.status === status)
  )) || VERIFICATION_STATUS.degraded;
}

function aggregateConfidence(checkResults) {
  const total = checkResults.reduce((sum, check) => sum + check.confidence, 0);

  return Math.max(0, Math.min(1, total / checkResults.length));
}

function validateExecutionContext(context, observationId) {
  const errors = [];

  if (!isPlainObject(context)) {
    return {
      ok: false,
      errors: ['Verification context must be an object']
    };
  }

  if (!isValidVerificationId(context.verificationId)) {
    errors.push('Verification context verificationId is required');
  }

  if (!isValidVerificationTimestamp(context.verifiedAt)) {
    errors.push('Verification context verifiedAt must be an explicit ISO 8601 timestamp');
  }

  if (!isValidVerificationProvenance(context.provenance)) {
    errors.push('Verification context provenance is invalid');
  } else if (context.provenance.observationId !== observationId) {
    errors.push('Verification context provenance observationId must match the observation');
  }

  if (context.metadata !== undefined && !isPlainObject(context.metadata)) {
    errors.push('Verification context metadata must be an object');
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

export function createVerificationRuntime({ checks = [] } = {}) {
  const configuredChecks = Array.isArray(checks)
    ? checks.map(normalizeCheckDescriptor)
    : checks;
  const descriptorValidation = validateCheckDescriptors(configuredChecks);

  function verify(observationInput, contextInput = {}) {
    let observation;
    let context;

    try {
      observation = normalizeObservation(observationInput);
      context = cloneObject(contextInput);
    } catch {
      return createRuntimeError('Verification input could not be normalized', '', {
        code: 'verification_runtime_normalization_error'
      });
    }

    const observationValidation = validateObservation(observation);

    if (!observationValidation.ok) {
      return createRuntimeError(observationValidation.errors[0], observation?.observationId || '', {
        verificationId: context?.verificationId || '',
        code: 'verification_runtime_invalid_observation',
        category: 'contract'
      });
    }

    if (!descriptorValidation.ok) {
      return createRuntimeError(descriptorValidation.errors[0], observation.observationId, {
        verificationId: context?.verificationId || '',
        code: 'verification_runtime_invalid_check',
        category: 'configuration'
      });
    }

    const contextValidation = validateExecutionContext(context, observation.observationId);

    if (!contextValidation.ok) {
      return createRuntimeError(contextValidation.errors[0], observation.observationId, {
        verificationId: context?.verificationId || '',
        code: 'verification_runtime_invalid_context',
        category: 'precondition'
      });
    }

    const checkResults = configuredChecks.map((check) => (
      executeCheck(check, observation, context)
    ));
    const verification = createVerification({
      verificationId: context.verificationId,
      observationId: observation.observationId,
      status: aggregateStatus(checkResults),
      confidence: aggregateConfidence(checkResults),
      checks: checkResults,
      findings: checkResults.map((check) => check.finding),
      provenance: context.provenance,
      metadata: context.metadata || {},
      verifiedAt: context.verifiedAt
    });
    const verificationValidation = validateVerification(verification);

    if (!verificationValidation.ok) {
      return createRuntimeError(verificationValidation.errors[0], observation.observationId, {
        verificationId: context.verificationId,
        code: 'verification_runtime_invalid_aggregation',
        category: 'aggregation'
      });
    }

    return createRuntimeResult(verification);
  }

  return {
    verify
  };
}
