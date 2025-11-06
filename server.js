// server.js
// Simple Express server for Seren Encryptor
// Endpoints:
//  - GET /health -> 200 OK
//  - POST /encrypt -> accepts multipart form with file/code and options
//
// Place obfuscator.js (from our previous messages) in same folder
// and ensure package.json includes: express, multer, fs-extra, js-confuser

const express = require("express");
const multer = require("multer");
const fs = require("fs-extra");
const path = require("path");

const app = express();
app.disable("x-powered-by");

// config
const PORT = process.env.PORT || 3000;
const MAX_FILE_MB = parseInt(process.env.MAX_FILE_MB || "2"); // default 2 MB
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

// try to require obfuscator module (recommended)
let obfuscator = null;
try {
  obfuscator = require("./obfuscator");
  if (typeof obfuscator.obfuscateCode !== "function") {
    console.warn("[server] ./obfuscator found but obfuscateCode() not exported. Falling back to passthrough.");
    obfuscator = null;
  }
} catch (e) {
  console.warn("[server] ./obfuscator not found or failed to load. Serving passthrough (no obfuscation).", e.message);
  obfuscator = null;
}

// multer: memory storage (we process in-memory then send result)
// you can switch to diskStorage if you prefer saving to tmp files
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_BYTES,
  },
});

// simple JSON endpoints (not required but handy)
app.get("/health", (req, res) => {
  // minimal health check; could be extended to check memory/CPU/db etc.
  res.status(200).json({ status: "ok", ts: Date.now() });
});

// allow OPTIONS (for some clients)
app.options("/encrypt", (req, res) => {
  res.set("Allow", "POST,OPTIONS");
  res.sendStatus(204);
});

// main upload endpoint
// accepts either:
//  - file in multipart/form-data field named "file"
//  - OR raw code via text field "code" (also in multipart/form-data or urlencoded/json if adapted)
app.post("/encrypt", upload.single("file"), express.urlencoded({ extended: false }), express.json(), async (req, res) => {
  try {
    // Determine code source
    let originalCode = null;
    let incomingFileName = null;

    // If a file was uploaded
    if (req.file && req.file.buffer) {
      incomingFileName = req.file.originalname || "uploaded.js";
      // enforce .js extension
      if (!incomingFileName.toLowerCase().endsWith(".js")) {
        // still allow but rename
        incomingFileName = incomingFileName + ".js";
      }
      originalCode = req.file.buffer.toString("utf8");
    } else if (req.body && req.body.code) {
      // allow 'code' field (raw code)
      originalCode = String(req.body.code);
      incomingFileName = (req.body.filename && String(req.body.filename).trim()) || "uploaded.js";
      if (!incomingFileName.toLowerCase().endsWith(".js")) incomingFileName += ".js";
    } else {
      return res.status(400).json({ error: "No file or code provided. Send multipart/form-data with field 'file' or 'code'." });
    }

    // Read options
    const preset = (req.body && req.body.preset) ? String(req.body.preset) : "ultra";
    const outFilename = (req.body && req.body.filename && String(req.body.filename).trim()) || `Encrypted-${incomingFileName || "file.js"}`;
    const password = (req.body && req.body.password) ? String(req.body.password) : null;
    const includeAntiBypass = !!(req.body && (req.body.includeAntiBypass === "1" || req.body.includeAntiBypass === "true" || req.body.includeAntiBypass === "on"));

    // If obfuscator is available, run it; otherwise pass original code through (but still return as .js)
    let resultCode = originalCode;

    if (obfuscator) {
      // Options exposed to obfuscator: { includeAntiBypass, password }
      try {
        // obfuscateCode may return a string or throw
        resultCode = await obfuscator.obfuscateCode(originalCode, preset, { includeAntiBypass, password });
      } catch (e) {
        console.error("[server] Obfuscation error:", e);
        return res.status(500).json({ error: "Obfuscation failed: " + (e.message || "unknown") });
      }
    } else {
      // No obfuscator found; warn in response headers and continue
      res.set("X-Seren-Warning", "obfuscator-missing");
      console.warn("[server] obfuscator module missing — returning original code unmodified.");
    }

    // Send as attachment
    // Ensure filename ends with .js
    let safeName = outFilename;
    if (!safeName.toLowerCase().endsWith(".js")) safeName = safeName + ".js";

    // Set content-type and force download
    res.setHeader("Content-Disposition", `attachment; filename="${safeName.replace(/"/g, '')}"`);
    res.type("application/javascript").send(resultCode);
  } catch (err) {
    console.error("[server] Unexpected error in /encrypt:", err);
    res.status(500).json({ error: (err && err.message) ? err.message : "Internal server error" });
  }
});

// root: optional quick page to show server is up
app.get("/", (req, res) => {
  res.send(`<html><head><meta charset="utf-8"><title>Seren Encryptor - Server</title></head><body style="font-family:Inter,system-ui,Arial;padding:24px;"><h2>Seren Encryptor Backend</h2><p>Server running. Use <code>/encrypt</code> POST endpoint to obfuscate files.</p><p><small>Health: GET <a href="/health">/health</a></small></p></body></html>`);
});

// error handler
app.use((err, req, res, next) => {
  console.error("[server] Uncaught error:", err);
  if (!res.headersSent) {
    res.status(500).json({ error: "Server error", detail: err.message });
  } else {
    next(err);
  }
});

// start server
app.listen(PORT, () => {
  console.log(`✅ Seren Encryptor server running on port ${PORT}`);
  console.log(` - Max upload: ${MAX_FILE_MB} MB`);
  console.log(` - Health: GET /health`);
  console.log(` - Encrypt: POST /encrypt (multipart/form-data: file, preset, filename, password, includeAntiBypass)`);
});
