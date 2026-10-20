import crypto from "crypto";

const ENCRYPTION_ALGO = "aes-256-gcm";
const FORMAT_PREFIX = "otterpie:v2:";

function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.scryptSync(password, salt, 32);
}

function decryptLayer(payload: string, password: string): string {
  const data = Buffer.from(payload, "base64");
  if (data.length < 44) throw new Error("Invalid encrypted payload");

  const salt = data.subarray(0, 16);
  const iv = data.subarray(16, 28);
  const authTag = data.subarray(28, 44);
  const encrypted = data.subarray(44);
  const key = deriveKey(password, salt);

  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGO, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}

function requiredKey(value: string | undefined, keyName: string): string {
  if (!value) throw new Error(`Missing decryption key: ${keyName}`);
  return value;
}

const decryptText = (payload: string, password: string): string => {
  const baseKey = requiredKey(password, "WALLET_BANK_KEY");

  // Existing rows use the original single-layer format and remain readable.
  if (!payload.startsWith(FORMAT_PREFIX)) {
    return decryptLayer(payload, baseKey);
  }

  const key1 = requiredKey(process.env.WALLET_BANK_KEY_1, "WALLET_BANK_KEY_1");
  const key2 = requiredKey(process.env.WALLET_BANK_KEY_2, "WALLET_BANK_KEY_2");
  const thirdLayer = payload.slice(FORMAT_PREFIX.length);

  // Decrypt in reverse order from encryption.
  const secondLayer = decryptLayer(thirdLayer, baseKey);
  const firstLayer = decryptLayer(secondLayer, key2);
  return decryptLayer(firstLayer, key1);
};

export default decryptText;
