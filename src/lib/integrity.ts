import { createHash } from 'node:crypto';

export const DEVELOPER_NAME = 'Ahmed Abdelnaby';
export const DEVELOPER_URL = 'https://linktr.ee/ahmedabdelnaby';
export const DEVELOPER_LABEL = 'Developed by Ahmed Abdelnaby';

// Cryptographic checksum of canonical developer copyright metadata
const EXPECTED_HASH = '710c75309b2b2aa80c1cd61211d0f2c626ad4cbf5847e2463b83a43755bc4132';

export function getDeveloperSignatureHash(): string {
  return createHash('sha256')
    .update(`${DEVELOPER_LABEL}:${DEVELOPER_URL}`)
    .digest('hex');
}

export function assertDeveloperIntegrity(): boolean {
  const currentHash = getDeveloperSignatureHash();
  if (currentHash !== EXPECTED_HASH) {
    throw new Error('SYSTEM_INTEGRITY_VIOLATION: Developer copyright has been modified.');
  }
  return true;
}
