import crypto from "node:crypto";
import "server-only";

/**
 * Envelope encryption à deux niveaux :
 *   APP_MASTER_KEY (root) → chiffre chaque DEK (Data Encryption Key) par utilisateur
 *   DEK → chiffre les payloads credentials (SMTP, API keys, etc.)
 *
 * Toutes les E/S vers la DB passent par des strings base64 — les colonnes
 * correspondantes sont TEXT (voir migration 0006). Stocker en BYTEA via
 * supabase-js casse la sérialisation (Buffer → `{"type":"Buffer",...}`).
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
  ciphertext: string; // base64
  iv: string;         // base64
  authTag: string;    // base64
};

type SealedBytes = {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
};

function encryptBuffer(plaintext: Buffer, key: Buffer): SealedBytes {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { ciphertext, iv, authTag };
}

function decryptBuffer(blob: SealedBytes, key: Buffer): Buffer {
  if (blob.authTag.length !== AUTH_TAG_LEN) throw new Error("authTag invalide");
  const decipher = crypto.createDecipheriv(ALGO, key, blob.iv);
  decipher.setAuthTag(blob.authTag);
  return Buffer.concat([decipher.update(blob.ciphertext), decipher.final()]);
}

/** Génère une DEK aléatoire, la chiffre avec APP_MASTER_KEY.
 *  Retourne la DEK scellée en base64 (à stocker en profiles.encrypted_dek TEXT).
 *  Format interne : iv(12) || authTag(16) || ciphertext(32) → base64 */
export function generateEncryptedDek(): string {
  const dek = crypto.randomBytes(KEY_LEN);
  const sealed = encryptBuffer(dek, masterKey());
  return Buffer.concat([sealed.iv, sealed.authTag, sealed.ciphertext]).toString("base64");
}

function unpackDek(encryptedDekB64: string): Buffer {
  const packed = Buffer.from(encryptedDekB64, "base64");
  if (packed.length < IV_LEN + AUTH_TAG_LEN + KEY_LEN) {
    throw new Error("encrypted_dek malformée");
  }
  const iv = packed.subarray(0, IV_LEN);
  const authTag = packed.subarray(IV_LEN, IV_LEN + AUTH_TAG_LEN);
  const ciphertext = packed.subarray(IV_LEN + AUTH_TAG_LEN);
  return decryptBuffer({ iv, authTag, ciphertext }, masterKey());
}

/** Chiffre un payload JSON avec la DEK de l'utilisateur (DEK passée en base64). */
export function encryptWithDek(
  encryptedDekB64: string,
  plaintext: string | object
): SealedBlob {
  const dek = unpackDek(encryptedDekB64);
  const data = Buffer.from(
    typeof plaintext === "string" ? plaintext : JSON.stringify(plaintext),
    "utf8"
  );
  try {
    const sealed = encryptBuffer(data, dek);
    return {
      ciphertext: sealed.ciphertext.toString("base64"),
      iv: sealed.iv.toString("base64"),
      authTag: sealed.authTag.toString("base64"),
    };
  } finally {
    dek.fill(0); // best-effort: clear from memory
  }
}

/** Déchiffre un payload credentials. Ne jamais retourner le résultat au client. */
export function decryptWithDek<T = unknown>(
  encryptedDekB64: string,
  blob: SealedBlob
): T {
  const dek = unpackDek(encryptedDekB64);
  try {
    const plain = decryptBuffer(
      {
        ciphertext: Buffer.from(blob.ciphertext, "base64"),
        iv: Buffer.from(blob.iv, "base64"),
        authTag: Buffer.from(blob.authTag, "base64"),
      },
      dek
    );
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

// ============================================================
// Token signé pour liens d'unsubscribe (HMAC-SHA256 via APP_MASTER_KEY)
// Format: base64url(payloadJson) + "." + base64url(hmac)
// Payload: { u: userId, e: email, t: issuedAtMs }
// ============================================================

function b64urlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(str: string): Buffer {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export function makeUnsubscribeToken(userId: string, email: string): string {
  const payload = JSON.stringify({ u: userId, e: email.toLowerCase(), t: Date.now() });
  const data = b64urlEncode(Buffer.from(payload, "utf8"));
  const sig = crypto.createHmac("sha256", masterKey()).update(data).digest();
  return `${data}.${b64urlEncode(sig)}`;
}

export function verifyUnsubscribeToken(token: string): { userId: string; email: string } | null {
  const dot = token.indexOf(".");
  if (dot < 0) return null;
  const data = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  try {
    const expected = crypto.createHmac("sha256", masterKey()).update(data).digest();
    const given = b64urlDecode(sig);
    if (expected.length !== given.length) return null;
    if (!crypto.timingSafeEqual(expected, given)) return null;
    const parsed = JSON.parse(b64urlDecode(data).toString("utf8")) as { u?: string; e?: string };
    if (!parsed.u || !parsed.e) return null;
    return { userId: parsed.u, email: parsed.e };
  } catch {
    return null;
  }
}
