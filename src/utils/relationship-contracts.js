import {
  isValidRelationshipStatus,
  isValidRelationshipType,
  RELATIONSHIP_STATUS,
  RELATIONSHIP_TYPES
} from './relationship-types.js';

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function clonePlainObject(value = {}) {
  return isPlainObject(value) ? JSON.parse(JSON.stringify(value)) : {};
}

function normalizeTimestamp(value = '') {
  return typeof value === 'string' ? value : '';
}

function normalizeConfidence(value = 0) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

export function isValidRelationshipId(id) {
  return typeof id === 'string' && id.trim().length > 0;
}

export function isValidRelationshipConfidence(confidence) {
  return Number.isFinite(confidence) && confidence >= 0 && confidence <= 1;
}

export function isValidRelationshipProvenance(provenance) {
  return isPlainObject(provenance)
    && typeof provenance.source === 'string'
    && provenance.source.trim().length > 0;
}

export function createRelationshipError(message, relationship = null, detail = {}) {
  return {
    type: 'relationship_contract_error',
    message,
    relationshipId: relationship?.relationshipId || '',
    detail: clonePlainObject(detail)
  };
}

export function createRelationship({
  relationshipId = '',
  sourceMemoryId = '',
  targetMemoryId = '',
  relationshipType = RELATIONSHIP_TYPES.relatedTo,
  confidence = 0,
  provenance = {},
  metadata = {},
  createdAt = '',
  updatedAt = '',
  status = RELATIONSHIP_STATUS.candidate
} = {}) {
  return {
    relationshipId,
    sourceMemoryId,
    targetMemoryId,
    relationshipType,
    confidence: normalizeConfidence(confidence),
    provenance: clonePlainObject(provenance),
    metadata: clonePlainObject(metadata),
    createdAt: normalizeTimestamp(createdAt),
    updatedAt: normalizeTimestamp(updatedAt),
    status
  };
}

export function normalizeRelationship(relationship = {}) {
  return createRelationship(isPlainObject(relationship) ? relationship : {});
}

export function validateRelationship(relationship) {
  const errors = [];

  if (!isPlainObject(relationship)) {
    return {
      ok: false,
      errors: ['Relationship must be an object'],
      normalizedErrors: [
        createRelationshipError('Relationship must be an object')
      ]
    };
  }

  if (!isValidRelationshipId(relationship.relationshipId)) {
    errors.push('Relationship relationshipId is required');
  }

  if (!isValidRelationshipId(relationship.sourceMemoryId)) {
    errors.push('Relationship sourceMemoryId is required');
  }

  if (!isValidRelationshipId(relationship.targetMemoryId)) {
    errors.push('Relationship targetMemoryId is required');
  }

  if (!isValidRelationshipType(relationship.relationshipType)) {
    errors.push('Relationship relationshipType is invalid');
  }

  if (!isValidRelationshipConfidence(relationship.confidence)) {
    errors.push('Relationship confidence must be between 0 and 1');
  }

  if (!isValidRelationshipProvenance(relationship.provenance)) {
    errors.push('Relationship provenance.source is required');
  }

  if (!isPlainObject(relationship.metadata)) {
    errors.push('Relationship metadata must be an object');
  }

  if (typeof relationship.createdAt !== 'string') {
    errors.push('Relationship createdAt must be a string');
  }

  if (typeof relationship.updatedAt !== 'string') {
    errors.push('Relationship updatedAt must be a string');
  }

  if (!isValidRelationshipStatus(relationship.status)) {
    errors.push('Relationship status is invalid');
  }

  return {
    ok: errors.length === 0,
    errors,
    normalizedErrors: errors.map((error) => createRelationshipError(error, relationship))
  };
}

export {
  isValidRelationshipStatus,
  isValidRelationshipType,
  RELATIONSHIP_STATUS,
  RELATIONSHIP_TYPES
};
