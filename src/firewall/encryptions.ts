import crypto from "crypto";

const ENCRYPTION_ALGO = "aes-256-gcm";

function deriveKey(password: string, salt: Buffer): Buffer {
    // scrypt derives a fixed-length key from your password; salt keeps it unique per record
    return crypto.scryptSync(password, salt, 32);
}

const encryptText = (plaintext: string, password: string): string => {
    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12); // 12 bytes is standard for GCM
    const key = deriveKey(password, salt);

    const cipher = crypto.createCipheriv(ENCRYPTION_ALGO, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // pack salt + iv + authTag + ciphertext together so decrypt has everything it needs
    return Buffer.concat([salt, iv, authTag, encrypted]).toString("base64");
};

export default encryptText;