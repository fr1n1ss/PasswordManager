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

export interface TotpRecord {
  id: number;
  userId: number;
  serviceName: string;
  issuer: string;
  secret: string;
  digits: number;
  period: number;
}

export interface TotpPayload {
  serviceName: string;
  issuer: string;
  secret: string;
  digits: number;
  period: number;
}

export interface RotatedAccountPayload {
  id: number;
  encryptedPassword: string;
}

export interface RotatedNotePayload {
  id: number;
  encryptedContent: string;
}

export interface RotatedTotpPayload {
  id: number;
  encryptedPayload: string;
  nonce: string;
  version: number;
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

export async function verifyMasterPasswordLocally(masterPassword: string, salt: string, verifier?: string | null): Promise<boolean | null> {
  if (!verifier) {
    return null;
  }

  if (!verifier.startsWith(`${ZK_PREFIX}:`)) {
    return false;
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

export async function decryptTotpPayload(record: TotpRecord, masterPassword: string, salt: string): Promise<TotpPayload> {
  if (record.secret.startsWith(`${ZK_PREFIX}:`)) {
    const decrypted = await decryptStringWithKuznyechik(record.secret.slice(`${ZK_PREFIX}:`.length), record.issuer, masterPassword, salt);
    return JSON.parse(decrypted) as TotpPayload;
  }

  return {
    serviceName: record.serviceName,
    issuer: record.issuer,
    secret: record.secret,
    digits: record.digits || 6,
    period: record.period || 30,
  };
}

export async function canDecryptAnyPayload(
  accounts: AccountRecord[],
  notes: NoteRecord[],
  totpAccounts: TotpRecord[],
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

  const firstEncryptedTotp = totpAccounts.find((record) => record.secret.startsWith(`${ZK_PREFIX}:`));
  if (firstEncryptedTotp) {
    await decryptTotpPayload(firstEncryptedTotp, masterPassword, salt);
    return true;
  }

  return false;
}

export async function buildRotatedAccountPayloads(
  records: AccountRecord[],
  currentMasterPassword: string,
  nextMasterPassword: string,
  salt: string
): Promise<RotatedAccountPayload[]> {
  return Promise.all(records.map(async (record) => ({
    id: record.id,
    encryptedPassword: await encryptOpaquePayload(
      await decryptOpaquePayload(record.encryptedPassword, currentMasterPassword, salt),
      nextMasterPassword,
      salt
    ),
  })));
}

export async function buildRotatedNotePayloads(
  records: NoteRecord[],
  currentMasterPassword: string,
  nextMasterPassword: string,
  salt: string
): Promise<RotatedNotePayload[]> {
  return Promise.all(records.map(async (record) => ({
    id: record.id,
    encryptedContent: await encryptOpaquePayload(
      await decryptOpaquePayload(record.encryptedContent, currentMasterPassword, salt),
      nextMasterPassword,
      salt
    ),
  })));
}

export async function buildRotatedTotpPayloads(
  records: TotpRecord[],
  currentMasterPassword: string,
  nextMasterPassword: string,
  salt: string
): Promise<RotatedTotpPayload[]> {
  return Promise.all(records.map(async (record) => {
    const payload = await decryptTotpPayload(record, currentMasterPassword, salt);
    const encrypted = await encryptStringWithKuznyechik(JSON.stringify(payload), nextMasterPassword, salt);

    return {
      id: record.id,
      encryptedPayload: encrypted.ciphertext,
      nonce: encrypted.nonce,
      version: 1,
    };
  }));
}
