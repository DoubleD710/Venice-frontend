export const VERIFICATION_STATUS = {
  verified: 'verified',
  rejected: 'rejected',
  uncertain: 'uncertain',
  degraded: 'degraded'
};

export function listVerificationStatuses() {
  return Object.values(VERIFICATION_STATUS);
}

export function isValidVerificationStatus(status) {
  return listVerificationStatuses().includes(status);
}
