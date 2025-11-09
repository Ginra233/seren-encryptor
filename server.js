// server.js
// Seren Encryptor — Express backend (finalized)
// Requires: ./obfuscator (exports: obfuscateCode, PRESETS, TBypass, TByypas, createPasswordTemplate)

const express = require("express");
const multer = require("multer");
const fs = require("fs-extra");
const path = require("path");
const cors = require("cors");

// <-- require dari file obfuscator.js milik kamu -->
const { obfuscateCode, PRESETS: OB_PRESETS, TBypass, TByypas, createPasswordTemplate } = require("./obfuscator");

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

// Multer (disk storage to uploads/)
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

// Preset aliases (frontend friendly -> real preset key)
const PRESET_ALIAS = {
  "helix-core": "helix",
  "aether": "spectra",
  "encrypted-invisible": "strong",
  "ultra": "ultra",
  "nebula": "nebula",
  "nova": "nova",
  "arab": "arab",
  "japan": "japan",
  "japanxarab": "japanxarab",
  "helix": "helix",
  "spectra": "spectra",
  "oblivion": "oblivion",
};

const HIDDEN_PRESETS = ["strong"]; // presets not exposed to UI by default

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

// CORS
app.use(cors({
  origin: '*',
  methods: ['GET','POST','OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));

// Serve frontend if exists
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
  console.log("[info] ./public not found — not serving frontend");
}

// Health endpoint
app.get("/health", (req, res) => {
  const detail = {
    status: "ok",
    uptime: process.uptime(),
    ts: Date.now(),
    obfuscator: typeof obfuscateCode === "function" ? "active" : "missing",
    presets: Object.keys(OB_PRESETS || {}),
    maxFileMB: MAX_FILE_MB,
  };
  res.json(detail);
});

// OPTIONS helper for /encrypt
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

  let uploadedPath = null;
  let tmpPath = null;

  try {
    if (!req.file || !req.file.path) {
      return res.status(400).json({ error: "No file uploaded (field 'file' required')" });
    }

    if (!req.file.originalname.toLowerCase().endsWith(".js")) {
      await cleanup([req.file.path]);
      return res.status(400).json({ error: "Only .js files are allowed" });
    }

    uploadedPath = req.file.path;
    const originalName = req.file.originalname;
    const code = await fs.readFile(uploadedPath, "utf8");

    // preset mapping + validation
    const rawPreset = (req.body.preset && String(req.body.preset).trim()) || "ultra";
    const mappedPreset = PRESET_ALIAS[rawPreset] || rawPreset;
    const allowedPresets = Object.keys(OB_PRESETS || {});
    const preset = allowedPresets.includes(mappedPreset) ? mappedPreset : "ultra";

    if (mappedPreset !== rawPreset) {
      console.log(`[info] Mapped frontend preset "${rawPreset}" -> "${mappedPreset}"`);
    }
    if (!allowedPresets.includes(mappedPreset)) {
      console.warn(`[warn] Requested preset "${mappedPreset}" not found; falling back to "ultra"`);
    }

    const outFilename = (req.body.filename && String(req.body.filename).trim()) ? String(req.body.filename).trim() : safeOutFilename(originalName);
    const password = (req.body.password && String(req.body.password)) || null;
    const includeAntiBypass = parseBool(req.body.includeAntiBypass);
    const includeBypass = parseBool(req.body.includeBypass);

    // support both forceCheck (frontend checkbox) and forceReobfuscate field
    const forceReobfuscate = parseBool(req.body.forceReobfuscate || req.body.forceCheck || req.query.forceReobfuscate);

    // If obfuscator missing, warn and fallback to passthrough
    if (typeof obfuscateCode !== "function") {
      res.set("X-Seren-Warning", "obfuscator-missing");
      console.warn("[warn] obfuscator missing — returning original file content as download");
    }

    // detect already-encrypted/packed input (zero-width identifiers OR common packers)
    const ZERO_WIDTH_RE = /[\u200B\u200C\u200D\uFEFF\u2060\u2061\u200E\u200F]/;
    const PACKED_RE = /eval\(|eval\(function\s*\(|function\s*\(p,a,c,k,e,d\)|_0x[a-f0-9]{4,}/i;
    const looksEncrypted = ZERO_WIDTH_RE.test(code) || PACKED_RE.test(code);

    console.log(`[debug] looksEncrypted=${looksEncrypted} forceReobfuscate=${forceReobfuscate}`);

    // If looksEncrypted and user did NOT ask to force re-obfuscate => inject stub only
    if (looksEncrypted && !forceReobfuscate) {
      console.log("[info] Detected packed/encrypted input — using inject-only flow (no re-obfuscation).");

      // createInjectStub now composes snippets from your obfuscator.js
      function createInjectStub({ includeBypass, includeAntiBypass, password }) {
        const lines = [];
        if (includeAntiBypass) lines.push(TByypas);
        if (includeBypass) lines.push(TBypass);
        if (password) {
          const encoded = Buffer.from(password).toString("base64");
          // createPasswordTemplate returns full wrapper (includes anti-bypass snippet inside it)
          lines.push(createPasswordTemplate(encoded, ""));
        }
        // ensure a separator so payload starts on new line
        lines.push(";\n");
        return lines.join("\n");
      }

      const injectStub = createInjectStub({ includeBypass, includeAntiBypass, password });

      // preserve shebang and strip BOM
      let payload = code;
      let shebang = "";
      if (payload.startsWith("#!")) {
        const idx = payload.indexOf("\n");
        shebang = payload.slice(0, idx + 1);
        payload = payload.slice(idx + 1);
      }
      payload = payload.replace(/^\uFEFF/, "");

      const injected = shebang + injectStub + payload;

      const tmpName = `${Date.now()}_${safeOutFilename(originalName)}`;
      tmpPath = path.join(OUTPUT_DIR, tmpName);

      try {
        await fs.writeFile(tmpPath, injected, "utf8");
        console.log("[info] Injected stub + payload written, sending to client...");
        return res.download(tmpPath, safeOutFilename(originalName), async (err) => {
          try { await cleanup([tmpPath, uploadedPath]); } catch (e) { /* ignore */ }
          if (err) {
            console.error("[error] download after injection failed:", err);
            // fallback to original
            try {
              const fbName = `${Date.now()}_fallback_${safeOutFilename(originalName)}`;
              const fbPath = path.join(OUTPUT_DIR, fbName);
              await fs.writeFile(fbPath, code, "utf8");
              return res.download(fbPath, safeOutFilename(originalName), async () => {
                try { await cleanup([fbPath, uploadedPath]); } catch (e) {}
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
        try {
          const fbName = `${Date.now()}_fallback_${safeOutFilename(originalName)}`;
          const fbPath = path.join(OUTPUT_DIR, fbName);
          await fs.writeFile(fbPath, code, "utf8");
          return res.download(fbPath, safeOutFilename(originalName), async () => {
            try { await cleanup([fbPath, uploadedPath]); } catch (e) {}
          });
        } catch (e2) {
          console.error("[fatal] fallback write failed:", e2);
          if (!res.headersSent) res.status(500).json({ error: "Failed to send file", detail: String(e2) });
        }
      }
    }

    // Otherwise: run obfuscator (or pass-through if obfuscator absent)
    let resultCode = code;
    if (typeof obfuscateCode === "function") {
      const fileSizeMB = (req.file && req.file.size) ? (req.file.size / (1024 * 1024)) : 0;
      const dynamicTimeout = OBF_TIMEOUT_MS + Math.floor(fileSizeMB / 10) * 30000;
      console.log(`[info] Running obfuscator (preset=${preset}) with timeout ${(dynamicTimeout/1000).toFixed(1)}s for ${fileSizeMB.toFixed(2)} MB file`);
      try {
        resultCode = await withTimeout(
          obfuscateCode(code, preset, { includeAntiBypass, includeBypass, password, timeoutMs: dynamicTimeout }),
          dynamicTimeout + 2000
        );
      } catch (err) {
        console.error("[error] obfuscation failed or timed out:", err && (err.stack || err));
        await cleanup([uploadedPath]);
        uploadedPath = null;
        if (String(err.message || "").toLowerCase().includes("timeout")) {
          return res.status(504).json({ error: "Obfuscation timeout", detail: `Obfuscation took too long (>${(dynamicTimeout/1000)}s)` });
        }
        return res.status(502).json({ error: "Obfuscator error", detail: err && err.message ? err.message : String(err) });
      }
    } else {
      res.set("X-Seren-Warning", "obfuscator-missing");
      console.warn("[warn] obfuscator missing — returning original file content as download");
    }

    if (!resultCode || typeof resultCode !== "string") {
      console.warn("[warn] resultCode invalid or empty — using original code");
      resultCode = code;
    }

    const outTmpName = `${Date.now()}_${outFilename}`;
    tmpPath = path.join(OUTPUT_DIR, outTmpName);
    await fs.writeFile(tmpPath, resultCode, "utf8");

    try {
      return res.download(tmpPath, outFilename, async (err) => {
        try { await cleanup([uploadedPath, tmpPath]); } catch (e) {}
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
    try { await cleanup([uploadedPath, tmpPath].filter(Boolean)); } catch (e) {}
    return res.status(500).json({ error: "Internal server error", detail: err && err.message ? err.message : String(err) });
  }
});

// presets listing (expose aliases too)
app.get("/presets", (req, res) => {
  try {
    const keys = Object.keys(OB_PRESETS || {});
    const visible = keys.filter(k => !HIDDEN_PRESETS.includes(k));
    res.json({ presets: visible, aliases: PRESET_ALIAS, default: visible[0] || "ultra" });
  } catch (e) {
    res.json({ presets: ["ultra"], aliases: PRESET_ALIAS, default: "ultra" });
  }
});

// cleanup endpoint
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
  console.error("[uncaught]", err && err.stack ? err.stack : err);
  if (!res.headersSent) res.status(500).json({ error: "Server error", detail: err && err.message ? err.message : String(err) });
  else next(err);
});

// start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Seren Encryptor server listening on port ${PORT} (max ${MAX_FILE_MB} MB upload)`);
});

// global guards: log and avoid crashing unhandled rejections
process.on("unhandledRejection", (reason, p) => {
  console.error("[unhandledRejection]", reason && (reason.stack || reason));
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException] (will not exit):", err && (err.stack || err));
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