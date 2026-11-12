#!/usr/bin/env python3
"""IndexNow payload for the sitemap URLs. Prints by default; --send is owner-run."""
import argparse
import json
import os
import sys
import urllib.request
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HOST = "handpantheory.com"
ENDPOINT = "https://api.indexnow.org/indexnow"
KEY_FILE = os.path.join(ROOT, "indexnow-key.txt")
NS = "{http://www.sitemaps.org/schemas/sitemap/0.9}"
PLACEHOLDER = "KEY-FILE-ABSENT"


def sitemap_locs(path):
    return [e.text.strip() for e in ET.parse(path).getroot().iter(NS + "loc")]


def read_key(path):
    if not os.path.isfile(path):
        return None
    with open(path, encoding="utf-8") as f:
        return f.read().strip() or None


def build_payload(host, key, locs):
    return {"host": host, "key": key or PLACEHOLDER,
            "keyLocation": "https://%s/indexnow-key.txt" % host, "urlList": locs}


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--send", action="store_true", help="POST the payload (default: print it)")
    ap.add_argument("--host", default=HOST)
    ap.add_argument("--sitemap", default=os.path.join(ROOT, "sitemap.xml"))
    ap.add_argument("--key-file", default=KEY_FILE)
    args = ap.parse_args(argv)
    if args.host != HOST:
        print("indexnow: only %s is allowed, got %s" % (HOST, args.host), file=sys.stderr)
        return 2
    key = read_key(args.key_file)
    payload = build_payload(args.host, key, sitemap_locs(args.sitemap))
    if not args.send:
        if key is None:
            print("indexnow: no key file, payload carries a placeholder", file=sys.stderr)
        print(json.dumps(payload, indent=2))
        return 0
    if key is None:
        print("indexnow: --send needs the key file %s" % args.key_file, file=sys.stderr)
        return 3
    req = urllib.request.Request(ENDPOINT, json.dumps(payload).encode(),
                                 {"Content-Type": "application/json; charset=utf-8"})
    with urllib.request.urlopen(req, timeout=10) as r:
        print(r.status)
    return 0


if __name__ == "__main__":
    sys.exit(main())
