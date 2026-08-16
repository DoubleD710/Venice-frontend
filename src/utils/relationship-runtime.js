import {
  normalizeRelationship,
  RELATIONSHIP_STATUS,
  validateRelationship
} from './relationship-contracts.js';
import {
  createRelationshipOperationEvent,
  isValidRelationshipStrengthAdjustment,
  RELATIONSHIP_OPERATION_TYPES,
  RELATIONSHIP_OPERATION_VALIDATION_STATUS
} from './relationship-operation-contracts.js';

export const RELATIONSHIP_RUNTIME_PHASES = {
  linked: 'relationship_linked',
  unlinked: 'relationship_unlinked',
  strengthened: 'relationship_strengthened',
  weakened: 'relationship_weakened',
  rejected: 'relationship_operation_rejected',
  error: 'relationship_runtime_error'
};

function snapshotRelationship(relationship) {
  return relationship ? normalizeRelationship(relationship) : null;
}

function createNormalizedError(code, message, category) {
  return {
    code,
    message,
    category
  };
}

function createRuntimeResult(operation, relationship, event, detail = {}) {
  return {
    type: 'relationship_runtime_result',
    status: 'complete',
    operationId: operation.operationId,
    idempotencyKey: operation.idempotencyKey,
    operationType: operation.operationType,
    relationshipId: operation.relationshipId,
    relationship: snapshotRelationship(relationship),
    event,
    error: '',
    normalizedError: null,
    ...detail
  };
}

function createRuntimeError(message, operation, event, {
  code = 'relationship_runtime_rejected',
  category = 'precondition'
} = {}) {
  return {
    type: 'relationship_runtime_result',
    status: 'error',
    operationId: operation?.operationId || '',
    idempotencyKey: operation?.idempotencyKey || '',
    operationType: operation?.operationType || '',
    relationshipId: operation?.relationshipId || '',
    relationship: null,
    event,
    error: message,
    normalizedError: createNormalizedError(code, message, category)
  };
}

function clampConfidence(confidence) {
  return Math.max(0, Math.min(1, confidence));
}

export function createRelationshipRuntime({ onEvent = null } = {}) {
  const relationships = new Map();

  function emit(phase, operation, detail = {}) {
    const event = createRelationshipOperationEvent(phase, operation, {
      runtime: 'relationship-runtime',
      ...detail
    });

    if (typeof onEvent === 'function') {
      onEvent(event);
    }

    return event;
  }

  function reject(message, operation, code = 'relationship_runtime_rejected') {
    const event = emit(RELATIONSHIP_RUNTIME_PHASES.rejected, operation, { message });

    return createRuntimeError(message, operation, event, { code });
  }

  function runMutation(operation, expectedType, mutation) {
    if (!operation || typeof operation !== 'object' || Array.isArray(operation)) {
      return reject('Relationship operation must be an object', operation, 'relationship_runtime_invalid_operation');
    }

    if (operation.operationType !== expectedType) {
      return reject(
        `Relationship Runtime expected ${expectedType} operation`,
        operation,
        'relationship_runtime_operation_mismatch'
      );
    }

    if (operation.validationStatus !== RELATIONSHIP_OPERATION_VALIDATION_STATUS.valid) {
      return reject(
        'Relationship operation validationStatus must be valid',
        operation,
        'relationship_runtime_operation_not_validated'
      );
    }

    try {
      return mutation();
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'Relationship Runtime encountered an unknown error';
      const event = emit(RELATIONSHIP_RUNTIME_PHASES.error, operation, { message });

      return createRuntimeError(message, operation, event, {
        code: 'relationship_runtime_error',
        category: 'runtime'
      });
    }
  }

  function findExactEdge(relationship) {
    return Array.from(relationships.values()).find((storedRelationship) => (
      storedRelationship.sourceMemoryId === relationship.sourceMemoryId
      && storedRelationship.targetMemoryId === relationship.targetMemoryId
      && storedRelationship.relationshipType === relationship.relationshipType
    )) || null;
  }

  function linkRelationship(operation) {
    return runMutation(operation, RELATIONSHIP_OPERATION_TYPES.link, () => {
      const relationship = operation.payload?.relationship;
      const validation = validateRelationship(relationship);

      if (!validation.ok) {
        return reject(validation.errors[0], operation, 'relationship_runtime_invalid_relationship');
      }

      if (relationship.relationshipId !== operation.relationshipId) {
        return reject(
          'Relationship operation relationshipId must match the relationship payload',
          operation,
          'relationship_runtime_identity_mismatch'
        );
      }

      if ([RELATIONSHIP_STATUS.archived, RELATIONSHIP_STATUS.deleted].includes(relationship.status)) {
        return reject(
          'Archived or deleted relationships cannot be linked',
          operation,
          'relationship_runtime_invalid_status'
        );
      }

      if (relationships.has(operation.relationshipId) || findExactEdge(relationship)) {
        return reject(
          'Relationship already exists',
          operation,
          'relationship_runtime_duplicate'
        );
      }

      const linkedRelationship = normalizeRelationship({
        ...relationship,
        status: RELATIONSHIP_STATUS.active,
        updatedAt: operation.timestamp
      });

      relationships.set(linkedRelationship.relationshipId, linkedRelationship);

      const event = emit(RELATIONSHIP_RUNTIME_PHASES.linked, operation, {
        relationship: snapshotRelationship(linkedRelationship)
      });

      return createRuntimeResult(operation, linkedRelationship, event);
    });
  }

  function unlinkRelationship(operation) {
    return runMutation(operation, RELATIONSHIP_OPERATION_TYPES.unlink, () => {
      const relationship = relationships.get(operation.relationshipId);

      if (!relationship) {
        return reject(
          'Relationship was not found',
          operation,
          'relationship_runtime_not_found'
        );
      }

      relationships.delete(operation.relationshipId);

      const unlinkedRelationship = normalizeRelationship({
        ...relationship,
        status: RELATIONSHIP_STATUS.deleted,
        updatedAt: operation.timestamp
      });
      const event = emit(RELATIONSHIP_RUNTIME_PHASES.unlinked, operation, {
        relationship: snapshotRelationship(unlinkedRelationship)
      });

      return createRuntimeResult(operation, unlinkedRelationship, event, {
        removed: true
      });
    });
  }

  function adjustRelationship(operation, direction) {
    const relationship = relationships.get(operation.relationshipId);

    if (!relationship) {
      return reject(
        'Relationship was not found',
        operation,
        'relationship_runtime_not_found'
      );
    }

    if (relationship.status !== RELATIONSHIP_STATUS.active) {
      return reject(
        'Only active relationships can change confidence',
        operation,
        'relationship_runtime_invalid_status'
      );
    }

    const confidenceDelta = operation.payload?.confidenceDelta;

    if (!isValidRelationshipStrengthAdjustment(confidenceDelta)) {
      return reject(
        'Relationship confidenceDelta must be greater than 0 and at most 1',
        operation,
        'relationship_runtime_invalid_adjustment'
      );
    }

    const previousConfidence = relationship.confidence;
    const nextConfidence = clampConfidence(
      previousConfidence + (direction === 'increase' ? confidenceDelta : -confidenceDelta)
    );
    const updatedRelationship = normalizeRelationship({
      ...relationship,
      confidence: nextConfidence,
      updatedAt: operation.timestamp
    });

    relationships.set(operation.relationshipId, updatedRelationship);

    const phase = direction === 'increase'
      ? RELATIONSHIP_RUNTIME_PHASES.strengthened
      : RELATIONSHIP_RUNTIME_PHASES.weakened;
    const event = emit(phase, operation, {
      previousConfidence,
      confidence: updatedRelationship.confidence
    });

    return createRuntimeResult(operation, updatedRelationship, event, {
      previousConfidence,
      confidenceDelta
    });
  }

  function strengthenRelationship(operation) {
    return runMutation(operation, RELATIONSHIP_OPERATION_TYPES.strengthen, () => (
      adjustRelationship(operation, 'increase')
    ));
  }

  function weakenRelationship(operation) {
    return runMutation(operation, RELATIONSHIP_OPERATION_TYPES.weaken, () => (
      adjustRelationship(operation, 'decrease')
    ));
  }

  function getRelationship(relationshipId) {
    return snapshotRelationship(relationships.get(relationshipId));
  }

  function listRelationships() {
    return Array.from(relationships.values()).map(snapshotRelationship);
  }

  return {
    linkRelationship,
    unlinkRelationship,
    strengthenRelationship,
    weakenRelationship,
    getRelationship,
    listRelationships
  };
}
