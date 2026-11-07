const test = require("node:test");
const assert = require("node:assert/strict");

const load = () => import("../tools/sync/pgenv.mjs");

test("maps a URI to libpq env vars with decoded credentials", async () => {
  const { pgEnv } = await load();
  const env = pgEnv("postgresql://sync_purger.abc:p%40ss%2Fw%3Ard@db.example.com:6543/postgres?sslmode=verify-full");
  assert.deepEqual(env, {
    PGHOST: "db.example.com",
    PGPORT: "6543",
    PGUSER: "sync_purger.abc",
    PGPASSWORD: "p@ss/w:rd",
    PGDATABASE: "postgres",
    PGSSLMODE: "verify-full",
    PGCONNECT_TIMEOUT: "10",
  });
});

test("defaults the port to 5432 and sslmode to require", async () => {
  const { pgEnv } = await load();
  const env = pgEnv("postgres://u:pw@h.example.com/mydb");
  assert.equal(env.PGPORT, "5432");
  assert.equal(env.PGSSLMODE, "require");
  assert.equal(env.PGDATABASE, "mydb");
});

test("never leaves the URI in PGDATABASE", async () => {
  const { pgEnv } = await load();
  assert.ok(!pgEnv("postgres://u:pw@h/db").PGDATABASE.includes("://"));
});
