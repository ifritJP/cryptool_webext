# Cryptool

[日本語版 (Japanese)](README.ja.md)

A secure, local-only viewer for encrypted memos. Supports AES-256 (GCM) and PGP symmetric encryption.

## Features

- **Local Decryption**: All decryption happens in your browser. No data is ever uploaded to a server.
- **Support for Multiple Formats**:
  - Custom AES-256 GCM (with PBKDF2 key derivation).
  - Standard PGP Symmetric Encryption (AES-256, SHA-512 S2K).
- **Security Features**:
  - **Auto-clear on hide**: Automatically clears sensitive data when the tab is hidden or closed (configurable).
  - **Memory Safety**: Actively clears sensitive data from memory after use.
- **Premium UI**: Modern dark theme with glassmorphism and smooth interactions.
- **Customization**: Adjust font size for better readability.
- **Secure Key Input**: Toggle password visibility for convenience while maintaining security.

## Installation

1. Clone this repository.
2. Open your browser's extension management page (`chrome://extensions` or `about:debugging`).
3. Enable "Developer mode".
4. Click "Load unpacked" and select the `src` directory.

## Usage

1. Click the Cryptool icon in your browser toolbar.
2. Select **"Open Viewer"**.
3. Select your encrypted file (or drag & drop).
4. Enter the decryption key.
5. Adjust font size as needed.

## Technical Details

- **Manifest V3**: Built using the latest web extension standards.
- **Web Crypto API**: Used for modern AES-GCM decryption.
- **OpenPGP.js**: Used for robust PGP support.

---
&copy; 2026 Cryptool Team. Built for privacy and security.
