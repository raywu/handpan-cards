// Acquisition probe (import v2, Phase 1, section C). Evidence, not product.
// Fetches every gold-set URL the way a serverless worker would: one plain GET,
// a desktop browser UA, no JS, redirects followed. Records status, final URL,
// bytes, challenge/bot-block signals, CORS, Shopify .json, JSON-LD Product,
// robots.txt stance, and whether every expected pitch token appears in the
// no-JS text. Raw bodies go to CACHE (outside the repo); only the record is
// written to OUT.
//
//   node docs/plans/import-v2-eval/probe.mjs <gold.json> <cacheDir> <out.json>
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { htmlToText } from "./text.mjs";

const [goldPath, cacheDir, outPath] = process.argv.slice(2);
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
const ORIGIN = "https://handpan.raywu.org";
const MAX = 3_000_000;
fs.mkdirSync(cacheDir, { recursive: true });
const gold = JSON.parse(fs.readFileSync(goldPath, "utf8"));

async function get(url, extra = {}) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
      headers: { "user-agent": UA, accept: "text/html,application/json;q=0.9,*/*;q=0.8",
                 "accept-language": "en-US,en;q=0.9", origin: ORIGIN, ...extra },
    });
    const buf = Buffer.from(await r.arrayBuffer());
    return { status: r.status, finalUrl: r.url, bytes: buf.length, ms: Date.now() - t0,
             headers: Object.fromEntries(r.headers), body: buf.subarray(0, MAX).toString("utf8") };
  } catch (e) {
    return { status: 0, error: String(e.cause?.code || e.name || e), ms: Date.now() - t0 };
  }
}

function challenge(res) {
  const h = res.headers || {};
  const b = (res.body || "").slice(0, 20000);
  if (h["cf-mitigated"]) return "cf-mitigated:" + h["cf-mitigated"];
  if (/Just a moment\.\.\.|cf-chl-|challenge-platform/i.test(b)) return "cloudflare-challenge";
  if (/captcha|px-captcha|perimeterx|datadome|Access Denied/i.test(b) && res.bytes < 60000) return "bot-wall";
  if (res.status === 403 || res.status === 429 || res.status === 503) return "status-" + res.status;
  return null;
}

function robotsAllows(txt, pathname) {
  if (!txt) return null;
  const lines = txt.split(/\r?\n/).map((l) => l.replace(/#.*/, "").trim());
  let applies = false, rules = [], inStar = false;
  for (const l of lines) {
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(l);
    if (!m) continue;
    const k = m[1].toLowerCase(), v = m[2];
    if (k === "user-agent") { inStar = v === "*"; if (inStar) applies = true; }
    else if (inStar && (k === "disallow" || k === "allow") && v) rules.push([k, v]);
  }
  if (!applies) return true;
  let best = null;
  for (const [k, v] of rules) {
    const re = new RegExp("^" + v.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$"));
    if (re.test(pathname) && (!best || v.length > best[1].length)) best = [k, v];
  }
  return !best || best[0] === "allow";
}

function jsonLdProduct(html) {
  const out = [];
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (/"@type"\s*:\s*"Product"/.test(m[1])) out.push(m[1]);
  }
  return out;
}

const tokensOf = (seed) => seed.replace(/[()[\]|]/g, " ").split(/\s+/).filter(Boolean);

const robotsCache = new Map();
const records = [];
for (const c of gold.cases) {
  const rec = { id: c.id, url: c.url };
  const res = await get(c.url);
  rec.status = res.status; rec.finalUrl = res.finalUrl; rec.bytes = res.bytes; rec.ms = res.ms;
  if (res.error) rec.error = res.error;
  rec.challenge = res.status ? challenge(res) : "network-error";
  rec.cors = res.headers?.["access-control-allow-origin"] || null;
  const html = res.body || "";
  const file = path.join(cacheDir, c.id + ".html");
  fs.writeFileSync(file, html);
  const text = htmlToText(html);
  fs.writeFileSync(path.join(cacheDir, c.id + ".txt"), text);
  rec.textSha256 = crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);
  rec.textChars = text.length;
  rec.shopify = /cdn\.shopify\.com|Shopify\.shop/.test(html);
  rec.jsonLdProduct = jsonLdProduct(html).length;
  rec.jsonLdHasPitch = jsonLdProduct(html).some((j) => /\b[A-G][#b]?[1-6]\b/.test(j));
  if (rec.shopify) {
    const u = new URL(res.finalUrl || c.url);
    const m = /\/products\/([^/?#]+)/.exec(u.pathname);
    if (m) {
      const j = await get(u.origin + "/products/" + m[1] + ".json", { accept: "application/json" });
      rec.shopifyJson = { status: j.status, cors: j.headers?.["access-control-allow-origin"] || null, bytes: j.bytes };
      if (j.status === 200) {
        try {
          const p = JSON.parse(j.body).product;
          const t = htmlToText((p.title || "") + "\n" + (p.body_html || ""));
          fs.writeFileSync(path.join(cacheDir, c.id + ".shopify.txt"), t);
          rec.shopifyJson.textChars = t.length;
        } catch { rec.shopifyJson.parse = false; }
      }
    }
  }
  const origin = new URL(res.finalUrl || c.url).origin;
  if (!robotsCache.has(origin)) {
    const r = await get(origin + "/robots.txt", { accept: "text/plain" });
    robotsCache.set(origin, r.status === 200 && !/<html/i.test(r.body) ? r.body : null);
  }
  rec.robotsAllows = robotsAllows(robotsCache.get(origin), new URL(res.finalUrl || c.url).pathname);
  if (c.expected.textSeed) {
    const want = tokensOf(c.expected.textSeed);
    const norm = text.replace(/♯/g, "#").replace(/♭/g, "b");
    rec.pitchesInNoJsText = want.every((t) => norm.includes(t.replace(/\d$/, "")));
    rec.spanInNoJsText = c.span ? norm.replace(/\s+/g, " ").includes(c.span.replace(/♯/g, "#").replace(/♭/g, "b").replace(/\s+/g, " ").slice(0, 40)) : null;
  }
  records.push(rec);
  process.stderr.write(`${c.id} ${rec.status} ${rec.challenge || ""} span=${rec.spanInNoJsText}\n`);
}
fs.writeFileSync(outPath, JSON.stringify({ probedAt: new Date().toISOString(), ua: UA, records }, null, 1) + "\n");
