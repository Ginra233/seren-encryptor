# Seren Encryptor

Simple web UI + backend to obfuscate JavaScript using `js-confuser`.

## Files
- `server.js` — Express backend (GET /health, POST /encrypt).
- `obfuscator.js` — obfuscation presets and `obfuscateCode()` function.
- `public/index.html` — frontend UI (drag-drop, presets, password, anti-bypass).
- `package.json` — dependencies and start script.

## Install & Run locally
1. Install dependencies:
   ```bash
   npm install
