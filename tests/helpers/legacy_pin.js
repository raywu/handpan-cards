const nodeTest = require("node:test");

const LEGACY_SHEET = /["'`#\[]scale-(?:sheet|tabs?|panel|ding|top|inner|bottom|box|parse|refusal|preview|drawer|mode|mirror|fine|swatches|layout|next|generate|delete|name|back|msg|neotone|seat|angle|note|conflict|anchor|field|fields|guidance|foot|footclip|footslide|title|palette|standard|del|label|line|lip|or|plate|swipe|bottom-label)|\bopenSheet\b|\bsheetOpen\b|["'`]deck-add["'`]|\bopen(?:Scale|Edit)Sheet\b|\.type\(|\.activeHit\(/;

const NEVER = new Set(["boot", "plain", "coarse", "assert"]);
const state = { legacy: false };
const pinned = [];

function legacyHelpers(source) {
  const lines = source.split("\n");
  const chunks = new Map();
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*)(?:(?:async\s+)?function\s+(\w+)|(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|\w+)\s*=>)/.exec(lines[i]);
    if (!m) continue;
    const name = m[2] || m[3];
    let body = lines[i] + "\n";
    for (let j = i + 1; j < lines.length; j++) {
      const indent = /^(\s*)/.exec(lines[j])[1].length;
      if (lines[j].trim() !== "" && indent <= m[1].length && !/^\s*[})\]]/.test(lines[j])) break;
      body += lines[j] + "\n";
    }
    chunks.set(name, (chunks.get(name) || "") + body);
  }
  for (const [n, body] of chunks) if (n.length < 3 || NEVER.has(n)) chunks.delete(n);
  const legacy = new Set();
  for (let grew = true; grew;) {
    grew = false;
    for (const [n, body] of chunks) {
      if (legacy.has(n)) continue;
      if (LEGACY_SHEET.test(body) || [...legacy].some((h) => new RegExp("(?<![.\\w])" + h + "\\(").test(body))) { legacy.add(n); grew = true; }
    }
  }
  return legacy;
}

function classifierFor(file, byName, kept) {
  const helpers = legacyHelpers(require("node:fs").readFileSync(file, "utf8"));
  const re = helpers.size ? new RegExp("(?<![.\\w])(?:" + [...helpers].join("|") + ")\\(") : null;
  return (fn, name) => !kept.has(name) && (byName.some((n) => name.startsWith(n)) || LEGACY_SHEET.test(String(fn)) || (re !== null && re.test(String(fn))));
}

function wrapFn(name, fn, isLegacy) {
  if (typeof fn !== "function" || !isLegacy(fn, name)) return fn;
  pinned.push(name);
  return function (...args) {
    const keep = state.legacy;
    state.legacy = true;
    let r;
    try { r = fn.apply(this, args); } catch (e) { state.legacy = keep; throw e; }
    if (r && typeof r.then === "function") return r.finally(() => { state.legacy = keep; });
    state.legacy = keep;
    return r;
  };
}

function wrapRegistrar(register, isLegacy) {
  const wrapped = (name, ...rest) => {
    const i = rest.findIndex((x) => typeof x === "function");
    if (i >= 0) rest[i] = wrapFn(String(name), rest[i], isLegacy);
    return register(name, ...rest);
  };
  for (const k of ["skip", "todo", "only"]) if (register[k]) wrapped[k] = (name, ...rest) => {
    const i = rest.findIndex((x) => typeof x === "function");
    if (i >= 0) rest[i] = wrapFn(String(name), rest[i], isLegacy);
    return register[k](name, ...rest);
  };
  return wrapped;
}

const legacyNow = () => state.legacy;
const onePanelFor = () => (state.legacy ? false : undefined);

function forFile(file, byName = [], kept = []) {
  const isLegacy = classifierFor(file, byName, new Set(kept));
  return { test: wrapRegistrar(nodeTest.test, isLegacy), onePanelFor, legacyNow, pinned };
}

module.exports = { legacyHelpers, forFile, onePanelFor, legacyNow, pinned, LEGACY_SHEET };

if (process.env.LEGACY_PIN_REPORT) process.on("exit", () => process.stderr.write("LEGACY_PINNED " + pinned.length + "\n" + pinned.join("\n") + "\n"));
