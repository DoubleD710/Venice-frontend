import { isValidObservationTimestamp } from './observation-contracts.js';
import {
  isValidVerificationStatus,
  VERIFICATION_STATUS
} from './verification-types.js';

const OPTIONAL_PROVENANCE_ID_FIELDS = [
  'operationId',
  'providerId',
  'modelId'
];

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cloneObject(value) {
  if (value === undefined) {
    return {};
  }

  return isPlainObject(value) ? JSON.parse(JSON.stringify(value)) : value;
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeArray(value, normalizer) {
  return Array.isArray(value) ? value.map(normalizer) : value;
}

export function isValidVerificationId(id) {
  return isNonEmptyString(id);
}

export function isValidVerificationObservationId(observationId) {
  return isNonEmptyString(observationId);
}

export function isValidVerificationConfidence(confidence) {
  return Number.isFinite(confidence) && confidence >= 0 && confidence <= 1;
}

export function isValidVerificationTimestamp(timestamp) {
  return isValidObservationTimestamp(timestamp);
}

export function isValidVerificationProvenance(provenance) {
  if (!isPlainObject(provenance)
    || !isNonEmptyString(provenance.source)
    || !isNonEmptyString(provenance.verifierId)
    || !isNonEmptyString(provenance.observationId)) {
    return false;
  }

  return OPTIONAL_PROVENANCE_ID_FIELDS.every((field) => (
    provenance[field] === undefined || isNonEmptyString(provenance[field])
  ));
}

export function createVerificationFinding({
  findingId = '',
  code = '',
  message = '',
  metadata = {}
} = {}) {
  return {
    findingId,
    code,
    message,
    metadata: cloneObject(metadata)
  };
}

export function normalizeVerificationFinding(finding = {}) {
  return isPlainObject(finding) ? createVerificationFinding(finding) : finding;
}

export function validateVerificationFinding(finding) {
  const errors = [];

  if (!isPlainObject(finding)) {
    return {
      ok: false,
      errors: ['Verification finding must be an object']
    };
  }

  if (!isNonEmptyString(finding.findingId)) {
    errors.push('Verification finding findingId is required');
  }

  if (!isNonEmptyString(finding.code)) {
    errors.push('Verification finding code is required');
  }

  if (!isNonEmptyString(finding.message)) {
    errors.push('Verification finding message is required');
  }

  if (!isPlainObject(finding.metadata)) {
    errors.push('Verification finding metadata must be an object');
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

export function createVerificationCheck({
  checkId = '',
  name = '',
  status = '',
  confidence = null,
  finding = null,
  metadata = {}
} = {}) {
  return {
    checkId,
    name,
    status,
    confidence,
    finding: normalizeVerificationFinding(finding),
    metadata: cloneObject(metadata)
  };
}

export function normalizeVerificationCheck(check = {}) {
  return isPlainObject(check) ? createVerificationCheck(check) : check;
}

export function validateVerificationCheck(check) {
  const errors = [];

  if (!isPlainObject(check)) {
    return {
      ok: false,
      errors: ['Verification check must be an object']
    };
  }

  if (!isNonEmptyString(check.checkId)) {
    errors.push('Verification check checkId is required');
  }

  if (!isNonEmptyString(check.name)) {
    errors.push('Verification check name is required');
  }

  if (!isValidVerificationStatus(check.status)) {
    errors.push('Verification check status is invalid');
  }

  if (!isValidVerificationConfidence(check.confidence)) {
    errors.push('Verification check confidence must be between 0 and 1');
  }

  const findingValidation = validateVerificationFinding(check.finding);

  findingValidation.errors.forEach((error) => {
    errors.push(`Verification check finding: ${error}`);
  });

  if (!isPlainObject(check.metadata)) {
    errors.push('Verification check metadata must be an object');
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

export function createVerification({
  verificationId = '',
  observationId = '',
  status = '',
  confidence = null,
  checks = [],
  findings = [],
  provenance = {},
  metadata = {},
  verifiedAt = ''
} = {}) {
  return {
    verificationId,
    observationId,
    status,
    confidence,
    checks: normalizeArray(checks, normalizeVerificationCheck),
    findings: normalizeArray(findings, normalizeVerificationFinding),
    provenance: cloneObject(provenance),
    metadata: cloneObject(metadata),
    verifiedAt
  };
}

export function normalizeVerification(verification = {}) {
  return isPlainObject(verification) ? createVerification(verification) : null;
}

export function createVerificationError(message, verification = null, detail = {}) {
  return {
    type: 'verification_contract_error',
    message,
    verificationId: verification?.verificationId || '',
    observationId: verification?.observationId || '',
    detail: cloneObject(detail)
  };
}

export function validateVerification(verification) {
  const errors = [];

  if (!isPlainObject(verification)) {
    return {
      ok: false,
      errors: ['Verification must be an object'],
      normalizedErrors: [createVerificationError('Verification must be an object')]
    };
  }

  if (!isValidVerificationId(verification.verificationId)) {
    errors.push('Verification verificationId is required');
  }

  if (!isValidVerificationObservationId(verification.observationId)) {
    errors.push('Verification observationId is required');
  }

  if (!isValidVerificationStatus(verification.status)) {
    errors.push('Verification status is invalid');
  }

  if (!isValidVerificationConfidence(verification.confidence)) {
    errors.push('Verification confidence must be between 0 and 1');
  }

  if (!Array.isArray(verification.checks)) {
    errors.push('Verification checks must be an array');
  } else {
    verification.checks.forEach((check, index) => {
      validateVerificationCheck(check).errors.forEach((error) => {
        errors.push(`Verification check ${index}: ${error}`);
      });
    });
  }

  if (!Array.isArray(verification.findings)) {
    errors.push('Verification findings must be an array');
  } else {
    verification.findings.forEach((finding, index) => {
      validateVerificationFinding(finding).errors.forEach((error) => {
        errors.push(`Verification finding ${index}: ${error}`);
      });
    });
  }

  if (!isValidVerificationProvenance(verification.provenance)) {
    errors.push('Verification provenance requires source, verifierId, and observationId');
  } else if (verification.provenance.observationId !== verification.observationId) {
    errors.push('Verification provenance observationId must match verification observationId');
  }

  if (!isPlainObject(verification.metadata)) {
    errors.push('Verification metadata must be an object');
  }

  if (!isValidVerificationTimestamp(verification.verifiedAt)) {
    errors.push('Verification verifiedAt must be an explicit ISO 8601 timestamp');
  }

  return {
    ok: errors.length === 0,
    errors,
    normalizedErrors: errors.map((error) => createVerificationError(error, verification))
  };
}

export {
  isValidVerificationStatus,
  VERIFICATION_STATUS
};
