import { decryptStringWithKuznyechik, encryptStringWithKuznyechik } from './kuznyechik.ts';

const ZK_PREFIX = 'zk1';
const VERIFIER_PLAINTEXT = 'password-manager-master-password-verifier';

export interface AccountRecord {
  id: number;
  userID: number;
  serviceName: string;
  login: string;
  encryptedPassword: string;
  description: string;
  url: string;
  creationDate: string;
  isFavorite?: boolean;
}

export interface NoteRecord {
  id: number;
  userID: number;
  title: string;
  encryptedContent: string;
  createdAt: string;
  updatedAt: string;
  isFavorite?: boolean;
}

export async function createMasterPasswordVerifier(masterPassword: string, salt: string): Promise<string> {
  return encryptOpaquePayload(VERIFIER_PLAINTEXT, masterPassword, salt);
}

export function generateClientSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

export async function verifyMasterPasswordLocally(masterPassword: string, salt: string, verifier?: string | null): Promise<boolean> {
  if (!verifier) {
    return true;
  }

  try {
    const decrypted = await decryptOpaquePayload(verifier, masterPassword, salt);
    return decrypted === VERIFIER_PLAINTEXT;
  } catch {
    return false;
  }
}

export async function encryptOpaquePayload(plainText: string, masterPassword: string, salt: string): Promise<string> {
  const encrypted = await encryptStringWithKuznyechik(plainText, masterPassword, salt);
  return `${ZK_PREFIX}:${encrypted.nonce}:${encrypted.ciphertext}`;
}

export async function decryptOpaquePayload(payload: string, masterPassword: string, salt: string): Promise<string> {
  if (payload.startsWith(`${ZK_PREFIX}:`)) {
    const parts = payload.split(':', 3);
    if (parts.length !== 3) {
      throw new Error('Invalid zero-knowledge payload format');
    }

    return decryptStringWithKuznyechik(parts[2], parts[1], masterPassword, salt);
  }

  return payload;
}

export async function decryptAccounts(records: AccountRecord[], masterPassword: string, salt: string): Promise<AccountRecord[]> {
  return Promise.all(records.map(async (record) => ({
    ...record,
    encryptedPassword: await decryptOpaquePayload(record.encryptedPassword, masterPassword, salt),
  })));
}

export async function decryptNotes(records: NoteRecord[], masterPassword: string, salt: string): Promise<NoteRecord[]> {
  return Promise.all(records.map(async (record) => ({
    ...record,
    encryptedContent: await decryptOpaquePayload(record.encryptedContent, masterPassword, salt),
  })));
}

export async function canDecryptAnyPayload(
  accounts: AccountRecord[],
  notes: NoteRecord[],
  masterPassword: string,
  salt: string
): Promise<boolean> {
  const firstEncryptedAccount = accounts.find((record) => record.encryptedPassword.startsWith(`${ZK_PREFIX}:`));
  if (firstEncryptedAccount) {
    await decryptOpaquePayload(firstEncryptedAccount.encryptedPassword, masterPassword, salt);
    return true;
  }

  const firstEncryptedNote = notes.find((record) => record.encryptedContent.startsWith(`${ZK_PREFIX}:`));
  if (firstEncryptedNote) {
    await decryptOpaquePayload(firstEncryptedNote.encryptedContent, masterPassword, salt);
    return true;
  }

  return false;
}
