import { webcrypto } from 'node:crypto';
const crypto = webcrypto;

// Paste the armored test message here
const ARMORED = `-----BEGIN PGP MESSAGE-----

jA0ECQMKOHUfUVWMC3b/0kQBCdvOuQaXMLtGqeqBH1zJT0jyPavrWSliuEJnEht3
l6vX0wlCVa4RUAbti3DeOF+XdtWhnDpiQzUXRb006HcndEKahQ==
=xQ5+
-----END PGP MESSAGE-----`;

const PASSWORD = "testpass";

// ── helpers ──────────────────────────────────────────────────────────────────
function hex(u8) { return Array.from(u8).map(b => b.toString(16).padStart(2,'0')).join(' '); }

function decodeArmor(armored) {
    const lines = armored.split('\n');
    let b64 = '', start = false;
    for (const line of lines) {
        const t = line.trim();
        if (t.startsWith('-----BEGIN PGP')) { start = true; continue; }
        if (t.startsWith('-----END PGP')) break;
        if (start && t.includes(':')) continue;
        if (start && t === '') continue;
        if (start) { if (t.startsWith('=')) break; b64 += t; }
    }
    return Buffer.from(b64, 'base64');
}

function parsePackets(buf) {
    const packets = [];
    let off = 0;
    while (off < buf.length) {
        const tag_byte = buf[off++];
        let tag, length;
        if (tag_byte & 0x40) {
            tag = tag_byte & 0x3F;
            const lb = buf[off++];
            if (lb < 192) length = lb;
            else if (lb < 224) length = ((lb - 192) << 8) + buf[off++] + 192;
            else if (lb === 255) { length = buf.readUInt32BE(off); off += 4; }
            else throw new Error(`Partial body @${off-1} not supported`);
        } else {
            tag = (tag_byte >> 2) & 0x0F;
            const lt = tag_byte & 0x03;
            if (lt === 0) length = buf[off++];
            else if (lt === 1) { length = (buf[off++] << 8) | buf[off++]; }
            else if (lt === 2) { length = buf.readUInt32BE(off); off += 4; }
            else length = buf.length - off;
        }
        packets.push({ tag, data: buf.slice(off, off + length) });
        off += length;
    }
    return packets;
}

// ── main ─────────────────────────────────────────────────────────────────────
const raw = decodeArmor(ARMORED);
console.log('Raw bytes:', raw.length, '\n');

const packets = parsePackets(raw);
packets.forEach(p => console.log(`  Tag ${p.tag}: ${p.data.length} bytes  hex[0..8]: ${hex(p.data.slice(0, 8))}`));
console.log();

// ── SKESK ────────────────────────────────────────────────────────────────────
const skesk = packets.find(p => p.tag === 3);
const d = skesk.data;
console.log('SKESK body length:', d.length);
console.log('  version  :', d[0]);
console.log('  cipherAlgo:', d[1], '(9=AES-256)');
console.log('  s2kType  :', d[2], '(3=iterated)');
console.log('  hashAlgo :', d[3], '(10=SHA-512)');
console.log('  salt     :', hex(d.slice(4, 12)));
console.log('  countByte:', d[12], `→ count=${(16 + (d[12] & 15)) << ((d[12] >> 4) + 6)}`);
console.log('  encSK len:', d.length - 13, 'bytes (0=no encSK, 32=encSK no prefix, 33=encSK with algo byte)');
if (d.length > 13) console.log('  encSK[0] :', d[13], '(if algo prefix → should be 9 for AES-256)');
console.log();

// ── S2K key derivation ───────────────────────────────────────────────────────
const salt = d.slice(4, 12);
const count = (16 + (d[12] & 15)) << ((d[12] >> 4) + 6);
const pwBytes = Buffer.from(PASSWORD, 'utf8');
const combined = Buffer.concat([salt, pwBytes]);
const fullBuffer = Buffer.alloc(count);
for (let i = 0; i < count; i++) fullBuffer[i] = combined[i % combined.length];
const hashBuf = await crypto.subtle.digest('SHA-512', fullBuffer);
const derivedKey = new Uint8Array(hashBuf).slice(0, 32);
console.log('Derived key:', hex(derivedKey));

// ── decrypt session key (CFB, IV=0) ─────────────────────────────────────────
async function cfbDecrypt(encBytes, keyBytes) {
    const BS = 16;
    const ivZero = new Uint8Array(BS);
    const ck = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-CBC' }, false, ['encrypt']);
    const encBlock = async (blk) => {
        const out = await crypto.subtle.encrypt({ name: 'AES-CBC', iv: ivZero }, ck, blk);
        return new Uint8Array(out).slice(0, BS);
    };
    const out = new Uint8Array(encBytes.length);
    let fb = ivZero;
    for (let i = 0; i < encBytes.length; i += BS) {
        const fre = await encBlock(fb);
        const len = Math.min(BS, encBytes.length - i);
        fb = encBytes.slice(i, i + BS);
        for (let j = 0; j < len; j++) out[i + j] = encBytes[i + j] ^ fre[j];
    }
    return out;
}

let sessionKey;
if (d.length > 13) {
    const encSK = d.slice(13);
    const decSK = await cfbDecrypt(encSK, derivedKey);
    console.log('Decrypted encSK raw :', hex(decSK));
    console.log('  decSK[0] as algo byte:', decSK[0], '(should be 9 if algo prefix present)');
    // Try both: with and without algo prefix
    const skNoPrefix = decSK;        // treat all bytes as session key
    const skWithPrefix = decSK.slice(1); // skip leading algo byte
    console.log('  sk (no prefix, 32B):', hex(skNoPrefix.slice(0,8)), '...');
    console.log('  sk (with prefix stripped, 31B):', hex(skWithPrefix.slice(0,8)), '...');
    sessionKey = decSK[0] === 9 ? skWithPrefix : skNoPrefix;
    console.log('  → using', decSK[0] === 9 ? 'prefix-stripped (31B? bad for AES256)' : 'no-prefix (32B)', 'as session key');
} else {
    sessionKey = derivedKey;
    console.log('No encSK → using derived key directly');
}
console.log('Session key (first 8):', hex(sessionKey.slice(0,8)));
console.log();

// ── SEIPD ────────────────────────────────────────────────────────────────────
const seipd = packets.find(p => p.tag === 18);
console.log('SEIPD version:', seipd.data[0]);
const encData = seipd.data.slice(1);
console.log('SEIPD encData len:', encData.length);

// OpenPGP CFB decrypt
const BS = 16;
const ivZero = new Uint8Array(BS);
const ck2 = await crypto.subtle.importKey('raw', sessionKey, { name: 'AES-CBC' }, false, ['encrypt']);
const encBlock2 = async (blk) => {
    const out = await crypto.subtle.encrypt({ name: 'AES-CBC', iv: ivZero }, ck2, blk);
    return new Uint8Array(out).slice(0, BS);
};

let fre = await encBlock2(ivZero);
const prefix = new Uint8Array(BS + 2);
for (let i = 0; i < BS; i++) prefix[i] = encData[i] ^ fre[i];
fre = await encBlock2(encData.slice(0, BS));
prefix[BS]   = encData[BS]   ^ fre[0];
prefix[BS+1] = encData[BS+1] ^ fre[1];
console.log('Prefix check bytes match:', prefix[BS-2] === prefix[BS] && prefix[BS-1] === prefix[BS+1]);
console.log('  prefix[-2,-1]:', prefix[BS-2], prefix[BS-1]);
console.log('  check  [0, 1]:', prefix[BS],   prefix[BS+1]);

const decrypted = new Uint8Array(encData.length - (BS + 2));
let offset = BS + 2, pOffset = 0;
while (offset < encData.length) {
    const inp = encData.slice(offset - BS, offset);
    fre = await encBlock2(inp);
    const chunkLen = Math.min(BS, encData.length - offset);
    for (let i = 0; i < chunkLen; i++) decrypted[pOffset++] = encData[offset++] ^ fre[i];
}

console.log('\nDecrypted (all):', Buffer.from(decrypted).toString('hex'));
console.log('Last 22 bytes (MDC):', hex(decrypted.slice(-22)));
const result = decrypted.slice(0, -22);
console.log('\nPlaintext:', Buffer.from(result).toString('utf8'));
