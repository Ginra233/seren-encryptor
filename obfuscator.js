// obfuscator.js
// -------------------------------------------------------------
// Seren Encryptor Obfuscator Engine
// Supports multiple preset modes + anti-bypass + password protect.
// Optimized for Railway deployment (no native crashes, no ESM errors)
// -------------------------------------------------------------

const JsConfuser = require("js-confuser");

// -------------------- Preset Configs --------------------
function getUltraSafeConfig() {
  return {
    target: "node",
    compact: true,
    calculator: true,
    hexadecimalNumbers: true,
    controlFlowFlattening: 1,
    deadCode: 1,
    dispatcher: true,
    duplicateLiteralsRemoval: 1,
    flatten: true,
    globalConcealing: true,
    identifierGenerator: "zeroWidth",
    renameVariables: true,
    renameGlobals: true,
    minify: true,
    movedDeclarations: true,
    objectExtraction: true,
    opaquePredicates: 0.75,
    stringConcealing: true,
    stringCompression: true,
    stringEncoding: true,
    stringSplitting: 0.75,
  };
}

function getNebulaObfuscationConfig() {
  const genName = () => "NX" + Math.random().toString(36).substring(2, 8);
  return {
    target: "node",
    compact: true,
    renameVariables: true,
    renameGlobals: true,
    identifierGenerator: genName,
    stringCompression: true,
    stringEncoding: true,
    controlFlowFlattening: 1,
    flatten: true,
    shuffle: true,
    rgf: true,
    deadCode: true,
    opaquePredicates: true,
    dispatcher: true,
    globalConcealing: true,
    objectExtraction: true,
    duplicateLiteralsRemoval: true,
    lock: {
      selfDefending: true,
      antiDebug: true,
      integrity: true,
      tamperProtection: true,
    },
  };
}

function getNovaObfuscationConfig() {
  return {
    target: "node",
    compact: true,
    controlFlowFlattening: 1,
    deadCode: 1,
    dispatcher: true,
    flatten: true,
    globalConcealing: true,
    hexadecimalNumbers: 1,
    identifierGenerator: () => "v" + Math.random().toString(36).substring(7),
    lock: {
      antiDebug: true,
      integrity: true,
      selfDefending: true,
    },
    minify: true,
    movedDeclarations: true,
    objectExtraction: true,
    opaquePredicates: true,
    renameGlobals: true,
    renameVariables: true,
    shuffle: true,
    stack: true,
    stringCompression: true,
    stringConcealing: true,
  };
}

function getArabObfuscationConfig() {
  const arabicChars = "أبتثجحخدذرزسشصضطظعغفقكلمنهوي".split("");
  const genName = () =>
    Array.from({ length: 3 + Math.floor(Math.random() * 4) }, () =>
      arabicChars[Math.floor(Math.random() * arabicChars.length)]
    ).join("");

  return {
    target: "node",
    compact: true,
    renameVariables: true,
    renameGlobals: true,
    identifierGenerator: genName,
    stringEncoding: true,
    stringSplitting: true,
    controlFlowFlattening: 1,
    shuffle: true,
    duplicateLiteralsRemoval: true,
    deadCode: true,
    calculator: true,
    opaquePredicates: true,
    lock: {
      selfDefending: true,
      antiDebug: true,
      integrity: true,
      tamperProtection: true,
    },
  };
}

function getJapanObfuscationConfig() {
  const jp =
    "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん".split("");
  const genName = () =>
    Array.from({ length: 3 + Math.floor(Math.random() * 4) }, () =>
      jp[Math.floor(Math.random() * jp.length)]
    ).join("");

  return {
    target: "node",
    compact: true,
    renameVariables: true,
    renameGlobals: true,
    identifierGenerator: genName,
    stringEncoding: true,
    stringSplitting: true,
    controlFlowFlattening: 1,
    flatten: true,
    shuffle: true,
    duplicateLiteralsRemoval: true,
    deadCode: true,
    calculator: true,
    opaquePredicates: true,
    lock: {
      selfDefending: true,
      antiDebug: true,
      integrity: true,
      tamperProtection: true,
    },
  };
}

function getJapanxArabObfuscationConfig() {
  const mix =
    "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよأبتثجحخدذرزسشصضطظعغفقكلمنهويらりるれろわをん".split("");
  const genName = () =>
    Array.from({ length: 3 + Math.floor(Math.random() * 4) }, () =>
      mix[Math.floor(Math.random() * mix.length)]
    ).join("");

  return {
    target: "node",
    compact: true,
    renameVariables: true,
    renameGlobals: true,
    identifierGenerator: genName,
    stringCompression: true,
    stringConcealing: true,
    stringEncoding: true,
    stringSplitting: true,
    controlFlowFlattening: 1,
    flatten: true,
    shuffle: true,
    dispatcher: true,
    duplicateLiteralsRemoval: true,
    deadCode: true,
    calculator: true,
    opaquePredicates: true,
    lock: {
      selfDefending: true,
      antiDebug: true,
      integrity: true,
      tamperProtection: true,
    },
  };
}

// -------------------- Anti-bypass snippet --------------------
const TByypas = `(async () => {
  try {
    const fs = require("fs");
    const path = require("path");
    const pkgPath = path.join(process.cwd(), "package.json");
    const pkg = fs.existsSync(pkgPath) ? JSON.parse(fs.readFileSync(pkgPath, "utf8")) : {};
    const mainFile = path.resolve(process.cwd(), pkg.main || process.argv[1]);
    const snapshot = fs.existsSync(mainFile) ? fs.readFileSync(mainFile, "utf8") : "";

    setInterval(() => {
      if (fs.existsSync(mainFile) && fs.readFileSync(mainFile, "utf8") !== snapshot) {
        console.log("[⚠️] Source modified! Exiting...");
        process.exit(1);
      }
    }, 3000);
  } catch {}
})();`;

// -------------------- Password wrapper --------------------
function createPasswordTemplate(encodedPassword, originalCode) {
  return `${TByypas}
(async () => {
  try {
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.clear();
    console.log("🔒 ENTER PASSWORD TO RUN:");
    rl.question('> ', (input) => {
      const correct = Buffer.from('${encodedPassword}', 'base64').toString('utf8');
      if (input !== correct) {
        console.log("❌ INVALID PASSWORD");
        process.exit(1);
      }
      rl.close();
${originalCode}
    });
  } catch {}
})();`;
}

// -------------------- Preset Map --------------------
const PRESETS = {
  ultra: getUltraSafeConfig,
  nebula: getNebulaObfuscationConfig,
  nova: getNovaObfuscationConfig,
  arab: getArabObfuscationConfig,
  japan: getJapanObfuscationConfig,
  japanxarab: getJapanxArabObfuscationConfig,
};

// -------------------- Main Function --------------------
async function obfuscateCode(code, preset = "ultra", options = {}) {
  if (typeof code !== "string") throw new Error("Code must be string");
  const { includeAntiBypass = false, password = null } = options;

  let baseCode = code;

  if (password) {
    const encoded = Buffer.from(password).toString("base64");
    baseCode = createPasswordTemplate(encoded, baseCode);
  } else if (includeAntiBypass) {
    baseCode = `${TByypas}\n${baseCode}`;
  }

  const configFn = PRESETS[preset] || PRESETS.ultra;
  const config = typeof configFn === "function" ? configFn() : configFn;

  const result = await JsConfuser.obfuscate(baseCode, config);

  return typeof result === "string"
    ? result
    : result?.code || result?.toString() || String(result);
}

// -------------------- Exports --------------------
module.exports = {
  obfuscateCode,
  PRESETS,
};
