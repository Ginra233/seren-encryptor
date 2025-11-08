// server.js (patched)
// Seren Encryptor — Express backend (improved error handling, CORS, obfuscation timeout)

const express = require("express");
const multer = require("multer");
const fs = require("fs-extra");
const path = require("path");
const cors = require("cors");
const { obfuscateCode } = require("./obfuscator");

const app = express();
app.disable("x-powered-by");

// Config
const PORT = Number(process.env.PORT || 8080);
const MAX_FILE_MB = Number(process.env.MAX_FILE_MB || 10);
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;
const UPLOAD_DIR = path.join(__dirname, "uploads");
const OUTPUT_DIR = path.join(__dirname, "output");
const OBF_TIMEOUT_MS = Number(process.env.OBF_TIMEOUT_MS || 60000); // 60s default

// Ensure folders exist
fs.ensureDirSync(UPLOAD_DIR);
fs.ensureDirSync(OUTPUT_DIR);

// Try load obfuscator
let obfuscator = null;
let obfuscatorLoadError = null;
try {
  obfuscator = require("./obfuscator");
  if (!obfuscator || typeof obfuscator.obfuscateCode !== "function") {
    obfuscatorLoadError = new Error("obfuscator module found but obfuscateCode() missing");
    console.warn("[warn] obfuscator module found but obfuscateCode() missing — falling back to passthrough");
    obfuscator = null;
  } else {
    console.log("[ok] obfuscator module loaded.");
  }
} catch (e) {
  obfuscatorLoadError = e;
  console.warn("[warn] obfuscator module not found or errored — running in passthrough mode");
  console.warn(e && e.stack ? e.stack : e);
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

function withTimeout(promise, ms) {
  let id;
  const timeout = new Promise((_, reject) => {
    id = setTimeout(() => reject(new Error("timeout")), ms);
  });
  return Promise.race([promise.finally(() => clearTimeout(id)), timeout]);
}

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET','POST','OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));
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
  const detail = {
    status: "ok",
    uptime: process.uptime(),
    ts: Date.now(),
    obfuscator: obfuscator ? "active" : "missing",
    obfuscatorDetail: null,
    obfuscatorError: obfuscatorLoadError ? String(obfuscatorLoadError.message || obfuscatorLoadError) : null,
    maxFileMB: MAX_FILE_MB,
  };

  try {
    if (obfuscator && obfuscator.PRESETS) {
      detail.obfuscatorDetail = {
        presets: Object.keys(obfuscator.PRESETS || {}),
      };
    }
  } catch (e) {
    // ignore
  }

  res.json(detail);
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

  // ensure we always try to cleanup
  let uploadedPath = null;
  let tmpPath = null;

  try {
    if (!req.file || !req.file.path) {
      return res.status(400).json({ error: "No file uploaded (field 'file' required')" });
    }

    // validate extension
    if (!req.file.originalname.toLowerCase().endsWith(".js")) {
      await cleanup([req.file.path]);
      return res.status(400).json({ error: "Only .js files are allowed" });
    }

    // read uploaded file
    uploadedPath = req.file.path;
    const originalName = req.file.originalname;
    const code = await fs.readFile(uploadedPath, "utf8");

    const preset = (req.body.preset && String(req.body.preset)) || "ultra";
    const outFilename = (req.body.filename && String(req.body.filename).trim()) ? String(req.body.filename).trim() : safeOutFilename(originalName);
    const password = (req.body.password && String(req.body.password)) || null;
    const includeAntiBypass = parseBool(req.body.includeAntiBypass);
    const includeBypass = parseBool(req.body.includeBypass);

    // if obfuscator missing, set header and fallback to passthrough (original code returned)
    if (!obfuscator) {
      res.set("X-Seren-Warning", "obfuscator-missing");
      console.warn("[warn] obfuscator missing — returning original file content as download");
    }

    // run obfuscator if present, with timeout
    let resultCode = code;
    if (obfuscator) {
      try {
        // run with timeout to avoid long blocking
        resultCode = await withTimeout(
          obfuscator.obfuscateCode(code, preset, { includeAntiBypass, password }),
          OBF_TIMEOUT_MS
        );
      } catch (err) {
        console.error("[error] obfuscation failed or timed out:", err && err.stack ? err.stack : err);
        // cleanup uploaded file before responding
        await cleanup([uploadedPath]);
        uploadedPath = null;
        if (String(err.message || "").toLowerCase().includes("timeout")) {
          return res.status(504).json({ error: "Obfuscation timeout", detail: "Obfuscation took too long" });
        }
        return res.status(502).json({ error: "Obfuscator error", detail: err && err.message ? err.message : String(err) });
      }
    }

    // write output temp file
    const tmpName = `${Date.now()}_${outFilename}`;
    tmpPath = path.join(OUTPUT_DIR, tmpName);
    await fs.writeFile(tmpPath, resultCode, "utf8");

    // Send file as download and cleanup files afterwards
    // Use try/catch because res.download's callback may throw on streaming issues
    try {
      res.download(tmpPath, outFilename, async (err) => {
        try {
          await cleanup([uploadedPath, tmpPath]);
        } catch (e) {
          // ignore cleanup errors
        }
        if (err) {
          console.error("[error] Failed to send file:", err && (err.stack || err));
          // Note: headers may already be sent here; best-effort
        } else {
          console.log(`[ok] Sent ${outFilename} (preset=${preset})`);
        }
      });
    } catch (e) {
      console.error("[error] download failed:", e && e.stack ? e.stack : e);
      await cleanup([uploadedPath, tmpPath]);
      return res.status(500).json({ error: "Failed to send file", detail: String(e) });
    }

  } catch (err) {
    console.error("[fatal] /encrypt error:", err && err.stack ? err.stack : err);
    try {
      // when possible, attempt to cleanup any temp files
      await cleanup([uploadedPath, tmpPath].filter(Boolean));
    } catch {}
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

// global guards: log and avoid crashing unhandled rejections
process.on("unhandledRejection", (reason, p) => {
  console.error("[unhandledRejection]", reason && (reason.stack || reason));
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException] (will not exit):", err && (err.stack || err));
  // in production you might want to exit and rely on process manager to restart
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