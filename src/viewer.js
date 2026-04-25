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
    const togglePasswordBtn = document.getElementById('toggle-password');
    const eyeIcon = document.getElementById('eye-icon');

    let selectedFile = null;

    // Password visibility toggle
    togglePasswordBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        
        // Update icon
        if (type === 'text') {
            eyeIcon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
        } else {
            eyeIcon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
        }
    });

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
            
            // Try to detect PGP (Armored or Binary)
            const contentStart = textDecoder.decode(uint8Array.slice(0, 100));
            let isPGP = false;
            let message;

            if (contentStart.includes('-----BEGIN PGP MESSAGE-----')) {
                // PGP Armored
                isPGP = true;
                message = await openpgp.readMessage({
                    armoredMessage: textDecoder.decode(uint8Array)
                });
            } else {
                // Try PGP Binary
                try {
                    message = await openpgp.readMessage({
                        binaryMessage: uint8Array
                    });
                    isPGP = true;
                } catch (e) {
                    // Not a binary PGP message
                }
            }

            if (isPGP) {
                const { data: decrypted } = await openpgp.decrypt({
                    message,
                    passwords: [password],
                    format: 'utf8'
                });
                decryptedText = decrypted;
            } else {
                // Fallback to Original AES-GCM format
                decryptedText = await decryptData(arrayBuffer, password);
            }
            
            contentArea.textContent = decryptedText;
            setupView.style.display = 'none';
            viewer.style.display = 'flex';
            
            // Security: clear sensitive data from memory
            passwordInput.value = ''; 
            decryptedText = null;
            uint8Array.fill(0); // Zero out buffer
        } catch (err) {
            passwordInput.value = '';
            console.error('Decryption failed'); // Don't log full error to console for security
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
