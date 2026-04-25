"use strict";

document.addEventListener('DOMContentLoaded', () => {
    // Decrypt View Elements
    const setupView = document.getElementById('setup-view');
    const decryptSection = document.getElementById('decrypt-section');
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const decryptBtn = document.getElementById('decrypt-btn');
    
    // Encrypt View Elements
    const encryptSection = document.getElementById('encrypt-section');
    const plainTextInput = document.getElementById('plain-text-input');
    const textFileInput = document.getElementById('text-file-input');
    const encryptBtn = document.getElementById('encrypt-btn');
    
    // Common Elements
    const viewer = document.getElementById('viewer');
    const passwordInput = document.getElementById('password');
    const backBtn = document.getElementById('back-btn');
    const contentArea = document.getElementById('content-area');
    const fileInfo = document.querySelector('.file-info');
    const fontSizeSlider = document.getElementById('font-size-slider');
    const togglePasswordBtn = document.getElementById('toggle-password');
    const eyeIcon = document.getElementById('eye-icon');
    
    // Tab Elements
    const tabDecrypt = document.getElementById('tab-decrypt');
    const tabEncrypt = document.getElementById('tab-encrypt');

    let selectedFile = null;

    // Tab Switching Logic
    tabDecrypt.addEventListener('click', () => {
        tabDecrypt.classList.add('active');
        tabEncrypt.classList.remove('active');
        decryptSection.style.display = 'block';
        encryptSection.style.display = 'none';
        decryptBtn.style.display = 'block';
        encryptBtn.style.display = 'none';
    });

    tabEncrypt.addEventListener('click', () => {
        tabEncrypt.classList.add('active');
        tabDecrypt.classList.remove('active');
        decryptSection.style.display = 'none';
        encryptSection.style.display = 'block';
        decryptBtn.style.display = 'none';
        encryptBtn.style.display = 'block';
    });

    // Password visibility toggle
    togglePasswordBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);

        const ns = 'http://www.w3.org/2000/svg';
        while (eyeIcon.firstChild) eyeIcon.removeChild(eyeIcon.firstChild);
        if (type === 'text') {
            const p = document.createElementNS(ns, 'path');
            p.setAttribute('d', 'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24');
            const l = document.createElementNS(ns, 'line');
            l.setAttribute('x1', '1'); l.setAttribute('y1', '1');
            l.setAttribute('x2', '23'); l.setAttribute('y2', '23');
            eyeIcon.appendChild(p);
            eyeIcon.appendChild(l);
        } else {
            const p = document.createElementNS(ns, 'path');
            p.setAttribute('d', 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z');
            const c = document.createElementNS(ns, 'circle');
            c.setAttribute('cx', '12'); c.setAttribute('cy', '12'); c.setAttribute('r', '3');
            eyeIcon.appendChild(p);
            eyeIcon.appendChild(c);
        }
    });

    // Font size control
    fontSizeSlider.addEventListener('input', (e) => {
        contentArea.style.fontSize = `${e.target.value}rem`;
    });
    contentArea.style.fontSize = `${fontSizeSlider.value}rem`;

    // File selection (Decrypt)
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) handleFileSelection(e.target.files[0]);
    });

    // Drag and Drop (Decrypt)
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('active'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('active'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('active');
        if (e.dataTransfer.files.length > 0) handleFileSelection(e.dataTransfer.files[0]);
    });

    function handleFileSelection(file) {
        selectedFile = file;
        fileInfo.textContent = `Selected: ${file.name}`;
        fileInfo.style.color = 'var(--accent-secondary)';
    }

    // Load text from file (Encrypt)
    document.querySelector('.text-file-label').addEventListener('click', () => textFileInput.click());
    textFileInput.addEventListener('change', async (e) => {
        if (e.target.files.length > 0) {
            const text = await e.target.files[0].text();
            plainTextInput.value = text;
        }
    });

    // Decryption Logic
    decryptBtn.addEventListener('click', async () => {
        const password = passwordInput.value;
        if (!selectedFile || !password) {
            alert('Please select a file and enter a password.');
            return;
        }

        try {
            let decryptedText;
            const arrayBuffer = await selectedFile.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            const textDecoder = new TextDecoder();
            
            const contentStart = textDecoder.decode(uint8Array.slice(0, 100));
            let isPGP = false;
            let message;

            if (contentStart.includes('-----BEGIN PGP MESSAGE-----')) {
                isPGP = true;
                message = await openpgp.readMessage({ armoredMessage: textDecoder.decode(uint8Array) });
            } else {
                try {
                    message = await openpgp.readMessage({ binaryMessage: uint8Array });
                    isPGP = true;
                } catch (e) {}
            }

            if (isPGP) {
                const { data: decrypted } = await openpgp.decrypt({
                    message,
                    passwords: [password],
                    format: 'utf8'
                });
                decryptedText = decrypted;
            } else {
                decryptedText = await decryptData(arrayBuffer, password);
            }
            
            contentArea.textContent = decryptedText;
            setupView.style.display = 'none';
            viewer.style.display = 'flex';
            document.querySelector('.tabs').style.display = 'none';
            
            // Security
            passwordInput.value = ''; 
            uint8Array.fill(0);
        } catch (err) {
            passwordInput.value = '';
            console.error('Decryption failed');
            alert('Decryption failed. Please check your password or file format.');
        }
    });

    // Encryption Logic
    encryptBtn.addEventListener('click', async () => {
        const password = passwordInput.value;
        const plainText = plainTextInput.value;
        if (!plainText || !password) {
            alert('Please enter text and a password.');
            return;
        }

        try {
            const encryptedBuffer = await encryptData(plainText, password);
            const blob = new Blob([encryptedBuffer], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = 'memo.enc';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            alert('Encryption successful! File downloaded as memo.enc');
            
            // Security: clear inputs
            passwordInput.value = '';
            plainTextInput.value = '';
        } catch (err) {
            console.error('Encryption failed', err);
            alert('Encryption failed. Please try again.');
        }
    });

    backBtn.addEventListener('click', () => {
        viewer.style.display = 'none';
        setupView.style.display = 'flex';
        document.querySelector('.tabs').style.display = 'flex';
        contentArea.textContent = '';
    });

    /**
     * Encrypts data using AES-GCM (v1 format)
     */
    async function encryptData(text, password) {
        const iterations = 600000;
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        
        const enc = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            "raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveKey"]
        );

        const key = await crypto.subtle.deriveKey(
            { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
            keyMaterial,
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt"]
        );

        const plainBytes = enc.encode(text);
        const ciphertext = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv }, key, plainBytes
        );
        plainBytes.fill(0);

        // Build header
        const header = new ArrayBuffer(37);
        const view = new DataView(header);
        view.setUint32(0, 0x4352544C); // 'CRTL'
        view.setUint8(4, 1);           // Version 1
        view.setUint32(5, iterations); // Iterations
        new Uint8Array(header, 9, 16).set(salt);
        new Uint8Array(header, 25, 12).set(iv);

        // Combine
        const combined = new Uint8Array(header.byteLength + ciphertext.byteLength);
        combined.set(new Uint8Array(header), 0);
        combined.set(new Uint8Array(ciphertext), header.byteLength);
        
        return combined.buffer;
    }

    /**
     * Decrypts data using AES-GCM (PBKDF2 for key derivation)
     */
    async function decryptData(buffer, password) {
        const view = new DataView(buffer);
        let salt, iv, ciphertext, iterations;

        if (buffer.byteLength >= 37 && view.getUint32(0) === 0x4352544C) {
            const version = view.getUint8(4);
            if (version !== 1) throw new Error('Unsupported format version');
            iterations = view.getUint32(5);
            if (iterations < 100000 || iterations > 2000000) throw new Error('Invalid iterations value');
            salt = buffer.slice(9, 25);
            iv = buffer.slice(25, 37);
            ciphertext = buffer.slice(37);
        } else {
            iterations = 100000;
            salt = buffer.slice(0, 16);
            iv = buffer.slice(16, 28);
            ciphertext = buffer.slice(28);
        }

        const enc = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            "raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveKey"]
        );

        const key = await crypto.subtle.deriveKey(
            { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
            keyMaterial,
            { name: "AES-GCM", length: 256 },
            false,
            ["decrypt"]
        );

        const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
        const dec = new TextDecoder();
        const result = dec.decode(decrypted);
        new Uint8Array(decrypted).fill(0);
        return result;
    }
});
