import crypto from "crypto";

const ENCRYPTION_ALGO = "aes-256-gcm";
const FORMAT_PREFIX = "otterpie:v2:";

function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.scryptSync(password, salt, 32);
}

function encryptLayer(plaintext: string, password: string): string {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = deriveKey(password, salt);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([salt, iv, authTag, encrypted]).toString("base64");
}

function requiredKey(value: string | undefined, keyName: string): string {
  if (!value) throw new Error(`Missing encryption key: ${keyName}`);
  return value;
}

const encryptText = (plaintext: string, password: string): string => {
  const baseKey = requiredKey(password, "WALLET_BANK_KEY");
  const key1 = requiredKey(process.env.WALLET_BANK_KEY_1, "WALLET_BANK_KEY_1");
  const key2 = requiredKey(process.env.WALLET_BANK_KEY_2, "WALLET_BANK_KEY_2");

  const firstLayer = encryptLayer(plaintext, key1);
  const secondLayer = encryptLayer(firstLayer, key2);
  const thirdLayer = encryptLayer(secondLayer, baseKey);

  return `${FORMAT_PREFIX}${thirdLayer}`;
};

export default encryptText;
