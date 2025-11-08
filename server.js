// server.js (final patched)
// Seren Encryptor — Express backend (improved error handling, CORS, obfuscation timeout, preset aliasing)
// Cleaned and fixed: removed top-level await, single looksEncrypted, dynamic timeout, inject-only flow for packed files.

const express = require("express");
const multer = require("multer");
const fs = require("fs-extra");
const path = require("path");
const cors = require("cors");
const { obfuscateCode, TBypass, TByypas, createPasswordTemplate } = require("./obfuscator");

// Prevent noisy max listeners on heavy uploads
require("events").EventEmitter.defaultMaxListeners = 50;

const app = express();
app.disable("x-powered-by");

// parse large bodies (safety for big uploads via other endpoints)
app.use(express.json({ limit: "150mb" }));
app.use(express.urlencoded({ limit: "150mb", extended: true }));

// Config
const PORT = Number(process.env.PORT || 8080);
const MAX_FILE_MB = Number(process.env.MAX_FILE_MB || 40);
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

const HIDDEN_PRESETS = ['strong'];
const PRESET_ALIAS = {
  "helix-core": "helix",
  "aether": "spectra",
  "ultra": "ultra",
  "encrypted-invisible": "strong",
  "nebula": "nebula",
  "nova": "nova",
  "arab": "arab",
  "japan": "japan",
  "japanxarab": "japanxarab",
  "helix": "helix",
  "spectra": "spectra",
  "oblivion": "oblivion",
};

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

// CORS + basic middleware
app.use(cors({
  origin: '*',
  methods: ['GET','POST','OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));

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

    // map & validate preset
    const rawPreset = (req.body.preset && String(req.body.preset).trim()) || "ultra";
    const mappedPreset = PRESET_ALIAS[rawPreset] || rawPreset;
    const allowedPresets = obfuscator && obfuscator.PRESETS ? Object.keys(obfuscator.PRESETS) : ["ultra", "nebula", "nova", "arab", "japan", "japanxarab"];
    const preset = allowedPresets.includes(mappedPreset) ? mappedPreset : "ultra";

    if (mappedPreset !== rawPreset) {
      console.log(`[info] Mapped frontend preset "${rawPreset}" -> "${mappedPreset}"`);
    }
    if (preset !== mappedPreset) {
      console.warn(`[warn] Requested preset "${mappedPreset}" is not allowed; falling back to "ultra"`);
    }

    const outFilename = (req.body.filename && String(req.body.filename).trim()) ? String(req.body.filename).trim() : safeOutFilename(originalName);
    const password = (req.body.password && String(req.body.password)) || null;
    const includeAntiBypass = parseBool(req.body.includeAntiBypass);
    const includeBypass = parseBool(req.body.includeBypass);

    // if obfuscator missing, set header and fallback to passthrough (original code returned)
    if (!obfuscator) {
      res.set("X-Seren-Warning", "obfuscator-missing");
      console.warn("[warn] obfuscator missing — returning original file content as download");
    }

    // --- START: safe inject for already-encrypted files (handles zero-width identifiers) ---
    const ZERO_WIDTH_RE = /[\u200B\u200C\u200D\uFEFF\u2060\u2061\u200E\u200F]/;
    const PACKED_RE = /eval\(|eval\(function\s*\(|function\s*\(p,a,c,k,e,d\)|_0x[a-f0-9]{4,}|String\.fromCharCode\(|atob\(|Buffer\.from\(/i;

    // single, canonical detection variable
    const looksEncrypted = ZERO_WIDTH_RE.test(code) || PACKED_RE.test(code);

    // debug preview (brief)
    console.log(`[debug] code preview (first 180 chars): ${String(code).slice(0,180).replace(/\n/g,' ')}...`);

    if (looksEncrypted) {
      console.log("[info] Uploaded file appears already-obfuscated/packed — using inject-only flow.");

      // create safe IIFE stub that won't break payload; only includes requested pieces
function createInjectStub({ includeBypass, includeAntiBypass, password }) {
  const parts = [];

  parts.push("// === Seren Injection Layer Start ===");
  parts.push("(function(){ try {");
  parts.push("  if (typeof globalThis.__seren !== 'object') globalThis.__seren = {};");

  // Bypass
  if (includeBypass && TBypass) {
    parts.push("  // Injecting full TBypass logic");
    parts.push("(function(){");
    parts.push(TBypass);
    parts.push("})();");
  }

  // Anti-bypass
  if (includeAntiBypass && TByypas) {
    parts.push("  // Injecting full AntiBypass logic");
    parts.push("(function(){");
    parts.push(TByypas);
    parts.push("})();");
  }

  // Password (opsional, hanya jika diisi)
  if (password && createPasswordTemplate) {
    const encoded = Buffer.from(password).toString("base64");
    parts.push("  // Injecting password wrapper");
    parts.push(createPasswordTemplate(encoded, ""));
  }

  parts.push("} catch(e) { /* inject safe-fail */ }})();");
  parts.push("// === Seren Injection Layer End ===");
  parts.push("\n");

  return parts.join("\n");
}

      const injectStub = createInjectStub({
        includeBypass: includeBypass,
        includeAntiBypass: includeAntiBypass,
        password: password
      });

      // preserve shebang if present and remove BOM
      let payload = code;
      let shebang = "";
      if (payload.startsWith("#!")) {
        const idx = payload.indexOf("\n");
        shebang = payload.slice(0, idx + 1);
        payload = payload.slice(idx + 1);
      }
      payload = payload.replace(/^\uFEFF/, "");

      const injected = shebang + injectStub + payload;

      // write temp output and send (with fallback to original)
      const tmpName = `${Date.now()}_${safeOutFilename(originalName)}`;
      tmpPath = path.join(OUTPUT_DIR, tmpName);

      try {
        await fs.writeFile(tmpPath, injected, "utf8");
        console.log("[info] Injected stub + encrypted payload written, sending to client...");
        return res.download(tmpPath, safeOutFilename(originalName), async (err) => {
          try { await fs.remove(tmpPath); } catch (e) {}
          try { await fs.remove(uploadedPath); } catch (e) {}
          if (err) {
            console.error("[error] download after injection failed:", err);
            // fallback: send original file raw
            try {
              const fallbackTmp = `${Date.now()}_fallback_${safeOutFilename(originalName)}`;
              const fallbackPath = path.join(OUTPUT_DIR, fallbackTmp);
              await fs.writeFile(fallbackPath, code, "utf8");
              console.log("[info] Sending fallback (original) file instead.");
              return res.download(fallbackPath, safeOutFilename(originalName), async () => {
                try { await fs.remove(fallbackPath); } catch (e) {}
                try { await fs.remove(uploadedPath); } catch (e) {}
              });
            } catch (e2) {
              console.error("[fatal] fallback send failed:", e2);
              if (!res.headersSent) res.status(500).json({ error: "Failed to send injected or fallback file", detail: String(e2) });
            }
          } else {
            console.log("[ok] Injected file delivered.");
          }
        });
      } catch (e) {
        console.error("[fatal] write/send injected failed:", e);
        // fallback send original
        try {
          const fallbackTmp = `${Date.now()}_fallback_${safeOutFilename(originalName)}`;
          const fallbackPath = path.join(OUTPUT_DIR, fallbackTmp);
          await fs.writeFile(fallbackPath, code, "utf8");
          console.log("[info] Sending fallback (original) file due to write error.");
          return res.download(fallbackPath, safeOutFilename(originalName), async () => {
            try { await fs.remove(fallbackPath); } catch (e) {}
            try { await fs.remove(uploadedPath); } catch (e) {}
          });
        } catch (e2) {
          console.error("[fatal] fallback write failed:", e2);
          if (!res.headersSent) res.status(500).json({ error: "Failed to send file", detail: String(e2) });
        }
      }
    }
    // --- END: safe inject for already-encrypted files ---

    // If we reach here, file is not detected as already encrypted — proceed to obfuscator
    let resultCode = code;

    if (obfuscator) {
      // dynamic timeout scaled by file size: +30s per 10MB
      const fileSizeMB = (req.file && req.file.size) ? (req.file.size / (1024 * 1024)) : 0;
      const dynamicTimeout = OBF_TIMEOUT_MS + Math.floor(fileSizeMB / 10) * 30000;
      console.log(`[info] Running obfuscator (preset=${preset}) with timeout ${(dynamicTimeout/1000).toFixed(1)}s for ${fileSizeMB.toFixed(2)} MB file`);
      try {
        resultCode = await withTimeout(
          obfuscator.obfuscateCode(code, preset, { includeAntiBypass, includeBypass, password, timeoutMs: dynamicTimeout }),
          dynamicTimeout + 2000 // optional small buffer
        );
      } catch (err) {
        console.error("[error] obfuscation failed or timed out:", err && err.stack ? err.stack : err);
        await cleanup([uploadedPath]);
        uploadedPath = null;
        if (String(err.message || "").toLowerCase().includes("timeout")) {
          return res.status(504).json({ error: "Obfuscation timeout", detail: `Obfuscation took too long (>${(dynamicTimeout/1000)}s)` });
        }
        return res.status(502).json({ error: "Obfuscator error", detail: err && err.message ? err.message : String(err) });
      }
    } else {
      // obfuscator not loaded: passthrough (original behavior)
      res.set("X-Seren-Warning", "obfuscator-missing");
      console.warn("[warn] obfuscator missing — returning original file content as download");
    }

    // ensure resultCode is valid
    if (!resultCode || typeof resultCode !== "string") {
      console.warn("[warn] resultCode is invalid or empty, using original code instead");
      resultCode = code;
    }

    // write output temp file and send
    const tmpName = `${Date.now()}_${outFilename}`;
    tmpPath = path.join(OUTPUT_DIR, tmpName);
    await fs.writeFile(tmpPath, resultCode, "utf8");

    try {
      res.download(tmpPath, outFilename, async (err) => {
        try {
          await cleanup([uploadedPath, tmpPath]);
        } catch (e) {
          // ignore cleanup errors
        }
        if (err) {
          console.error("[error] Failed to send file:", err && (err.stack || err));
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
    const keys = obfuscator && obfuscator.PRESETS
      ? Object.keys(obfuscator.PRESETS)
      : ["ultra", "nebula", "nova", "arab", "japan", "japanxarab"];

    const hidden = Array.isArray(typeof HIDDEN_PRESETS !== 'undefined' ? HIDDEN_PRESETS : [])
      ? (typeof HIDDEN_PRESETS !== 'undefined' ? HIDDEN_PRESETS : [])
      : [];

    const visible = keys.filter(k => !hidden.includes(k));

    res.json({ presets: visible, aliases: typeof PRESET_ALIAS !== 'undefined' ? PRESET_ALIAS : {}, default: visible[0] || "ultra" });
  } catch (e) {
    res.json({ presets: ["ultra"], aliases: typeof PRESET_ALIAS !== 'undefined' ? PRESET_ALIAS : {}, default: "ultra" });
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