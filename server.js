// server.js
// Seren Encryptor — Express backend (full, ready-to-deploy)
// - Uses obfuscator.js (must export obfuscateCode(code, preset, options))
// - POST /encrypt (multipart/form-data: file, preset, filename, password, includeAntiBypass)
// - GET  /health

const express = require("express");
const multer = require("multer");
const fs = require("fs-extra");
const path = require("path");

const app = express();
app.disable("x-powered-by");

// Config
const PORT = Number(process.env.PORT || 8080);
const MAX_FILE_MB = Number(process.env.MAX_FILE_MB || 10);
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;
const UPLOAD_DIR = path.join(__dirname, "uploads");
const OUTPUT_DIR = path.join(__dirname, "output");

// Ensure folders exist
fs.ensureDirSync(UPLOAD_DIR);
fs.ensureDirSync(OUTPUT_DIR);

// Try load obfuscator
let obfuscator = null;
try {
  obfuscator = require("./obfuscator");
  if (!obfuscator || typeof obfuscator.obfuscateCode !== "function") {
    console.warn("[warn] obfuscator module found but obfuscateCode() missing — falling back to passthrough");
    obfuscator = null;
  } else {
    console.log("[ok] obfuscator module loaded.");
  }
} catch (e) {
  console.warn("[warn] obfuscator module not found or errored — running in passthrough mode");
  obfuscator = null;
}

// Multer (disk storage to uploads/)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    // sanitize file name
    const base = path.basename(file.originalname).replace(/[^a-zA-Z0-9.\-_]/g, "_");
    cb(null, `${Date.now()}_${base}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_BYTES },
});

// Helpers
function parseBool(v) {
  if (v === undefined || v === null) return false;
  if (typeof v === "boolean") return v;
  return ["1", "true", "on", "yes"].includes(String(v).toLowerCase());
}

function safeOutFilename(origName) {
  const name = path.parse(origName).name.replace(/[^a-zA-Z0-9-_]/g, "_");
  return `${name}-encrypted.js`;
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend if exists
const publicPath = path.join(__dirname, "public");
if (fs.existsSync(publicPath)) {
  app.use(express.static(publicPath, { index: false }));
  // SPA fallback
  app.get("*", (req, res, next) => {
    const indexFile = path.join(publicPath, "index.html");
    if (fs.existsSync(indexFile)) return res.sendFile(indexFile);
    next();
  });
  console.log("[info] Serving frontend from ./public");
} else {
  console.log("[info] ./public not found — frontend not served by this server");
}

// Health endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    ts: Date.now(),
    obfuscator: obfuscator ? "active" : "missing",
    maxFileMB: MAX_FILE_MB,
  });
});

// OPTIONS for /encrypt (helpful for some clients)
app.options("/encrypt", (req, res) => {
  res.set("Allow", "POST, OPTIONS");
  res.sendStatus(204);
});

// Main encrypt endpoint
// Accepts multipart/form-data with field "file" (single .js file)
app.post("/encrypt", upload.single("file"), async (req, res) => {
  const cleanup = async (paths = []) => {
    for (const p of paths) {
      try { await fs.remove(p); } catch (e) { /* ignore */ }
    }
  };

  try {
    if (!req.file || !req.file.path) {
      return res.status(400).json({ error: "No file uploaded (field 'file' required)" });
    }

    // validate extension
    if (!req.file.originalname.toLowerCase().endsWith(".js")) {
      await cleanup([req.file.path]);
      return res.status(400).json({ error: "Only .js files are allowed" });
    }

    // read uploaded file
    const uploadedPath = req.file.path;
    const originalName = req.file.originalname;
    const code = await fs.readFile(uploadedPath, "utf8");

    const preset = (req.body.preset && String(req.body.preset)) || "ultra";
    const outFilename = (req.body.filename && String(req.body.filename).trim()) ? String(req.body.filename).trim() : safeOutFilename(originalName);
    const password = (req.body.password && String(req.body.password)) || null;
    const includeAntiBypass = parseBool(req.body.includeAntiBypass);

    // if obfuscator missing, set header and fallback to passthrough (original code returned)
    if (!obfuscator) {
      res.set("X-Seren-Warning", "obfuscator-missing");
      console.warn("[warn] obfuscator missing — returning original file content as download");
    }

    // run obfuscator if present
    let resultCode = code;
    if (obfuscator) {
      try {
        resultCode = await obfuscator.obfuscateCode(code, preset, { includeAntiBypass, password });
      } catch (err) {
        console.error("[error] obfuscation failed:", err && err.message ? err.message : err);
        await cleanup([uploadedPath]);
        return res.status(500).json({ error: "Obfuscation failed", detail: err && err.message ? err.message : String(err) });
      }
    }

    // write output temp file
    const tmpName = `${Date.now()}_${outFilename}`;
    const tmpPath = path.join(OUTPUT_DIR, tmpName);
    await fs.writeFile(tmpPath, resultCode, "utf8");

    // Send file as download and cleanup files afterwards
    res.download(tmpPath, outFilename, async (err) => {
      try {
        await cleanup([uploadedPath, tmpPath]);
      } catch (e) {
        // ignore
      }
      if (err) {
        console.error("[error] Failed to send file:", err);
      } else {
        console.log(`[ok] Sent ${outFilename} (preset=${preset})`);
      }
    });
  } catch (err) {
    console.error("[fatal] /encrypt error:", err && err.message ? err.message : err);
    return res.status(500).json({ error: "Internal server error", detail: err && err.message ? err.message : String(err) });
  }
});

// Optional: endpoint to list presets (from obfuscator if available)
app.get("/presets", (req, res) => {
  try {
    const keys = obfuscator && obfuscator.PRESETS ? Object.keys(obfuscator.PRESETS) : ["ultra", "nebula", "nova", "arab", "japan", "japanxarab"];
    res.json({ presets: keys, default: keys[0] || "ultra" });
  } catch (e) {
    res.json({ presets: ["ultra"], default: "ultra" });
  }
});

// Simple cleanup endpoint (protected? currently public)
app.post("/cleanup", async (req, res) => {
  try {
    await fs.emptyDir(UPLOAD_DIR);
    await fs.emptyDir(OUTPUT_DIR);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e && e.message ? e.message : String(e) });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("[uncaught]", err && err.stack ? err.stack : err);
  if (!res.headersSent) res.status(500).json({ error: "Server error", detail: err && err.message ? err.message : String(err) });
  else next(err);
});

// Start server with graceful shutdown
const server = app.listen(PORT, () => {
  console.log(`🚀 Seren Encryptor server listening on port ${PORT} (max ${MAX_FILE_MB} MB upload)`);
});

function gracefulShutdown(sig) {
  console.log(`[info] Received ${sig} — shutting down server...`);
  server.close(() => {
    console.log("[info] HTTP server closed.");
    process.exit(0);
  });
  setTimeout(() => {
    console.warn("[warn] Could not close connections in time, forcing shutdown");
    process.exit(1);
  }, 10000);
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
