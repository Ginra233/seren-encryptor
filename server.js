// server.js
// -------------------------------------------------------------
// Seren Encryptor — Web API Server
// Provides endpoints to obfuscate JS code using various presets.
// Supports password protection & anti-bypass.
// Optimized for Railway and local deployment.
// -------------------------------------------------------------

const express = require("express");
const multer = require("multer");
const fs = require("fs-extra");
const path = require("path");
const { obfuscateCode, PRESETS } = require("./obfuscator");

const app = express();
const upload = multer({ dest: "uploads/" });
const PORT = process.env.PORT || 8080;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend (if exists)
const frontendPath = path.join(__dirname, "public");
if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
}

// -------------------- Routes --------------------

// 🧠 Health check
app.get("/", (req, res) => {
  res.send(`
    <div style="font-family:sans-serif;padding:2rem;text-align:center">
      <h1>🟣 Seren Encryptor Server</h1>
      <p>Server is running. Use <code>/api/encrypt</code> endpoint to obfuscate code.</p>
    </div>
  `);
});

// ⚙️ API: Encrypt code (via raw JSON)
app.post("/api/encrypt", async (req, res) => {
  try {
    const { code, preset, password, includeAntiBypass } = req.body;
    if (!code) return res.status(400).json({ error: "No code provided" });

    const selectedPreset = preset || "ultra";
    console.log(`[INFO] Encrypting with preset: ${selectedPreset}`);

    const obfuscated = await obfuscateCode(code, selectedPreset, {
      includeAntiBypass: !!includeAntiBypass,
      password: password || null,
    });

    res.json({
      success: true,
      preset: selectedPreset,
      length: obfuscated.length,
      result: obfuscated,
    });
  } catch (err) {
    console.error("[ERROR]", err);
    res.status(500).json({ error: err.message || "Encryption failed" });
  }
});

// 📁 API: Encrypt uploaded .js file
app.post("/api/encrypt-file", upload.single("file"), async (req, res) => {
  try {
    const { preset, password, includeAntiBypass } = req.body;
    const filePath = req.file?.path;

    if (!filePath) return res.status(400).json({ error: "No file uploaded" });
    const code = await fs.readFile(filePath, "utf8");

    const selectedPreset = preset || "ultra";
    console.log(`[INFO] Encrypting uploaded file (${req.file.originalname}) with preset: ${selectedPreset}`);

    const obfuscated = await obfuscateCode(code, selectedPreset, {
      includeAntiBypass: !!includeAntiBypass,
      password: password || null,
    });

    const outputDir = path.join(__dirname, "output");
    await fs.ensureDir(outputDir);

    const outName = `${path.parse(req.file.originalname).name}-encrypted.js`;
    const outputFile = path.join(outputDir, outName);

    await fs.writeFile(outputFile, obfuscated, "utf8");
    await fs.remove(filePath); // Clean temp

    res.json({
      success: true,
      message: "File encrypted successfully",
      output: `/output/${outName}`,
    });
  } catch (err) {
    console.error("[ERROR]", err);
    res.status(500).json({ error: err.message || "Encryption failed" });
  }
});

// 🧾 List available presets
app.get("/api/presets", (req, res) => {
  res.json({
    presets: Object.keys(PRESETS),
    default: "ultra",
  });
});

// 🧹 Cleanup uploaded/output files
app.post("/api/cleanup", async (_req, res) => {
  try {
    await fs.emptyDir(path.join(__dirname, "uploads"));
    await fs.emptyDir(path.join(__dirname, "output"));
    res.json({ success: true, message: "Temporary files cleaned up." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------- Start Server --------------------
app.listen(PORT, () => {
  console.log(`🚀 Seren Encryptor API running on port ${PORT}`);
});
