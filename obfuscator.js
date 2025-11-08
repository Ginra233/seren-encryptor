// obfuscator.cleaned.js
// Seren Encryptor Obfuscator Engine — PRESETS + bypass/anti-bypass/password
// Cleaned: removed runtime preamble that injected __SEREN_RUNTIME_BYPASS / __SEREN_PASSWORD_ACTIVE

const JsConfuser = require("js-confuser");

// -------------------- Preset Configs --------------------
const getStrongObfuscationConfig = () => {
  return {
    target: "node",
    calculator: true,
    compact: true,
    hexadecimalNumbers: true,
    controlFlowFlattening: 0.75,
    deadCode: 0.2,
    dispatcher: true,
    duplicateLiteralsRemoval: 0.75,
    flatten: true,
    globalConcealing: true,
    identifierGenerator: "zeroWidth",
    minify: true,
    movedDeclarations: true,
    objectExtraction: true,
    opaquePredicates: 0.75,
    renameVariables: true,
    renameGlobals: true,
    stringConcealing: true,
    stringCompression: true,
    stringEncoding: true,
    stringSplitting: 0.75,
    rgf: false,
  };
};

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
    movedDeclarations: true,
    stack: true,
  };
}

function getSpectraConfig() {
  return {
    target: "node",
    compact: true,
    minify: true,
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
    movedDeclarations: true,
    minRuntime: true,
  };
}

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

// -------------------- Bypass / Anti-bypass / Password snippets --------------------

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

// -------------------- PRESETS --------------------
const PRESETS = {
  ultra: getUltraSafeConfig,
  nebula: getNebulaObfuscationConfig,
  nova: getNovaObfuscationConfig,
  arab: getArabObfuscationConfig,
  japan: getJapanObfuscationConfig,
  japanxarab: getJapanxArabObfuscationConfig,
  strong: getStrongObfuscationConfig,
  helix: getHelixCoreConfig,
  spectra: getSpectraConfig,
  oblivion: getOblivionConfig,
};

// -------------------- Main Function --------------------
async function obfuscateCode(code, preset = "strong", options = {}) {
  if (typeof code !== "string") throw new Error("Code must be string");

  const { includeAntiBypass = false, includeBypass = false, password = null } = options;
  let baseCode = code;

  // If a password is provided, wrap the original code with the password UI template.
  if (password) {
    const encoded = Buffer.from(password).toString("base64");
    baseCode = createPasswordTemplate(encoded, baseCode);
  } else {
    // No password: optionally prepend anti-bypass or bypass wrappers.
    if (includeAntiBypass) {
      baseCode = `${TByypas}\n${baseCode}`;
    }
    if (includeBypass) {
      baseCode = `${TBypass}\n${baseCode}`;
    }
  }

  const configFn = PRESETS[preset] || PRESETS.strong;
  const config = typeof configFn === "function" ? configFn() : configFn;

  try {
    // allow caller to suggest timeout (ms); fallback to 120s if not provided
    const internalTimeoutMs = (options && typeof options.timeoutMs === "number") ? options.timeoutMs : 120000;

    // run obfuscation but respect internalTimeoutMs to avoid indefinite blocking
    const rawResult = await Promise.race([
      JsConfuser.obfuscate(baseCode, config),
      new Promise((_, reject) => setTimeout(() => reject(new Error(`Obfuscation timeout (${internalTimeoutMs}ms)`)), internalTimeoutMs)),
    ]);

    // normalize result string
    const resultString = typeof rawResult === "string"
      ? rawResult
      : (rawResult && (rawResult.code || rawResult.toString())) || String(rawResult);

    // NOTE: intentionally NO preamble injected here (we removed the runtime IIFE)
    return resultString;
  } catch (err) {
    console.error("[Obfuscator Error]", err && (err.stack || err));
    // Fallback: return baseCode (passthrough) so the server can still provide a download.
    return baseCode;
  }
}

// -------------------- Exports --------------------
module.exports = {
  obfuscateCode,
  PRESETS,
  TBypass,
  TByypas,
  createPasswordTemplate
};