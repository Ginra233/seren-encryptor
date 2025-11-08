// server.js - Seren Encryptor (Railway-friendly, lazy-load, memory-safe)
// Default MAX_FILE_MB changed to 20 MB
const express = require("express");
const multer = require("multer");
const fs = require("fs-extra");
const path = require("path");
const cors = require("cors");
const fetch = require("node-fetch"); // optional, used for keep-alive ping

const app = express();
app.disable("x-powered-by");

// Config (use env where possible)
const PORT = process.env.PORT || 8080; // Railway provides PORT via env
const MAX_FILE_MB = Number(process.env.MAX_FILE_MB || 20); // default 20 MB (changed)
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024; // correct bytes calculation
const UPLOAD_DIR = path.join(__dirname, "uploads");
const OUTPUT_DIR = path.join(__dirname, "output");
const OBF_TIMEOUT_MS = Number(process.env.OBF_TIMEOUT_MS || 60_000); // 60s default
const ENABLE_KEEPALIVE = !!process.env.ENABLE_KEEPALIVE; // set to "1" to enable
const KEEPALIVE_MS = Number(process.env.KEEPALIVE_MS || 240_000); // 4 minutes

// Ensure dirs
fs.ensureDirSync(UPLOAD_DIR);
fs.ensureDirSync(OUTPUT_DIR);

// Minimal startup logs
console.log("=== Seren Encryptor initializing ===");
console.log("NODE_ENV:", process.env.NODE_ENV || "undefined");
console.log("PORT:", PORT);
console.log("MAX_FILE_MB:", MAX_FILE_MB);

// multer storage (disk)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const base = path.basename(file.originalname).replace(/[^a-zA-Z0-9.\-_]/g, "_");
    cb(null, `${Date.now()}_${base}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_BYTES },
});

// helpers
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
async function cleanup(paths = []) {
  for (const p of paths) {
    try { await fs.remove(p); } catch (e) { /* ignore */ }
  }
}

// Serve static frontend (if present)
const publicPath = path.join(__dirname, "public");
if (fs.existsSync(publicPath)) {
  app.use(express.static(publicPath, { index: false }));
  app.get("*", (req, res, next) => {
    const indexFile = path.join(publicPath, "index.html");
    if (fs.existsSync(indexFile)) return res.sendFile(indexFile);
    next();
  });
  console.log("[info] Serving frontend from ./public");
} else {
  console.log("[info] ./public not found — frontend not served");
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    ts: Date.now(),
    maxFileMB: MAX_FILE_MB,
    obfuscator: Boolean(global.__obfuscator_loaded) ? "active" : "missing",
    memory: process.memoryUsage(),
  });
});

// Lazy-load obfuscator only when needed
let obfuscator = null;
let obfuscatorLoadError = null;
async function tryLoadObfuscator() {
  if (obfuscator || obfuscatorLoadError) return;
  try {
    obfuscator = require("./obfuscator");
    if (!obfuscator || typeof obfuscator.obfuscateCode !== "function") {
      obfuscatorLoadError = new Error("obfuscator module found but obfuscateCode() missing");
      console.warn("[warn] obfuscator module found but obfuscateCode() missing — passthrough");
      obfuscator = null;
    } else {
      global.__obfuscator_loaded = true;
      console.log("[ok] obfuscator module lazy-loaded.");
    }
  } catch (e) {
    obfuscatorLoadError = e;
    console.warn("[warn] obfuscator lazy-load failed — passthrough mode");
    console.warn(e && e.stack ? e.stack : e);
    obfuscator = null;
  }
}

// OPTIONS helpful for some clients
app.options("/encrypt", (req, res) => {
  res.set("Allow", "POST, OPTIONS");
  res.sendStatus(204);
});

// Main encrypt endpoint
app.post("/encrypt", upload.single("file"), async (req, res) => {
  let uploadedPath = null;
  let tmpPath = null;
  try {
    // ensure obfuscator is loaded lazily
    await tryLoadObfuscator();

    if (!req.file || !req.file.path) {
      return res.status(400).json({ error: "No file uploaded (field 'file' required')" });
    }

    // validate ext
    if (!req.file.originalname.toLowerCase().endsWith(".js")) {
      await cleanup([req.file.path]);
      return res.status(400).json({ error: "Only .js files are allowed" });
    }

    uploadedPath = req.file.path;
    const originalName = req.file.originalname;
    const code = await fs.readFile(uploadedPath, "utf8");

    const preset = (req.body.preset && String(req.body.preset)) || "ultra";
    const outFilename = (req.body.filename && String(req.body.filename).trim()) ? String(req.body.filename).trim() : safeOutFilename(originalName);
    const password = (req.body.password && String(req.body.password)) || null;
    const includeAntiBypass = parseBool(req.body.includeAntiBypass);
    const includeBypass = parseBool(req.body.includeBypass);

    if (!obfuscator) {
      // warn header but continue (passthrough)
      res.set("X-Seren-Warning", "obfuscator-missing");
      console.warn("[warn] obfuscator missing — returning original file content as download");
    }

    let resultCode = code;
    if (obfuscator) {
      try {
        resultCode = await withTimeout(
          obfuscator.obfuscateCode(code, preset, { includeAntiBypass, includeBypass, password }),
          OBF_TIMEOUT_MS
        );
      } catch (err) {
        console.error("[error] obfuscation failed or timed out:", err && (err.stack || err));
        // cleanup uploaded and return helpful errors
        await cleanup([uploadedPath]);
        uploadedPath = null;
        if (String(err.message || "").toLowerCase().includes("timeout")) {
          return res.status(504).json({ error: "Obfuscation timeout", detail: "Obfuscation took too long" });
        }
        return res.status(502).json({ error: "Obfuscator error", detail: err && err.message ? err.message : String(err) });
      }
    }

    // write output
    const tmpName = `${Date.now()}_${outFilename}`;
    tmpPath = path.join(OUTPUT_DIR, tmpName);
    await fs.writeFile(tmpPath, resultCode, "utf8");

    // download and cleanup after send
    try {
      res.download(tmpPath, outFilename, async (err) => {
        try { await cleanup([uploadedPath, tmpPath]); } catch(e) {}
        if (err) {
          console.error("[error] Failed to send file:", err && (err.stack || err));
          // headers may be sent already - nothing more can be done reliably
        } else {
          console.log(`[ok] Sent ${outFilename} (preset=${preset})`);
        }
      });
    } catch (e) {
      console.error("[error] download failed:", e && (e.stack || e));
      await cleanup([uploadedPath, tmpPath]);
      return res.status(500).json({ error: "Failed to send file", detail: String(e) });
    }

  } catch (err) {
    console.error("[fatal] /encrypt error:", err && (err.stack || err));
    try { await cleanup([uploadedPath, tmpPath].filter(Boolean)); } catch {}
    return res.status(500).json({ error: "Internal server error", detail: err && err.message ? err.message : String(err) });
  }
});

// /presets endpoint (report from obfuscator if available)
app.get("/presets", (req, res) => {
  try {
    const keys = obfuscator && obfuscator.PRESETS ? Object.keys(obfuscator.PRESETS) : ["ultra","nebula","nova"];
    res.json({ presets: keys, default: keys[0] || "ultra" });
  } catch (e) {
    res.json({ presets: ["ultra"], default: "ultra" });
  }
});

// cleanup endpoint (optional public)
app.post("/cleanup", async (req, res) => {
  try {
    await fs.emptyDir(UPLOAD_DIR);
    await fs.emptyDir(OUTPUT_DIR);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e && e.message ? e.message : String(e) });
  }
});

// global error handler
app.use((err, req, res, next) => {
  console.error("[uncaught]", err && (err.stack || err));
  if (!res.headersSent) res.status(500).json({ error: "Server error", detail: err && err.message ? err.message : String(err) });
  else next(err);
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Seren Encryptor server listening on port ${PORT} (max ${MAX_FILE_MB} MB upload)`);
});

// Memory / health logging (helps debug 'Killed' issues)
setInterval(() => {
  const mem = process.memoryUsage();
  console.log(`[mem] rss=${Math.round(mem.rss/1024/1024)}MB heapUsed=${Math.round(mem.heapUsed/1024/1024)}MB heapTotal=${Math.round(mem.heapTotal/1024/1024)}MB`);
}, Number(process.env.MEM_LOG_MS || 60_000));

// Optional keep-alive ping to prevent Railway idling (use with caution)
if (ENABLE_KEEPALIVE) {
  console.log("[info] Keep-alive enabled - pinging /health every", KEEPALIVE_MS, "ms");
  setInterval(() => {
    fetch(`http://localhost:${PORT}/health`).catch(() => {});
  }, KEEPALIVE_MS);
}

// Process guards
process.on("unhandledRejection", (reason, p) => {
  console.error("[unhandledRejection]", reason && (reason.stack || reason));
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException] (logged, not exiting):", err && (err.stack || err));
});

// graceful shutdown helpers
function gracefulShutdown(sig) {
  console.log(`[info] Received ${sig} — shutting down server...`);
  server.close(() => {
    console.log("[info] HTTP server closed.");
    process.exit(0);
  });
  setTimeout(() => {
    console.warn("[warn] Could not close connections in time, forcing shutdown");
    process.exit(1);
  }, 10_000);
}
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));