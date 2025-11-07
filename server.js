// server.js — Seren Encryptor Backend (Railway-ready, CommonJS)
// -----------------------------------------------------------

const express = require("express");
const multer = require("multer");
const fs = require("fs-extra");
const path = require("path");
const helmet = require("helmet");
const compression = require("compression");

const app = express();
app.disable("x-powered-by");

// ====== Config ======
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const MAX_FILE_MB = parseInt(process.env.MAX_FILE_MB || "10", 10);
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

// ====== Middleware ======
app.use(helmet());
app.use(compression());
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// ====== Load obfuscator module (optional) ======
let obfuscator = null;
try {
  obfuscator = require("./obfuscator");
  if (typeof obfuscator.obfuscateCode !== "function") {
    console.warn("[warn] Invalid obfuscator module — missing obfuscateCode()");
    obfuscator = null;
  } else {
    console.log("[ok] Obfuscator module loaded.");
  }
} catch (e) {
  console.warn("[warn] ./obfuscator not found — running in passthrough mode");
  obfuscator = null;
}

// ====== Multer setup ======
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES },
});

// ====== Helper functions ======
function parseBool(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === "boolean") return value;
  const s = String(value).toLowerCase().trim();
  return ["1", "true", "on", "yes"].includes(s);
}

// ====== Routes ======

// Health
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: Date.now(),
    obfuscator: obfuscator ? "active" : "missing",
  });
});

// OPTIONS for /encrypt (CORS-friendly)
app.options("/encrypt", (req, res) => {
  res.set("Allow", "POST,OPTIONS");
  res.sendStatus(204);
});

// /encrypt endpoint
app.post("/encrypt", upload.single("file"), async (req, res) => {
  try {
    let originalCode = null;
    let incomingFileName = null;

    if (req.file && req.file.buffer) {
      incomingFileName = req.file.originalname || "uploaded.js";
      if (!incomingFileName.toLowerCase().endsWith(".js")) incomingFileName += ".js";
      originalCode = req.file.buffer.toString("utf8");
    } else if (req.body && req.body.code) {
      incomingFileName = req.body.filename || "uploaded.js";
      if (!incomingFileName.toLowerCase().endsWith(".js")) incomingFileName += ".js";
      originalCode = String(req.body.code);
    } else {
      return res.status(400).json({ error: "No file or code provided" });
    }

    const preset = String((req.body && req.body.preset) || "ultra");
    const outFilename = (req.body && req.body.filename && req.body.filename.trim()) || `Encrypted-${incomingFileName}`;
    const password = req.body && req.body.password ? String(req.body.password) : null;
    const includeAntiBypass = parseBool(req.body && req.body.includeAntiBypass);

    let resultCode = originalCode;
    let warning = null;

    if (obfuscator) {
      try {
        resultCode = await obfuscator.obfuscateCode(originalCode, preset, {
          includeAntiBypass,
          password,
        });
      } catch (err) {
        console.error("[error] Obfuscation failed:", err && err.message ? err.message : err);
        return res.status(500).json({ error: "Obfuscation failed", detail: err && err.message ? err.message : String(err) });
      }
    } else {
      warning = "Obfuscator module missing. Returning original code.";
      console.warn("[warn] " + warning);
      // note: we set a header so client can detect passthrough
      res.set("X-Seren-Warning", "obfuscator-missing");
    }

    // write temp file and stream to client
    const tmpName = `Encrypted_${Date.now()}.js`;
    const tmpPath = path.join(__dirname, tmpName);
    await fs.writeFile(tmpPath, resultCode, "utf8");

    res.download(tmpPath, outFilename.endsWith(".js") ? outFilename : `${outFilename}.js`, async (err) => {
      // cleanup
      try {
        await fs.remove(tmpPath);
      } catch (e) {
        // ignore
      }
      if (err) {
        console.error("[error] Error sending file:", err);
      } else {
        console.log(`[ok] Sent file ${outFilename}`);
      }
    });

    if (warning) {
      // already set header above — also log
      console.warn("[warn] " + warning);
    }
  } catch (err) {
    console.error("[fatal] Unexpected error in /encrypt:", err && err.message ? err.message : err);
    res.status(500).json({ error: "Internal Server Error", detail: err && err.message ? err.message : String(err) });
  }
});

// ====== Serve static frontend if available ======
const publicPath = path.join(__dirname, "public");
if (fs.existsSync(publicPath)) {
  app.use(express.static(publicPath, { index: false }));
  // SPA fallback
  app.get("*", (req, res, next) => {
    const indexFile = path.join(publicPath, "index.html");
    if (fs.existsSync(indexFile)) return res.sendFile(indexFile);
    return next();
  });
  console.log("[info] Serving frontend from ./public");
} else {
  console.warn("[warn] No frontend folder found (./public)");
}

// ====== Error handler ======
app.use((err, req, res, next) => {
  console.error("[uncaught]", err && err.message ? err.message : err);
  if (!res.headersSent) res.status(500).json({ error: "Server error", detail: err && err.message ? err.message : String(err) });
  else next(err);
});

// ====== Start server ======
const server = app.listen(PORT, () => {
  console.log(`[ok] Seren Encryptor backend listening on port ${PORT} (max upload ${MAX_FILE_MB} MB)`);
});

// graceful shutdown
function shutdown(signal) {
  console.log(`[info] Received ${signal} — shutting down...`);
  server.close(() => {
    console.log("[info] HTTP server closed.");
    process.exit(0);
  });
  // force exit after 10s
  setTimeout(() => {
    console.warn("[warn] Forcing shutdown.");
    process.exit(1);
  }, 10000);
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
