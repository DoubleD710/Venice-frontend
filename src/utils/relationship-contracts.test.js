import {
  createRelationship,
  createRelationshipError,
  isValidRelationshipConfidence,
  isValidRelationshipId,
  isValidRelationshipProvenance,
  isValidRelationshipType,
  normalizeRelationship,
  RELATIONSHIP_STATUS,
  RELATIONSHIP_TYPES,
  validateRelationship
} from './relationship-contracts.js';

function assert(name, condition) {
  return {
    name,
    passed: Boolean(condition)
  };
}

function createValidRelationship(overrides = {}) {
  return createRelationship({
    relationshipId: 'relationship-1',
    sourceMemoryId: 'memory-source-1',
    targetMemoryId: 'memory-target-1',
    relationshipType: RELATIONSHIP_TYPES.supports,
    confidence: 0.82,
    provenance: {
      source: 'memory-contract-test',
      evidence: ['Both memory cards mention the same project constraint.']
    },
    metadata: {
      test: true
    },
    createdAt: '2026-08-16T00:00:00.000Z',
    updatedAt: '2026-08-16T00:00:00.000Z',
    status: RELATIONSHIP_STATUS.active,
    ...overrides
  });
}

export function runRelationshipContractTests() {
  const validRelationship = createValidRelationship();
  const malformedRelationship = null;
  const invalidSource = createValidRelationship({ sourceMemoryId: '' });
  const invalidTarget = createValidRelationship({ targetMemoryId: '' });
  const invalidType = createValidRelationship({ relationshipType: 'causes' });
  const invalidConfidence = {
    ...createValidRelationship(),
    confidence: 1.2
  };
  const missingProvenance = createValidRelationship({ provenance: {} });
  const normalized = normalizeRelationship({
    relationshipId: 'relationship-normalized',
    sourceMemoryId: 'memory-a',
    targetMemoryId: 'memory-b',
    relationshipType: RELATIONSHIP_TYPES.references,
    confidence: 4,
    provenance: {
      source: 'normalization-test'
    },
    metadata: {
      nested: {
        value: true
      }
    },
    createdAt: 42,
    updatedAt: '2026-08-16T00:00:00.000Z',
    status: RELATIONSHIP_STATUS.candidate
  });
  const normalizedAgain = normalizeRelationship(validRelationship);
  const normalizedThird = normalizeRelationship(validRelationship);
  const normalizedError = createRelationshipError('Relationship test error', validRelationship, {
    reason: 'test'
  });
  const validationError = validateRelationship(invalidType).normalizedErrors[0];

  normalized.metadata.nested.value = false;

  return [
    assert('valid relationship', validateRelationship(validRelationship).ok),
    assert('malformed relationship', !validateRelationship(malformedRelationship).ok && validateRelationship(malformedRelationship).errors[0] === 'Relationship must be an object'),
    assert('invalid source id', !validateRelationship(invalidSource).ok && validateRelationship(invalidSource).errors.includes('Relationship sourceMemoryId is required')),
    assert('invalid target id', !validateRelationship(invalidTarget).ok && validateRelationship(invalidTarget).errors.includes('Relationship targetMemoryId is required')),
    assert('invalid relationship type', !validateRelationship(invalidType).ok && validateRelationship(invalidType).errors.includes('Relationship relationshipType is invalid')),
    assert('invalid confidence', !validateRelationship(invalidConfidence).ok && validateRelationship(invalidConfidence).errors.includes('Relationship confidence must be between 0 and 1')),
    assert('missing provenance', !validateRelationship(missingProvenance).ok && validateRelationship(missingProvenance).errors.includes('Relationship provenance.source is required')),
    assert('normalization', normalized.confidence === 1 && normalized.createdAt === '' && normalized.metadata.nested.value === false),
    assert('normalized errors', normalizedError.type === 'relationship_contract_error' && validationError.message === 'Relationship relationshipType is invalid'),
    assert('deterministic output for identical input', JSON.stringify(normalizedAgain) === JSON.stringify(normalizedThird)),
    assert('id validation', isValidRelationshipId('memory-1') && !isValidRelationshipId('')),
    assert('relationship type validation', isValidRelationshipType(RELATIONSHIP_TYPES.duplicateOf) && !isValidRelationshipType('domain_specific')),
    assert('confidence validation', isValidRelationshipConfidence(0.5) && !isValidRelationshipConfidence(-0.1)),
    assert('provenance validation', isValidRelationshipProvenance({ source: 'test' }) && !isValidRelationshipProvenance({}))
  ];
}
