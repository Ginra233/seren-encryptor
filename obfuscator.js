// obfuscator.js
// Presets + helper untuk js-confuser obfuscation.
// Exports: obfuscateCode(code, preset='ultra', options)
// options: { includeAntiBypass: boolean, password: string|null }

const JsConfuser = require("js-confuser");

// -------------------- Preset configs --------------------
function getUltraSafeConfig() {
  return {
    target: "node",
    calculator: true,
    compact: true,
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
    rgf: false
  };
}

function getNebulaObfuscationConfig() {
  const generateNebulaName = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const prefix = "NX";
    let randomPart = "";
    for (let i = 0; i < 4; i++) {
      randomPart += chars[Math.floor(Math.random() * chars.length)];
    }
    return `${prefix}${randomPart}`;
  };

  return {
    target: "node",
    compact: true,
    renameVariables: true,
    renameGlobals: true,
    identifierGenerator: generateNebulaName,
    stringCompression: true,
    stringConcealing: false,
    stringEncoding: true,
    stringSplitting: false,
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
  const generateNovaName = () => {
    return "var_" + Math.random().toString(36).substring(7);
  };
  return {
    target: "node",
    calculator: false,
    compact: true,
    controlFlowFlattening: 1,
    deadCode: 1,
    dispatcher: true,
    duplicateLiteralsRemoval: 1,
    flatten: true,
    globalConcealing: true,
    hexadecimalNumbers: 1,
    identifierGenerator: generateNovaName,
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
  const arabicChars = [
    "أ","ب","ت","ث","ج","ح","خ","د","ذ","ر","ز","س","ش","ص","ض","ط","ظ",
    "ع","غ","ف","ق","ك","ل","م","ن","ه","و","ي",
  ];

  const generateArabicName = () => {
    const length = Math.floor(Math.random() * 4) + 3;
    let name = "";
    for (let i = 0; i < length; i++) {
      name += arabicChars[Math.floor(Math.random() * arabicChars.length)];
    }
    return name;
  };

  return {
    target: "node",
    compact: true,
    renameVariables: true,
    renameGlobals: true,
    identifierGenerator: () => generateArabicName(),
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

function getJapanxArabObfuscationConfig() {
  const japaneseXArabChars = [
    "あ","い","う","え","お","か","き","く","け","こ","さ","し","す","せ","そ",
    "た","ち","つ","て","と","な","に","ぬ","ね","の","は","ひ","ふ","へ","ほ",
    "ま","み","む","め","も","や","ゆ","よ","أ","ب","ت","ث","ج","ح","خ","د","ذ",
    "ر","ز","س","ش","ص","ض","ط","ظ","ع","غ","ف","ق","ك","ل","م","ن","ه","و","ي",
    "ら","り","る","れ","ろ","わ","を","ん",
  ];
  const generateJapaneseXArabName = () => {
    const length = Math.floor(Math.random() * 4) + 3;
    let name = "";
    for (let i = 0; i < length; i++) {
      name += japaneseXArabChars[Math.floor(Math.random() * japaneseXArabChars.length)];
    }
    return name;
  };
  return {
    target: "node",
    compact: true,
    renameVariables: true,
    renameGlobals: true,
    identifierGenerator: () => generateJapaneseXArabName(),
    stringCompression: true,
    stringConcealing: true,
    stringEncoding: true,
    stringSplitting: true,
    controlFlowFlattening: 1,
    flatten: true,
    shuffle: true,
    rgf: false,
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

function getJapanObfuscationConfig() {
  const japaneseChars = [
    "あ","い","う","え","お","か","き","く","け","こ","さ","し","す","せ","そ",
    "た","ち","つ","て","と","な","に","ぬ","ね","の","は","ひ","ふ","へ","ほ",
    "ま","み","む","め","も","や","ゆ","よ","ら","り","る","れ","ろ","わ","を","ん",
  ];
  const generateJapaneseName = () => {
    const length = Math.floor(Math.random() * 4) + 3;
    let name = "";
    for (let i = 0; i < length; i++) {
      name += japaneseChars[Math.floor(Math.random() * japaneseChars.length)];
    }
    return name;
  };

  return {
    target: "node",
    compact: true,
    renameVariables: true,
    renameGlobals: true,
    identifierGenerator: () => generateJapaneseName(),
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

// -------------------- Anti-bypass snippet (TByypas) --------------------
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

// -------------------- Password wrapper template --------------------
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

// -------------------- Preset map --------------------
const PRESETS = {
  ultra: getUltraSafeConfig,
  nebula: getNebulaObfuscationConfig,
  nova: getNovaObfuscationConfig,
  arab: getArabObfuscationConfig,
  japan: getJapanObfuscationConfig,
  "japanxarab": getJapanxArabObfuscationConfig
};

// -------------------- Main obfuscation function --------------------
/**
 * obfuscateCode(code, preset='ultra', options)
 * options: { includeAntiBypass: boolean, password: string|null }
 */
async function obfuscateCode(code, preset = "ultra", options = {}) {
  if (typeof code !== "string") throw new Error("code must be a string");
  const { includeAntiBypass = false, password = null } = options;

  let baseCode = code;

  // If password requested, wrap original code in password template first
  if (password && typeof password === "string" && password.length > 0) {
    const encodedPassword = Buffer.from(password).toString("base64");
    baseCode = createPasswordTemplate(encodedPassword, baseCode);
  } else if (includeAntiBypass) {
    // if only anti-bypass requested (no password), prefix the TByypas snippet
    baseCode = `${TByypas}\n${baseCode}`;
  }

  const cfgFactory = PRESETS[preset] || PRESETS["ultra"];
  const cfg = (typeof cfgFactory === "function") ? cfgFactory() : cfgFactory;

  const result = await JsConfuser.obfuscate(baseCode, cfg);

  if (typeof result === "string") return result;
  if (result && typeof result.code === "string") return result.code;
  if (result && typeof result.toString === "function") return result.toString();
  return String(result);
}

// -------------------- Exports --------------------
module.exports = {
  obfuscateCode,
  PRESETS,
  createPasswordTemplate,
  getUltraSafeConfig,
  getNebulaObfuscationConfig,
  getNovaObfuscationConfig,
  getArabObfuscationConfig,
  getJapanxArabObfuscationConfig,
  getJapanObfuscationConfig,
};
