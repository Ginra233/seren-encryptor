// obfuscator.js (stable + new presets: helix, spectra, oblivion)
// Seren Encryptor Obfuscator Engine — hardened for Railway deployment.
// - Adds timeout & crash protection
// - Graceful fallback to passthrough if JsConfuser fails
// - Includes presets: ultra, nebula, nova, arab, japan, japanxarab, helix, spectra, oblivion

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
    lock: { antiDebug: true, integrity: true, selfDefending: true },
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

// -------------------- NEW PRESETS --------------------

// Helix Core — hybrid AES-like wrapper + heavy anti-debug (best for distribution)
function getHelixCoreConfig() {
  return {
    target: "node",
    compact: true,
    minify: true,
    controlFlowFlattening: 1,
    deadCode: 1,
    dispatcher: true,
    flatten: true,
    globalConcealing: true,
    renameVariables: true,
    renameGlobals: true,
    identifierGenerator: () => "HX" + Math.random().toString(36).slice(2, 8),
    objectExtraction: true,
    stringConcealing: true,
    stringCompression: true,
    stringEncoding: true,
    opaquePredicates: 0.85,
    lock: {
      selfDefending: true,
      antiDebug: true,
      integrity: true,
      tamperProtection: true,
      antiTamperRuntime: true,
    },
    // "aes-like wrapper" simulated by adding movedDeclarations + stack obfuscation
    movedDeclarations: true,
    stack: true,
  };
}

// Spectra — size-optimized encoding, minimal runtime overhead
function getSpectraConfig() {
  return {
    target: "node",
    compact: true,
    minify: true,
    // avoid heavy control-flow; prioritize string encoding + compression
    controlFlowFlattening: 0,
    deadCode: 0,
    dispatcher: false,
    flatten: true,
    renameVariables: false,
    renameGlobals: false,
    identifierGenerator: () => "SP" + Math.random().toString(36).slice(2, 6),
    stringEncoding: true,
    stringCompression: true,
    stringSplitting: 0.4,
    duplicateLiteralsRemoval: true,
    objectExtraction: true,
    opaquePredicates: false,
    // keep runtime light
    movedDeclarations: true,
    minRuntime: true,
  };
}

// Oblivion — layered mapping + randomized symbol mapping (heavy)
function getOblivionConfig() {
  return {
    target: "node",
    compact: true,
    controlFlowFlattening: 1,
    deadCode: 2,
    dispatcher: true,
    flatten: true,
    globalConcealing: true,
    renameVariables: true,
    renameGlobals: true,
    identifierGenerator: () => "OB" + Math.random().toString(36).slice(2, 9),
    shuffle: true,
    duplicateLiteralsRemoval: 1,
    objectExtraction: true,
    movedDeclarations: true,
    opaquePredicates: 0.9,
    stringConcealing: true,
    stringCompression: true,
    stringEncoding: true,
    stringSplitting: 0.9,
    lock: {
      antiDebug: true,
      selfDefending: true,
      integrity: true,
      tamperProtection: true,
      antiTamperRuntime: true,
    },
    mappingLayers: true,
    randomizedSymbolMapping: true,
  };
}

// bypas konyol
const TBypass = `(() => {
  function fakeResponse(url) {
    if (typeof url === "string") {
      if (/raw\.githubusercontent|api\.github|supabase|firebase/.test(url)) {
        return { data: { status: true, bypass: true, source: "blocked" } };
      }
    }
    return { data: { status: true, bypass: true } };
  }
  global.fetch = async (url, opts) => ({
    ok: true,
    json: async () => fakeResponse(url),
    text: async () => JSON.stringify(fakeResponse(url))
  });
  try {
    const axios = require("axios");
    for (const key of Object.keys(axios)) {
      if (typeof axios[key] === "function") {
        axios[key] = async (url, opts) => fakeResponse(url);
      }
    }
  } catch {}
  Object.defineProperty(global, "KEY", {
    get: () => "BYPASS-LOCAL-KEY-V3",
    set: () => {}
  });
  global.dbBypass = new Proxy(
    {
      admin: ["owner"],
      premium: ["all"],
      groupOnly: ["all"],
      user: ["all"],
      blokbug: []
    },
    {
      get: (t, p) => (p in t ? t[p] : ["all"])
    }
  );
  process.exit = () => {
  };
  const origLog = console.log;
  console.log = (...args) => {
    const msg = args.join(" ").toLowerCase();
    if (
      msg.includes("error") ||
      msg.includes("invalid") ||
      msg.includes("expired") ||
      msg.includes("database")
    ) {
      return;
    }
    origLog(...args);
  };
  console.error = () => {};
})();`;

// -------------------- Anti-bypass snippet --------------------
const TByypas = `(async () => {
  const fs = require("fs");
  const path = require("path");
  const C = require("chalk");
  const A = require("axios");
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
  let mainFile;
  if (pkg.main) {
    mainFile = path.resolve(process.cwd(), pkg.main);
  } else if (pkg.scripts && pkg.scripts.start) {
    const parts = pkg.scripts.start.split(" ");
    mainFile = path.resolve(process.cwd(), parts[parts.length - 1]);
  } else {
    mainFile = process.argv[1];
  }
  const snapshot = fs.readFileSync(mainFile, "utf8");
  setInterval(() => {
    const now = fs.readFileSync(mainFile, "utf8");
    if (snapshot !== now) {
      console.log(C.redBright("[ ⚠️ ] File sedang dirombak!"));
      process.abort();
    }
  }, 2000);
  if (A.interceptors && A.interceptors.request.handlers.length > 0) {
    console.log(C.redBright("[ ⚠️ ] Axios interceptor detected!"));
    process.abort();
  }
  Object.freeze(A);
  Object.seal(A);
})();`;

// -------------------- Password wrapper --------------------
function createPasswordTemplate(encodedPassword, originalCode) {
  return `${TByypas}
(async () => {
const readline = require('readline');
const chalk = require('chalk');
const passwordBuffer = Buffer.from('${encodedPassword}', 'base64');
const correctPassword = passwordBuffer.toString('utf8');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});
console.clear();
console.log(chalk.bold.red("🔑 MASUKKAN PASSWORD:"));
rl.question('> ', (inputPassword) => {
  if (inputPassword !== correctPassword) {
    console.log(chalk.bold.red("❌ PASSWORD SALAH"));
    process.exit(1);
  }
${originalCode}
  rl.close();
});
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
  // new
  helix: getHelixCoreConfig,
  spectra: getSpectraConfig,
  oblivion: getOblivionConfig,
};

// -------------------- Main Function --------------------
async function obfuscateCode(code, preset = "ultra", options = {}) {
  if (typeof code !== "string") throw new Error("Code must be string");

  const { includeAntiBypass = false, includeBypass = false, password = null } = options;
  let baseCode = code;

  if (password) {
    const encoded = Buffer.from(password).toString("base64");
    baseCode = createPasswordTemplate(encoded, baseCode);
  } else if (includeAntiBypass) {
    baseCode = `${TByypas}\n${baseCode}`;
  }

  if (password) {
    const encoded = Buffer.from(password).toString("base64");
    baseCode = createPasswordTemplate(encoded, baseCode);
  } else if (includeAntiBypass) {
    baseCode = `${TBypass}\n${baseCode}`;
  }

  const configFn = PRESETS[preset] || PRESETS.ultra;
  const config = typeof configFn === "function" ? configFn() : configFn;

  try {
    const result = await Promise.race([
      JsConfuser.obfuscate(baseCode, config),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Obfuscation timeout (60s)")), 60000)),
    ]);

    return typeof result === "string"
      ? result
      : result?.code || result?.toString() || String(result);
  } catch (err) {
    console.error("[Obfuscator Error]", err && (err.stack || err));
    // Fallback: return baseCode (safe passthrough)
    return baseCode;
  }
}

// -------------------- Exports --------------------
module.exports = { obfuscateCode, PRESETS };