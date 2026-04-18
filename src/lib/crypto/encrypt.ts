import crypto from "node:crypto";
import "server-only";

/**
 * Envelope encryption à deux niveaux :
 *   APP_MASTER_KEY (root) → chiffre chaque DEK (Data Encryption Key) par utilisateur
 *   DEK → chiffre les payloads credentials (SMTP, API keys, etc.)
 *
 * Rationale : rotation APP_MASTER_KEY sans re-chiffrer chaque credential
 * (il suffit de re-chiffrer les DEK). Limite le blast radius d'une fuite.
 */

const ALGO = "aes-256-gcm";
const KEY_LEN = 32;
const IV_LEN = 12; // GCM standard
const AUTH_TAG_LEN = 16;

function masterKey(): Buffer {
  const raw = process.env.APP_MASTER_KEY;
  if (!raw) throw new Error("APP_MASTER_KEY manquante dans l'environnement");
  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_LEN) {
    throw new Error(`APP_MASTER_KEY doit faire ${KEY_LEN} bytes en base64`);
  }
  return key;
}

export type SealedBlob = {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
};

function encryptBuffer(plaintext: Buffer, key: Buffer): SealedBlob {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { ciphertext, iv, authTag };
}

function decryptBuffer(blob: SealedBlob, key: Buffer): Buffer {
  if (blob.authTag.length !== AUTH_TAG_LEN) throw new Error("authTag invalide");
  const decipher = crypto.createDecipheriv(ALGO, key, blob.iv);
  decipher.setAuthTag(blob.authTag);
  return Buffer.concat([decipher.update(blob.ciphertext), decipher.final()]);
}

/** Génère une DEK aléatoire, la chiffre avec APP_MASTER_KEY.
 *  Retourne le blob scellé à stocker en DB (profiles.encrypted_dek). */
export function generateEncryptedDek(): Buffer {
  const dek = crypto.randomBytes(KEY_LEN);
  const sealed = encryptBuffer(dek, masterKey());
  // Format compact: iv(12) || authTag(16) || ciphertext
  return Buffer.concat([sealed.iv, sealed.authTag, sealed.ciphertext]);
}

function unpackDek(encryptedDek: Buffer): Buffer {
  if (encryptedDek.length < IV_LEN + AUTH_TAG_LEN + KEY_LEN) {
    throw new Error("encrypted_dek malformée");
  }
  const iv = encryptedDek.subarray(0, IV_LEN);
  const authTag = encryptedDek.subarray(IV_LEN, IV_LEN + AUTH_TAG_LEN);
  const ciphertext = encryptedDek.subarray(IV_LEN + AUTH_TAG_LEN);
  return decryptBuffer({ iv, authTag, ciphertext }, masterKey());
}

/** Chiffre un payload JSON avec la DEK de l'utilisateur.
 *  Utiliser dans une server action après avoir chargé `encrypted_dek` via service_role. */
export function encryptWithDek(
  encryptedDek: Buffer,
  plaintext: string | object
): SealedBlob {
  const dek = unpackDek(encryptedDek);
  const data = Buffer.from(typeof plaintext === "string" ? plaintext : JSON.stringify(plaintext), "utf8");
  try {
    return encryptBuffer(data, dek);
  } finally {
    dek.fill(0); // best-effort: clear from memory
  }
}

/** Déchiffre un payload credentials. Ne jamais retourner le résultat au client. */
export function decryptWithDek<T = unknown>(
  encryptedDek: Buffer,
  blob: SealedBlob
): T {
  const dek = unpackDek(encryptedDek);
  try {
    const plain = decryptBuffer(blob, dek);
    const str = plain.toString("utf8");
    try {
      return JSON.parse(str) as T;
    } catch {
      return str as unknown as T;
    }
  } finally {
    dek.fill(0);
  }
}

/** Calcule last4 safe à afficher côté UI comme teaser. */
export function last4(value: string): string {
  return value.slice(-4).padStart(4, "•");
}
