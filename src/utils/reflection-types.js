export const REFLECTION_PROPOSAL_TYPES = {
  memoryPut: 'memory_put',
  memoryUpdate: 'memory_update',
  memoryMerge: 'memory_merge',
  memoryExpire: 'memory_expire',
  relationshipLink: 'relationship_link',
  relationshipUnlink: 'relationship_unlink',
  relationshipStrengthen: 'relationship_strengthen',
  relationshipWeaken: 'relationship_weaken'
};

export function listReflectionProposalTypes() {
  return Object.values(REFLECTION_PROPOSAL_TYPES);
}

export function isValidReflectionProposalType(proposalType) {
  return listReflectionProposalTypes().includes(proposalType);
}
