import crypto from "crypto";

const ENCRYPTION_ALGO = "aes-256-gcm";

function deriveKey(password: string, salt: Buffer): Buffer {
    // scrypt derives a fixed-length key from your password; salt keeps it unique per record
    return crypto.scryptSync(password, salt, 32);
}

const decryptText = (payload: string, password: string): string => {
    const data = Buffer.from(payload, "base64");
    const salt = data.subarray(0, 16);
    const iv = data.subarray(16, 28);
    const authTag = data.subarray(28, 44);
    const encrypted = data.subarray(44);
    const key = deriveKey(password, salt);

    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGO, key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString("utf8");
};

export default decryptText;