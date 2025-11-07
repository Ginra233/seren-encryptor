// server.js — Seren Encryptor Backend (Final Version)
// -----------------------------------------------
// Secure, production-ready Express backend for JS encryption/obfuscation.

const express = require("express");
const multer = require("multer");
const fs = require("fs-extra");
const path = require("path");
const helmet = require("helmet");
const compression = require("compression");
const chalk = require("chalk");

const app = express();
app.disable("x-powered-by");

// ====== Config ======
const PORT = process.env.PORT || 3000;
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
    console.warn(chalk.yellow("[warn] Invalid obfuscator module — missing obfuscateCode()"));
    obfuscator = null;
  } else {
    console.log(chalk.green("[ok] Obfuscator module loaded"));
  }
} catch {
  console.warn(chalk.yellow("[warn] ./obfuscator not found — running in passthrough mode"));
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

// --- Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: Date.now(),
    obfuscator: obfuscator ? "active" : "missing",
  });
});

// --- OPTIONS for CORS
app.options("/encrypt", (req, res) => {
  res.set("Allow", "POST,OPTIONS");
  res.sendStatus(204);
});

// --- Main /encrypt endpoint
app.post("/encrypt", upload.single("file"), async (req, res) => {
  try {
    let originalCode = null;
    let incomingFileName = null;

    if (req.file && req.file.buffer) {
      incomingFileName = req.file.originalname || "uploaded.js";
      if (!incomingFileName.toLowerCase().endsWith(".js")) incomingFileName += ".js";
      originalCode = req.file.buffer.toString("utf8");
    } else if (req.body.code) {
      incomingFileName = req.body.filename || "uploaded.js";
      if (!incomingFileName.toLowerCase().endsWith(".js")) incomingFileName += ".js";
      originalCode = String(req.body.code);
    } else {
      return res.status(400).json({ error: "No file or code provided" });
    }

    const preset = String(req.body.preset || "ultra");
    const outFilename = (req.body.filename && req.body.filename.trim()) || `Encrypted-${incomingFileName}`;
    const password = req.body.password || null;
    const includeAntiBypass = parseBool(req.body.includeAntiBypass);

    // Run obfuscator or passthrough
    let resultCode = originalCode;
    let warning = null;

    if (obfuscator) {
      try {
        resultCode = await obfuscator.obfuscateCode(originalCode, preset, {
          includeAntiBypass,
          password,
        });
      } catch (err) {
        console.error(chalk.red("[error] Obfuscation failed:"), err);
        return res.status(500).json({ error: "Obfuscation failed", detail: err.message });
      }
    } else {
      warning = "Obfuscator module missing. Returning original code.";
      console.warn(chalk.yellow("[warn] " + warning));
    }

    const tmpName = `Encrypted_${Date.now()}.js`;
    const tmpPath = path.join(__dirname, tmpName);
    await fs.writeFile(tmpPath, resultCode, "utf8");

    res.download(tmpPath, outFilename.endsWith(".js") ? outFilename : `${outFilename}.js`, async (err) => {
      await fs.remove(tmpPath).catch(() => {});
      if (err) console.error(chalk.red("[error] Error sending file:"), err);
    });

    if (warning) res.set("X-Seren-Warning", warning);
  } catch (err) {
    console.error(chalk.red("[fatal] Unexpected error in /encrypt:"), err);
    res.status(500).json({ error: "Internal Server Error", detail: err.message });
  }
});

// ====== Static frontend ======
const publicPath = path.join(__dirname, "public");
if (fs.existsSync(publicPath)) {
  app.use(express.static(publicPath));
  app.get("*", (req, res) => res.sendFile(path.join(publicPath, "index.html")));
  console.log(chalk.cyan("[info] Serving frontend from ./public"));
} else {
  console.warn(chalk.yellow("[warn] No frontend folder found (./public)"));
}

// ====== Error handler ======
app.use((err, req, res, next) => {
  console.error(chalk.red("[uncaught]"), err);
  if (!res.headersSent) res.status(500).json({ error: "Server error", detail: err.message });
  else next(err);
});

// ====== Start server ======
app.listen(PORT, () => {
  console.log(chalk.green(`✅ Seren Encryptor backend running on port ${PORT}`));
  console.log(chalk.gray(`   Max upload: ${MAX_FILE_MB} MB`));
  console.log(chalk.gray(`   Health: GET /health`));
  console.log(chalk.gray(`   Encrypt: POST /encrypt`));
});
