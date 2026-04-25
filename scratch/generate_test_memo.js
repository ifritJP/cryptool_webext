const fs = require('fs');
const crypto = require('crypto');

/**
 * Generates an encrypted test file for Cryptool
 * Format: [Salt(16)][IV(12)][Ciphertext]
 */
async function generateTestFile(password, text, filename) {
    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12);

    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
    
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(text, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Web Crypto API expects the auth tag to be appended to the ciphertext
    const result = Buffer.concat([salt, iv, encrypted, authTag]);
    
    fs.writeFileSync(filename, result);
    console.log(`Test file created: ${filename}`);
    console.log(`Password: ${password}`);
    console.log(`Content: ${text}`);
}

const password = "password123";
const content = "これはテスト用の暗号化されたメモです。\nSecret message: Antigravity is watching.";
generateTestFile(password, content, "test_memo.enc");
