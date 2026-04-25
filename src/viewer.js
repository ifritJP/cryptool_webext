"use strict";

document.addEventListener('DOMContentLoaded', () => {
    const setupView = document.getElementById('setup-view');
    const viewer = document.getElementById('viewer');
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const passwordInput = document.getElementById('password');
    const decryptBtn = document.getElementById('decrypt-btn');
    const backBtn = document.getElementById('back-btn');
    const contentArea = document.getElementById('content-area');
    const fileInfo = document.querySelector('.file-info');
    const fontSizeSlider = document.getElementById('font-size-slider');

    let selectedFile = null;

    // Font size control
    fontSizeSlider.addEventListener('input', (e) => {
        contentArea.style.fontSize = `${e.target.value}rem`;
    });

    // Initialize font size
    contentArea.style.fontSize = `${fontSizeSlider.value}rem`;

    // File selection
    dropZone.addEventListener('click', () => fileInput.click());
    
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileSelection(e.target.files[0]);
        }
    });

    // Drag and Drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('active');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('active');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('active');
        if (e.dataTransfer.files.length > 0) {
            handleFileSelection(e.dataTransfer.files[0]);
        }
    });

    function handleFileSelection(file) {
        selectedFile = file;
        fileInfo.textContent = `Selected: ${file.name}`;
        fileInfo.style.color = 'var(--accent-secondary)';
    }

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

            if (contentStart.includes('-----BEGIN PGP MESSAGE-----')) {
                // PGP Armored
                const message = await openpgp.readMessage({
                    armoredMessage: textDecoder.decode(uint8Array)
                });
                const { data: decrypted } = await openpgp.decrypt({
                    message,
                    passwords: [password],
                    format: 'utf8'
                });
                decryptedText = decrypted;
            } else if (uint8Array[0] === 0x85 || uint8Array[0] === 0xc5) { 
                // PGP Binary (roughly checking for Tag 5 or Tag 18)
                const message = await openpgp.readMessage({
                    binaryMessage: uint8Array
                });
                const { data: decrypted } = await openpgp.decrypt({
                    message,
                    passwords: [password],
                    format: 'utf8'
                });
                decryptedText = decrypted;
            } else {
                // Original AES-GCM format
                decryptedText = await decryptData(arrayBuffer, password);
            }
            
            contentArea.textContent = decryptedText;
            setupView.style.display = 'none';
            viewer.style.display = 'flex';
            passwordInput.value = ''; // Security: clear password
        } catch (err) {
            console.error('Decryption failed:', err);
            alert('Decryption failed. Please check your password or file format.');
        }
    });

    backBtn.addEventListener('click', () => {
        viewer.style.display = 'none';
        setupView.style.display = 'flex';
        contentArea.textContent = '';
    });

    /**
     * Decrypts data using AES-GCM (PBKDF2 for key derivation)
     * Format: [Salt(16)][IV(12)][Ciphertext]
     */
    async function decryptData(buffer, password) {
        const salt = buffer.slice(0, 16);
        const iv = buffer.slice(16, 28);
        const ciphertext = buffer.slice(28);

        const enc = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            "raw",
            enc.encode(password),
            { name: "PBKDF2" },
            false,
            ["deriveKey"]
        );

        const key = await crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                salt: salt,
                iterations: 100000,
                hash: "SHA-256"
            },
            keyMaterial,
            { name: "AES-GCM", length: 256 },
            false,
            ["decrypt"]
        );

        const decrypted = await crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: iv
            },
            key,
            ciphertext
        );

        const dec = new TextDecoder();
        return dec.decode(decrypted);
    }
});
