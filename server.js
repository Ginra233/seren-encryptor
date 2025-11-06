// server.js
// Seren Encryptor backend (Express)
// - Serves static frontend in ./public
// - GET /health
// - POST /encrypt (multipart/form-data: file, preset, filename, password, includeAntiBypass)

const express = require("express");
const multer = require("multer");
const fs = require("fs-extra");
const path = require("path");

const app = express();
app.disable("x-powered-by");

// ====== Config ======
const PORT = process.env.PORT || 3000;
const MAX_FILE_MB = parseInt(process.env.MAX_FILE_MB || "5", 10); // default 5 MB
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

// Try to load obfuscator module (optional)
let obfuscator = null;
try {
  obfuscator = require("./obfuscator");
  if (typeof obfuscator.obfuscateCode !== "function") {
    console.warn("[server] ./obfuscator found but obfuscateCode() not exported. Falling back to passthrough.");
    obfuscator = null;
  } else {
    console.log("[server] obfuscator module loaded.");
  }
} catch (e) {
  console.warn("[server] ./obfuscator not found or failed to load. Serving passthrough (no obfuscation).", e.message);
  obfuscator = null;
}

// Multer (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES },
});

// ====== Helpers ======
function parseBool(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === "boolean") return value;
  const s = String(value).toLowerCase().trim();
  return s === "1" || s === "true" || s === "on" || s === "yes";
}

// ====== Health endpoint ======
app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime(), ts: Date.now() });
});

// ====== OPTIONS for CORS/clients ======
app.options("/encrypt", (req, res) => {
  res.set("Allow", "POST,OPTIONS");
  res.sendStatus(204);
});

// ====== Encrypt endpoint ======
// Accepts multipart/form-data with field 'file' or 'code'
app.post(
  "/encrypt",
  upload.single("file"),
  express.urlencoded({ extended: false }),
  express.json(),
  async (req, res) => {
    try {
      // Determine source code
      let originalCode = null;
      let incomingFileName = null;

      if (req.file && req.file.buffer) {
        incomingFileName = req.file.originalname || "uploaded.js";
        if (!incomingFileName.toLowerCase().endsWith(".js")) incomingFileName += ".js";
        originalCode = req.file.buffer.toString("utf8");
      } else if (req.body && req.body.code) {
        originalCode = String(req.body.code);
        incomingFileName = (req.body.filename && String(req.body.filename).trim()) || "uploaded.js";
        if (!incomingFileName.toLowerCase().endsWith(".js")) incomingFileName += ".js";
      } else {
        return res.status(400).json({ error: "No file or code provided. Send multipart/form-data with field 'file' or 'code'." });
      }

      // Read options
      const preset = req.body && req.body.preset ? String(req.body.preset) : "ultra";
      const outFilenameRaw = req.body && req.body.filename ? String(req.body.filename).trim() : null;
      const outFilename = outFilenameRaw ? (outFilenameRaw.toLowerCase().endsWith(".js") ? outFilenameRaw : outFilenameRaw + ".js") : `Encrypted-${incomingFileName}`;
      const password = req.body && req.body.password ? String(req.body.password) : null;
      const includeAntiBypass = parseBool(req.body && req.body.includeAntiBypass);

      // Obfuscate if module available
      let resultCode = originalCode;
      if (obfuscator) {
        try {
          resultCode = await obfuscator.obfuscateCode(originalCode, preset, { includeAntiBypass, password });
        } catch (err) {
          console.error("[server] Obfuscation failed:", err);
          return res.status(500).json({ error: "Obfuscation failed: " + (err.message || "unknown") });
        }
      } else {
        // warn client that obfuscator missing
        res.set("X-Seren-Warning", "obfuscator-missing");
        console.warn("[server] obfuscator missing — returning original code unmodified.");
      }

      // Write to temporary file and send as download (so browsers save proper filename)
      const tmpName = `Encrypted_${Date.now()}.js`;
      const tmpPath = path.join(__dirname, tmpName);
      await fs.writeFile(tmpPath, resultCode, "utf8");

      // set headers and send file
      res.download(tmpPath, outFilename, async (err) => {
        // cleanup
        try {
          await fs.unlink(tmpPath);
        } catch (e) {
          // ignore cleanup error
        }
        if (err) {
          console.error("[server] Error sending file:", err);
        }
      });
    } catch (err) {
      console.error("[server] Unexpected error in /encrypt:", err);
      res.status(500).json({ error: (err && err.message) ? err.message : "Internal server error" });
    }
  }
);

// ====== Serve static frontend from /public (if exists) ======
const publicPath = path.join(__dirname, "public");
if (fs.existsSync(publicPath)) {
  app.use(express.static(publicPath));
  // SPA fallback: return index.html for unknown routes
  app.get("*", (req, res) => {
    res.sendFile(path.join(publicPath, "index.html"));
  });
  console.log("[server] Serving static frontend from ./public");
} else {
  console.warn("[server] Folder ./public not found — frontend will not be served.");
}

// ====== Error handler ======
app.use((err, req, res, next) => {
  console.error("[server] Uncaught error:", err);
  if (!res.headersSent) {
    res.status(500).json({ error: "Server error", detail: err && err.message });
  } else {
    next(err);
  }
});

// ====== Start ======
app.listen(PORT, () => {
  console.log(`✅ Seren Encryptor server running on port ${PORT}`);
  console.log(` - Max upload: ${MAX_FILE_MB} MB`);
  console.log(` - Health: GET /health`);
  console.log(` - Encrypt: POST /encrypt (multipart/form-data: file, preset, filename, password, includeAntiBypass)`);
});
