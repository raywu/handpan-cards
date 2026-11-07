#!/usr/bin/env node
// Smoke test for tools/sync/schema.sql against a DEV Supabase project (owner-run; CI never runs this).
// Env (nothing is committed; no tokens or emails are printed):
//   SUPABASE_URL, SUPABASE_ANON_KEY
//   SMOKE_A_JWT, SMOKE_B_JWT, SMOKE_C_JWT      access tokens of three test users (C is used for cap cases)
//     or SMOKE_x_EMAIL + SMOKE_x_PASSWORD for x in A, B, C (password grant)
//   SMOKE_D_EMAIL, SMOKE_D_PASSWORD            disposable user for delete_my_account (signed up if missing)
//   SMOKE_ADMIN_DB_URL                         optional postgres connection string (psql) to backdate rows
//   SMOKE_PURGER_DB_URL                        optional connection string for role sync_purger (psql)
// Cases needing an optional variable are reported as SKIP, never as PASS.
// Connection strings reach psql only through the PGDATABASE environment variable (never argv), and every
// message printed here is redacted of those strings and of any user:password@ part.
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const URL_ = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const ANON = process.env.SUPABASE_ANON_KEY || "";
if (!URL_ || !ANON) {
  console.error("SUPABASE_URL and SUPABASE_ANON_KEY are required");
  process.exit(2);
}

const secrets = [process.env.SMOKE_ADMIN_DB_URL, process.env.SMOKE_PURGER_DB_URL, ANON].filter(Boolean);
const redact = (text) => {
  let out = String(text);
  for (const s of secrets) out = out.split(s).join("[redacted]");
  return out.replace(/:\/\/[^\s@/]*@/g, "://[redacted]@");
};
process.on("uncaughtException", (e) => {
  console.error(redact(e && e.message ? e.message : e).slice(0, 300));
  process.exit(1);
});

const results = { pass: 0, fail: 0, skip: 0 };
const log = (status, name, note = "") => {
  results[status.toLowerCase()]++;
  console.log(`${status} ${name}${note ? " (" + note + ")" : ""}`);
};
const check = async (name, fn) => {
  try {
    await fn();
    log("PASS", name);
  } catch (e) {
    log("FAIL", name, redact(e.message || e).slice(0, 160));
  }
};
const skip = (name, why) => log("SKIP", name, why);
const ok = (cond, msg) => {
  if (!cond) throw new Error(msg);
};
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg}: got ${JSON.stringify(a)}`);

const api = async (path, { method = "GET", jwt = ANON, body } = {}) => {
  const res = await fetch(URL_ + path, {
    method,
    headers: { apikey: ANON, Authorization: `Bearer ${jwt}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json };
};

const token = async (letter) => {
  const jwt = process.env[`SMOKE_${letter}_JWT`];
  if (jwt) return jwt;
  const email = process.env[`SMOKE_${letter}_EMAIL`];
  const password = process.env[`SMOKE_${letter}_PASSWORD`];
  if (!email || !password) return null;
  const r = await api("/auth/v1/token?grant_type=password", { method: "POST", body: { email, password } });
  return r.json && r.json.access_token ? r.json.access_token : null;
};
const subOf = (jwt) => JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString()).sub;

const psql = (url, sql) => {
  const r = spawnSync("psql", ["-v", "ON_ERROR_STOP=1", "-At", "-c", sql], {
    encoding: "utf8",
    env: { ...process.env, PGDATABASE: url },
  });
  if (r.error || r.status !== 0) {
    throw new Error(`psql failed (exit ${r.status}): ${redact(r.error ? r.error.message : r.stderr).trim().slice(0, 120)}`);
  }
  return r.stdout.trim();
};

const push = (jwt, rows) => api("/rest/v1/rpc/push_scales", { method: "POST", jwt, body: { rows } });
const row = (id, base, record = { n: 1 }, deleted = false) => ({ scale_id: id, base_rev: base, record, deleted });
const PAGE = 1000;
const pull = async (jwt, cursor = 0) => {
  const all = [];
  for (let at = cursor; ; ) {
    const r = await api(`/rest/v1/saved_scales?select=scale_id,rev,record,deleted&rev=gt.${at}&order=rev&limit=${PAGE}`, { jwt });
    ok(r.status === 200, `pull status ${r.status}`);
    all.push(...r.json);
    if (r.json.length < PAGE) return all;
    at = r.json[r.json.length - 1].rev;
  }
};
const one = async (jwt, rows) => {
  const r = await push(jwt, rows);
  ok(r.status === 200, `push status ${r.status}`);
  return r.json;
};
const maxRev = async (jwt) => (await pull(jwt)).reduce((m, x) => Math.max(m, x.rev), 0);
const bulk = (n, mk) => Array.from({ length: n }, (_, i) => mk(i));
const chunks = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

const A = await token("A");
const B = await token("B");
const C = await token("C");
if (!A || !B) {
  console.error("SMOKE_A and SMOKE_B credentials are required");
  process.exit(2);
}
const admin = process.env.SMOKE_ADMIN_DB_URL;
const purger = process.env.SMOKE_PURGER_DB_URL;
const cleanUser = (uid) =>
  psql(admin, `delete from scale_history where user_id='${uid}'; delete from saved_scales where user_id='${uid}'; update sync_users set last_rev=0 where user_id='${uid}'`);
if (admin) cleanUser(subOf(A));

await check("A writes and reads its own row", async () => {
  const id = randomUUID();
  const r = await one(A, [row(id, null)]);
  ok(typeof r[0].rev === "number", "no rev");
  ok((await pull(A)).some((x) => x.scale_id === id), "row not read back");
});

await check("B cannot read A's rows", async () => {
  const id = randomUUID();
  await one(A, [row(id, null)]);
  ok(!(await pull(B)).some((x) => x.scale_id === id), "B saw A's row");
});

await check("B cannot write A's row (push is keyed to the caller)", async () => {
  const id = randomUUID();
  const [a] = await one(A, [row(id, null, { who: "A" })]);
  const rb = await one(B, [row(id, a.rev, { who: "B" })]);
  ok(rb[0].conflict === true, "B's push on A's id was not a conflict");
  eq((await pull(A)).find((x) => x.scale_id === id).record, { who: "A" }, "A's body changed");
});

await check("direct POST/PATCH/DELETE on saved_scales with a user JWT is refused", async () => {
  const id = randomUUID();
  const post = await api("/rest/v1/saved_scales", { method: "POST", jwt: A, body: { scale_id: id, rev: 1, record: {} } });
  ok([401, 403].includes(post.status), `POST ${post.status}`);
  const patch = await api("/rest/v1/saved_scales?deleted=eq.false", { method: "PATCH", jwt: A, body: { record: {} } });
  ok([401, 403].includes(patch.status), `PATCH ${patch.status}`);
  const del = await api("/rest/v1/saved_scales?deleted=eq.false", { method: "DELETE", jwt: A });
  ok([401, 403].includes(del.status), `DELETE ${del.status}`);
});

await check("anon cannot call any RPC", async () => {
  for (const [fn, body] of [["push_scales", { rows: [] }], ["delete_my_account", {}], ["purge_tombstones", {}]]) {
    const r = await api(`/rest/v1/rpc/${fn}`, { method: "POST", jwt: ANON, body });
    ok(r.status >= 400, `${fn} anon ${r.status}`);
  }
});

await check("authenticated cannot call purge_tombstones", async () => {
  const r = await api("/rest/v1/rpc/purge_tombstones", { method: "POST", jwt: A, body: {} });
  ok(r.status >= 400, `status ${r.status}`);
});

await check("CAS: stale base_rev returns conflict", async () => {
  const id = randomUUID();
  const [a] = await one(A, [row(id, null)]);
  const [b] = await one(A, [row(id, a.rev, { n: 2 })]);
  ok(b.rev > a.rev, "edit did not advance rev");
  const [c] = await one(A, [row(id, a.rev, { n: 3 })]);
  ok(c.conflict === true, "stale push was accepted");
});

await check("two concurrent pushes: gap-free revs and a pull from the pre-push cursor returns every row", async () => {
  for (let round = 0; round < 20; round++) {
    const before = await maxRev(A);
    const mk = () => bulk(3, () => row(randomUUID(), null));
    const [r1, r2] = await Promise.all([one(A, mk()), one(A, mk())]);
    const revs = [...r1, ...r2].map((x) => x.rev).sort((x, y) => x - y);
    eq(revs, bulk(6, (i) => before + 1 + i), `round ${round} revs`);
    const pulled = await pull(A, before);
    eq(pulled.map((x) => x.rev), revs, `round ${round} pull`);
  }
});

await check("tombstone keeps the row and its body", async () => {
  const id = randomUUID();
  const [a] = await one(A, [row(id, null, { keep: "me" })]);
  const [t] = await one(A, [{ scale_id: id, base_rev: a.rev, record: null, deleted: true }]);
  ok(t.rev > a.rev, "tombstone no rev");
  const got = (await pull(A)).find((x) => x.scale_id === id);
  ok(got && got.deleted === true, "row missing or not deleted");
  eq(got.record, { keep: "me" }, "body lost");
});

await check("base_rev null revives a tombstone (new rev, same id) and conflicts on a live row", async () => {
  const id = randomUUID();
  const [a] = await one(A, [row(id, null, { v: 1 })]);
  const [t] = await one(A, [{ scale_id: id, base_rev: a.rev, record: null, deleted: true }]);
  const [rv] = await one(A, [row(id, null, { v: 2 })]);
  ok(rv.rev > t.rev && rv.scale_id === id, "revive failed");
  const [again] = await one(A, [row(id, null, { v: 3 })]);
  ok(again.conflict === true, "null base on live row was accepted");
});

if (!admin) skip("two overwrites then restore the original from scale_history", "needs SMOKE_ADMIN_DB_URL to read scale_history");
else await check("two overwrites then restore the original from scale_history", async () => {
  const id = randomUUID();
  const [a] = await one(A, [row(id, null, { v: "original" })]);
  const [b] = await one(A, [row(id, a.rev, { v: "junk1" })]);
  await one(A, [row(id, b.rev, { v: "junk2" })]);
  const hist = JSON.parse(psql(admin, `select coalesce(json_agg(record order by id),'[]') from scale_history where scale_id='${id}'`));
  eq(hist, [{ v: "original" }, { v: "junk1" }], "history");
  const u = subOf(A);
  psql(admin, `begin;
    update public.sync_users set last_rev = last_rev + 1 where user_id='${u}';
    update public.saved_scales set record = (select record from public.scale_history where user_id='${u}' and scale_id='${id}' order by id asc limit 1),
           rev = (select last_rev from public.sync_users where user_id='${u}'), deleted = false, deleted_at = null, updated_at = now()
     where user_id='${u}' and scale_id='${id}';
    commit;`);
  const restored = (await pull(A)).find((x) => x.scale_id === id);
  eq(restored.record, { v: "original" }, "restored body");
  ok(restored.rev > b.rev, "restore did not take a fresh rev");
});

await check("anon-key call refusal (RPC) is repeated with a junk bearer", async () => {
  const r = await api("/rest/v1/rpc/push_scales", { method: "POST", jwt: "not-a-jwt", body: { rows: [] } });
  ok(r.status >= 400, `status ${r.status}`);
});

await check("201-row call refused", async () => {
  const r = await push(A, bulk(201, () => row(randomUUID(), null)));
  ok(r.status >= 400, `status ${r.status}`);
});

await check("tombstone for an unknown id is refused and not inserted", async () => {
  const id = randomUUID();
  const [r] = await one(A, [{ scale_id: id, base_rev: null, record: null, deleted: true }]);
  eq(r.refused, "unknown", "result");
  ok(!(await pull(A)).some((x) => x.scale_id === id), "row inserted");
});

await check("record over 8192 bytes is refused", async () => {
  const [r] = await one(A, [row(randomUUID(), null, { blob: "x".repeat(9000) })]);
  eq(r.refused, "size", "result");
});

if (!C) {
  for (const n of ["501st live row refused; 500 tombstones + 1 live accepted", "5001st total row refused", "2001st history row refused with rate, history unchanged"]) skip(n, "no user C");
} else {
  const uidC = subOf(C);
  const clean = admin ? () => cleanUser(uidC) : null;
  let cOk = true;
  if (clean) clean();
  else if ((await pull(C)).length) { cOk = false; for (const n of ["live cap", "total cap", "history cap"]) skip(n, "user C not empty and no SMOKE_ADMIN_DB_URL"); }
  if (cOk) {
    let live = [];
    await check("501st live row refused with cap; 500 tombstones + 1 live accepted", async () => {
      const ids = bulk(500, () => randomUUID());
      for (const c of chunks(ids, 200)) await one(C, c.map((id) => row(id, null)));
      const [over] = await one(C, [row(randomUUID(), null)]);
      eq(over.refused, "cap", "501st");
      const state = await pull(C);
      const tombs = state.filter((x) => !x.deleted).map((x) => ({ scale_id: x.scale_id, base_rev: x.rev, record: null, deleted: true }));
      for (const c of chunks(tombs, 200)) await one(C, c);
      const [fresh] = await one(C, [row(randomUUID(), null)]);
      ok(typeof fresh.rev === "number", "live push after 500 tombstones was refused");
    });
    await check("5001st total row refused with cap", async () => {
      let total = (await pull(C)).length;
      while (total < 5000) {
        const state = await pull(C);
        const liveRows = state.filter((x) => !x.deleted);
        const tombs = liveRows.map((x) => ({ scale_id: x.scale_id, base_rev: x.rev, record: null, deleted: true }));
        for (const c of chunks(tombs, 200)) await one(C, c);
        const want = Math.min(500, 5000 - total);
        for (const c of chunks(bulk(want, () => randomUUID()), 200)) {
          const res = await one(C, c.map((id) => row(id, null)));
          ok(res.every((x) => typeof x.rev === "number"), "refused before 5000");
        }
        total += want;
      }
      eq((await pull(C)).length, 5000, "total rows");
      const [r] = await one(C, [row(randomUUID(), null)]);
      eq(r.refused, "cap", "5001st");
      live = (await pull(C)).filter((x) => !x.deleted);
    });
    if (!admin) skip("2001st history row refused with rate, history unchanged", "needs SMOKE_ADMIN_DB_URL to count scale_history");
    else await check("2001st history row refused with rate, history unchanged", async () => {
      psql(admin, `delete from scale_history where user_id='${uidC}'`);
      const cur = live.slice(0, 200).map((x) => ({ scale_id: x.scale_id, base_rev: x.rev }));
      for (let round = 0; round < 10; round++) {
        const res = await one(C, cur.map((c) => ({ ...c, record: { round }, deleted: false })));
        res.forEach((x, i) => { ok(typeof x.rev === "number", "refused early"); cur[i].base_rev = x.rev; });
      }
      eq(Number(psql(admin, `select count(*) from scale_history where user_id='${uidC}'`)), 2000, "history rows");
      const [r] = await one(C, [{ ...cur[0], record: { round: "x" }, deleted: false }]);
      eq(r.refused, "rate", "2001st");
      eq(Number(psql(admin, `select count(*) from scale_history where user_id='${uidC}'`)), 2000, "history after refusal");
    });
    if (clean) clean();
  }
}

if (!admin || !purger) {
  skip("purge_tombstones as sync_purger clears >30-day bodies and history only", "needs SMOKE_ADMIN_DB_URL and SMOKE_PURGER_DB_URL");
} else {
  await check("purge_tombstones as sync_purger clears >30-day bodies and history only", async () => {
    const mk = async (tag) => {
      const id = randomUUID();
      const [a] = await one(A, [row(id, null, { tag, v: 1 })]);
      const [b] = await one(A, [row(id, a.rev, { tag, v: 2 })]);
      await one(A, [{ scale_id: id, base_rev: b.rev, record: null, deleted: true }]);
      return id;
    };
    const oldId = await mk("old");
    const newId = await mk("new");
    psql(admin, `update saved_scales set deleted_at=now()-interval '31 days' where scale_id='${oldId}'; update scale_history set replaced_at=now()-interval '31 days' where scale_id='${oldId}'`);
    psql(purger, "select public.purge_tombstones()");
    const body = (id) => psql(admin, `select coalesce(record::text,'null') from saved_scales where scale_id='${id}'`);
    const hist = (id) => Number(psql(admin, `select count(*) from scale_history where scale_id='${id}'`));
    eq(body(oldId), "null", "old body");
    eq(hist(oldId), 0, "old history");
    ok(body(newId) !== "null", "new body purged");
    eq(hist(newId), 1, "new history");
    eq(Number(psql(admin, `select count(*) from saved_scales where scale_id='${oldId}'`)), 1, "row kept");
  });
}

const dEmail = process.env.SMOKE_D_EMAIL;
const dPassword = process.env.SMOKE_D_PASSWORD;
if (!dEmail || !dPassword) skip("delete_my_account removes the auth user and rows", "needs SMOKE_D_EMAIL and SMOKE_D_PASSWORD");
else await check("delete_my_account removes the auth user and rows", async () => {
  const email = dEmail;
  const password = dPassword;
  let t = await api("/auth/v1/token?grant_type=password", { method: "POST", body: { email, password } });
  if (!t.json?.access_token) t = await api("/auth/v1/signup", { method: "POST", body: { email, password } });
  const jwt = t.json?.access_token;
  ok(jwt, `could not obtain a session (${t.status})`);
  await one(jwt, [row(randomUUID(), null)]);
  const del = await api("/rest/v1/rpc/delete_my_account", { method: "POST", jwt, body: {} });
  ok(del.status < 300, `delete status ${del.status}`);
  const again = await api("/auth/v1/token?grant_type=password", { method: "POST", body: { email, password } });
  ok(again.status >= 400, "user can still sign in");
  if (admin) eq(Number(psql(admin, `select count(*) from saved_scales where user_id='${subOf(jwt)}'`)), 0, "rows remain");
});

console.log(`pass=${results.pass} fail=${results.fail} skip=${results.skip}`);
process.exit(results.fail ? 1 : 0);
