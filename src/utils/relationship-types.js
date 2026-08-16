export const RELATIONSHIP_TYPES = {
  relatedTo: 'related_to',
  supports: 'supports',
  contradicts: 'contradicts',
  derivedFrom: 'derived_from',
  references: 'references',
  parentOf: 'parent_of',
  childOf: 'child_of',
  duplicateOf: 'duplicate_of'
};

export const RELATIONSHIP_STATUS = {
  candidate: 'candidate',
  active: 'active',
  archived: 'archived',
  deleted: 'deleted'
};

export function listRelationshipTypes() {
  return Object.values(RELATIONSHIP_TYPES);
}

export function listRelationshipStatuses() {
  return Object.values(RELATIONSHIP_STATUS);
}

export function isValidRelationshipType(relationshipType) {
  return listRelationshipTypes().includes(relationshipType);
}

export function isValidRelationshipStatus(status) {
  return listRelationshipStatuses().includes(status);
}
