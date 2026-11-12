import os
import re
import subprocess
import unittest

from tests.paths import ROOT

SCHEMA = os.path.join(ROOT, "tools", "sync", "schema.sql")
TABLES = ("saved_scales", "sync_users", "scale_history")
FUNCTIONS = ("push_scales", "delete_my_account", "purge_tombstones")


def sql():
    with open(SCHEMA, encoding="utf-8") as f:
        text = f.read()
    text = re.sub(r"--[^\n]*", "", text)
    return re.sub(r"\s+", " ", text).lower()


class SyncSchemaLintTest(unittest.TestCase):
    def test_every_table_enables_row_level_security(self):
        text = sql()
        for table in TABLES:
            self.assertRegex(
                text, r"alter table (if exists )?(public\.)?%s enable row level security" % table, table
            )

    def test_no_client_write_policy(self):
        text = sql()
        for kind in ("insert", "update", "delete", "all"):
            self.assertNotRegex(text, r"create policy [^;]*? for %s\b" % kind, kind)
        for policy in re.findall(r"create policy [^;]*;", text):
            self.assertIn(" for select ", policy)
            self.assertIn("to authenticated", policy)

    def test_clients_get_select_only_grants(self):
        text = sql()
        self.assertNotRegex(
            text, r"grant [^;]*\b(insert|update|delete|all)\b[^;]* on [^;]*\b(saved_scales|sync_users|scale_history)\b[^;]* to [^;]*\b(authenticated|anon|public)\b"
        )
        self.assertRegex(text, r"revoke all on (table )?(public\.)?saved_scales[^;]* from [^;]*anon")

    def test_each_function_revokes_public_and_anon_then_grants(self):
        text = sql()
        for fn in FUNCTIONS:
            self.assertRegex(
                text, r"revoke execute on function (public\.)?%s\([^)]*\) from public, anon" % fn, fn
            )
            self.assertRegex(text, r"grant execute on function (public\.)?%s\([^)]*\) to " % fn, fn)

    def test_purge_is_granted_to_sync_purger_only(self):
        text = sql()
        self.assertRegex(text, r"create role sync_purger")
        self.assertRegex(text, r"grant execute on function (public\.)?purge_tombstones\(\) to sync_purger")
        self.assertNotRegex(text, r"grant execute on function (public\.)?purge_tombstones\(\) to [^;]*authenticated")
        self.assertRegex(text, r"revoke execute on function (public\.)?purge_tombstones\(\) from [^;]*authenticated")

    def test_user_functions_are_authenticated_only_definers(self):
        text = sql()
        for fn in ("push_scales", "delete_my_account"):
            self.assertRegex(text, r"grant execute on function (public\.)?%s\([^)]*\) to authenticated" % fn, fn)
            body = re.search(r"create or replace function (public\.)?%s\(.*?\$\$ ?;" % fn, text)
            self.assertIsNotNone(body, fn)
            body = body.group(0)
            self.assertIn("security definer", body)
            self.assertIn("set search_path = public, pg_temp", body)
            self.assertIn("if auth.uid() is null then raise exception 'not authenticated'", body)

    def test_purge_does_not_require_a_user(self):
        body = re.search(r"create or replace function (public\.)?purge_tombstones\(.*?\$\$ ?;", sql())
        self.assertIsNotNone(body)
        self.assertNotIn("auth.uid()", body.group(0))
        self.assertIn("security definer", body.group(0))

    def test_caps_are_enforced(self):
        text = sql()
        for needle in ("8192", "500", "5000", "200", "2000", "'cap'", "'rate'", "'unknown'"):
            self.assertIn(needle, text, needle)

    def test_no_secret_in_the_files(self):
        for name in ("schema.sql", "smoke.mjs"):
            with open(os.path.join(ROOT, "tools", "sync", name), encoding="utf-8") as f:
                body = f.read().lower()
            self.assertNotRegex(body, r"eyj[a-z0-9_-]{20,}", name)
            self.assertNotIn("sb_secret_", body, name)

    def test_invalid_scale_id_is_refused_per_row_not_aborted(self):
        body = re.search(r"create or replace function (public\.)?push_scales\(.*?\$\$ ?;", sql()).group(0)
        guard = body.index("'invalid'")
        self.assertRegex(body[:guard], r"scale_id', ''\) !~\* '\^\[0-9a-f\]\{8\}")
        self.assertLess(body.index("~*"), body.index("::uuid"))
        self.assertIn("continue", body)

    def test_restore_recipe_states_the_timestamp_format(self):
        with open(SCHEMA, encoding="utf-8") as f:
            text = f.read()
        self.assertRegex(text, r":t is a timestamptz literal[^\n]*UTC")

    def test_smoke_redacts_tokens_and_emails_everywhere(self):
        script = (
            "import {redact} from './tools/sync/redact.mjs';"
            "const jwt='eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcDEF123_-xyz';"
            "const out=redact('tok '+jwt+' mail a.b+c@example.co.uk end');"
            "if(out.includes('eyJ')||out.includes('@example'))throw new Error(out);"
        )
        r = subprocess.run(["node", "--input-type=module", "-e", script], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)
        with open(os.path.join(ROOT, "tools", "sync", "smoke.mjs"), encoding="utf-8") as f:
            smoke = f.read()
        self.assertIn('from "./redact.mjs"', smoke)
        self.assertRegex(smoke, r"const log = [^\n]*\n[^\n]*\n[^\n]*console\.log\(redact\(`\$\{status\}")

    def test_redact_hides_the_whole_connection_credential(self):
        script = (
            "import {redact} from './tools/sync/redact.mjs';"
            "const out=redact('x postgres://postgres.ref:p%40ss!word@db.x:5432/postgres y');"
            "if(out.includes('ss!word')||out.includes('p%40')||!out.includes('://[redacted]@db.x'))throw new Error(out);"
        )
        r = subprocess.run(["node", "--input-type=module", "-e", script], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)

    def test_restore_recipe_says_how_to_choose_t(self):
        with open(SCHEMA, encoding="utf-8") as f:
            text = f.read()
        self.assertRegex(text, r"(?s):t[^\n]*\n.*just after the bad push.*older version")


if __name__ == "__main__":
    unittest.main()
