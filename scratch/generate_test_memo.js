const fs = require('fs');
const crypto = require('crypto');

const ITERATIONS = 600000;
const MAGIC = Buffer.from([0x43, 0x52, 0x54, 0x4C]); // 'CRTL'

/**
 * Generates an encrypted test file for Cryptool
 * Format v1: [Magic'CRTL'(4)][Version(1)][Iterations(4)][Salt(16)][IV(12)][Ciphertext+Tag]
 */
async function generateTestFile(password, text, filename) {
    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12);

    const key = crypto.pbkdf2Sync(password, salt, ITERATIONS, 32, 'sha256');

    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(text, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const authTag = cipher.getAuthTag();

    const version = Buffer.from([0x01]);
    const iterBuf = Buffer.allocUnsafe(4);
    iterBuf.writeUInt32BE(ITERATIONS, 0);

    const result = Buffer.concat([MAGIC, version, iterBuf, salt, iv, encrypted, authTag]);

    fs.writeFileSync(filename, result);
    console.log(`Test file created: ${filename}`);
    console.log(`Password: ${password}`);
    console.log(`Content: ${text}`);
}

const password = "password123";
const content = "これはテスト用の暗号化されたメモです。\nSecret message: Antigravity is watching.";
generateTestFile(password, content, "test_memo.enc");
