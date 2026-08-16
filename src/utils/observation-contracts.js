import {
  isValidObservationType,
  OBSERVATION_TYPES
} from './observation-types.js';

const TIMESTAMP_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/;
const PROVENANCE_ID_FIELDS = [
  'providerId',
  'modelId',
  'operationId',
  'requestId'
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

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year, month) {
  const days = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  return days[month - 1] || 0;
}

export function isValidObservationTimestamp(timestamp) {
  if (typeof timestamp !== 'string') {
    return false;
  }

  const match = timestamp.match(TIMESTAMP_PATTERN);

  if (!match) {
    return false;
  }

  const [, yearValue, monthValue, dayValue, hourValue, minuteValue, secondValue, offsetHourValue, offsetMinuteValue] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const hour = Number(hourValue);
  const minute = Number(minuteValue);
  const second = Number(secondValue);
  const offsetHour = offsetHourValue === undefined ? 0 : Number(offsetHourValue);
  const offsetMinute = offsetMinuteValue === undefined ? 0 : Number(offsetMinuteValue);

  return month >= 1
    && month <= 12
    && day >= 1
    && day <= daysInMonth(year, month)
    && hour <= 23
    && minute <= 59
    && second <= 59
    && offsetHour <= 14
    && offsetMinute <= 59
    && (offsetHour < 14 || offsetMinute === 0);
}

export function isValidObservationConfidence(confidence) {
  return confidence === undefined
    || confidence === null
    || (Number.isFinite(confidence) && confidence >= 0 && confidence <= 1);
}

export function isValidObservationPayload(payload) {
  return isPlainObject(payload);
}

export function isValidObservationProvenance(provenance) {
  if (!isPlainObject(provenance)
    || !isNonEmptyString(provenance.sourceType)
    || !isNonEmptyString(provenance.sourceId)) {
    return false;
  }

  return PROVENANCE_ID_FIELDS.every((field) => (
    provenance[field] === undefined || isNonEmptyString(provenance[field])
  ));
}

export function createObservation({
  observationId = '',
  type = '',
  source = '',
  subject = '',
  occurredAt = '',
  recordedAt = '',
  payload = {},
  provenance = {},
  confidence = null,
  metadata = {}
} = {}) {
  return {
    observationId,
    type,
    source,
    subject,
    occurredAt,
    recordedAt,
    payload: cloneObject(payload),
    provenance: cloneObject(provenance),
    confidence: confidence === undefined ? null : confidence,
    metadata: cloneObject(metadata)
  };
}

export function normalizeObservation(observation = {}) {
  return isPlainObject(observation) ? createObservation(observation) : null;
}

export function createObservationError(message, observation = null, detail = {}) {
  return {
    type: 'observation_contract_error',
    message,
    observationId: observation?.observationId || '',
    detail: cloneObject(detail)
  };
}

export function validateObservation(observation) {
  const errors = [];

  if (!isPlainObject(observation)) {
    return {
      ok: false,
      errors: ['Observation must be an object'],
      normalizedErrors: [createObservationError('Observation must be an object')]
    };
  }

  if (!isNonEmptyString(observation.observationId)) {
    errors.push('Observation observationId is required');
  }

  if (!isValidObservationType(observation.type)) {
    errors.push('Observation type is invalid');
  }

  if (!isNonEmptyString(observation.source)) {
    errors.push('Observation source is required');
  }

  if (!isNonEmptyString(observation.subject)) {
    errors.push('Observation subject is required');
  }

  if (!isValidObservationTimestamp(observation.occurredAt)) {
    errors.push('Observation occurredAt must be an explicit ISO 8601 timestamp');
  }

  if (observation.recordedAt !== undefined
    && observation.recordedAt !== ''
    && !isValidObservationTimestamp(observation.recordedAt)) {
    errors.push('Observation recordedAt must be empty or an explicit ISO 8601 timestamp');
  }

  if (!isValidObservationPayload(observation.payload)) {
    errors.push('Observation payload must be an object');
  }

  if (!isValidObservationProvenance(observation.provenance)) {
    errors.push('Observation provenance requires sourceType and sourceId');
  }

  if (!isValidObservationConfidence(observation.confidence)) {
    errors.push('Observation confidence must be null or between 0 and 1');
  }

  if (!isPlainObject(observation.metadata)) {
    errors.push('Observation metadata must be an object');
  }

  return {
    ok: errors.length === 0,
    errors,
    normalizedErrors: errors.map((error) => createObservationError(error, observation))
  };
}

export {
  isValidObservationType,
  OBSERVATION_TYPES
};
