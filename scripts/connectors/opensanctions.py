"""OpenSanctions connector: aggregated public sources for evaluation (sanctions, PEP, watchlists).

Two responsibilities, both non-destructive:

  catalog   Fetch the OpenSanctions dataset index and write a source registry
            (.local/sources/_catalog.json) — the full array of available public
            lists with each list's upstream version and last_change. Diffs against
            the previous snapshot so we know *which* lists changed, cheaply, without
            downloading any list contents.

  <code...> For each dataset code, download its targets.simple.csv snapshot and
            parse it into the record shape import-sources.ts expects, at
            .local/sources/<CODE>/parsed.json. Preserves the raw snapshot by sha.

Registration and download are not licensing. OpenSanctions data is public and
mostly open-licensed, but commercial screening use should be reviewed against the
per-dataset license carried in the catalog before it drives a real screening verdict.
"""
import csv, io, json, hashlib, sys
from pathlib import Path
from datetime import datetime, timezone
from urllib.request import Request, urlopen

INDEX_URL = "https://data.opensanctions.org/datasets/latest/index.json"
ROOT = Path(".local/sources")
LIMIT = 256 * 1024 * 1024
UA = {"User-Agent": "MizanSourceSync/0.3", "Accept": "*/*"}

# OpenSanctions FollowTheMoney schema -> our coarse record kind.
KIND = {
    "Person": "individual",
    "Company": "company", "Organization": "company", "LegalEntity": "company",
    "PublicBody": "company", "Airplane": "aircraft", "Vessel": "vessel",
}


def fetch(url, limit=LIMIT):
    with urlopen(Request(url, headers=UA), timeout=90) as r:
        payload = r.read(limit + 1)
    if len(payload) > limit:
        raise ValueError("source_exceeds_limit")
    if not payload:
        raise ValueError("empty_response")
    return payload


# Risk category derived from OpenSanctions collection membership, highest severity first.
CATEGORY_BY_COLLECTION = [
    ("sanctions", "sanctions"), ("us_sanctions", "sanctions"),
    ("debarment", "debarment"), ("crime", "crime"),
    ("regulatory", "regulatory"), ("peps", "pep"),
]
def category_of(collections):
    cols = set(collections or [])
    for name, cat in CATEGORY_BY_COLLECTION:
        if name in cols:
            return cat
    return "other"


def build_catalog():
    """Write the source registry array and a change report vs the last snapshot."""
    ROOT.mkdir(parents=True, exist_ok=True)
    index = json.loads(fetch(INDEX_URL, limit=64 * 1024 * 1024).decode("utf-8"))
    rows = []
    for d in index.get("datasets", []):
        pub = d.get("publisher") or {}
        csv_url = next((r["url"] for r in d.get("resources", [])
                        if r.get("name") == "targets.simple.csv"), None)
        rows.append({
            "code": d["name"],
            "title": d.get("title") or d["name"],
            "type": d.get("type"),                       # source | collection | external
            "category": category_of(d.get("collections")),
            "collections": d.get("collections") or [],
            "country": pub.get("country"),
            "publisher": pub.get("name"),
            "official": bool(pub.get("official")),
            "license": d.get("license"),
            "entityCount": d.get("entity_count"),
            "version": d.get("version"),                 # changes iff the list changed
            "lastChange": d.get("last_change"),
            "lastExport": d.get("last_export"),
            "csvUrl": csv_url,
            "nestedResource": next((r for r in d.get("resources", []) if r.get("name") == "targets.nested.json"), None),
            "officialUrl": d.get("url"),
        })
    rows.sort(key=lambda r: r["code"])
    catalog = {
        "retrievedAt": datetime.now(timezone.utc).isoformat(),
        "indexRunTime": index.get("run_time"),
        "total": len(rows),
        "sources": rows,
    }

    prev_path = ROOT / "_catalog.json"
    prev = {}
    if prev_path.exists():
        for r in json.loads(prev_path.read_text()).get("sources", []):
            prev[r["code"]] = r.get("version")

    changed, added = [], []
    for r in rows:
        if r["code"] not in prev:
            added.append(r["code"])
        elif prev[r["code"]] != r["version"]:
            changed.append({"code": r["code"], "title": r["title"],
                            "from": prev[r["code"]], "to": r["version"],
                            "lastChange": r["lastChange"]})
    removed = [c for c in prev if c not in {r["code"] for r in rows}]

    report = {"checkedAt": catalog["retrievedAt"], "totalLists": len(rows),
              "newLists": added, "updatedLists": changed, "removedLists": removed}
    (ROOT / "_changes.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))

    tmp = ROOT / "_catalog.tmp"
    tmp.write_text(json.dumps(catalog, ensure_ascii=False))
    tmp.replace(prev_path)

    print(f"catalog: {len(rows)} lists | new {len(added)} | "
          f"updated {len(changed)} | removed {len(removed)}")
    for c in changed[:40]:
        print(f"  ~ {c['code']:<28} {c['from']} -> {c['to']}")
    if len(changed) > 40:
        print(f"  ... and {len(changed) - 40} more (see .local/sources/_changes.json)")
    return catalog


def dataset_meta(code):
    cat = json.loads((ROOT / "_catalog.json").read_text())
    for r in cat["sources"]:
        if r["code"] == code:
            return r
    raise SystemExit(f"unknown dataset '{code}' — run `catalog` first")


PARSER_VERSION = "os-rich-1.0"


def parse_nested(payload, meta):
    """Keep entity properties and relationship direction; related names aren't aliases."""
    records, seen = [], set()
    for line in payload.decode("utf-8-sig").splitlines():
        if not line.strip():
            continue
        item = json.loads(line)
        key, name, props = item.get("id"), item.get("caption"), item.get("properties")
        if not isinstance(key, str) or not isinstance(name, str) or not name.strip() or not isinstance(props, dict):
            raise ValueError("unexpected_nested_entity_schema")
        if key in seen:
            raise ValueError("duplicate_source_id")
        seen.add(key)
        aliases = []
        for field in ("name", "alias", "weakAlias", "previousName"):
            for alias in props.get(field, []):
                if isinstance(alias, str) and alias.strip() and alias != name:
                    aliases.append(alias)
        details = dict(props)
        details["_provenance"] = {
            "provider": "OpenSanctions", "officialUrl": meta.get("officialUrl"),
            "publisher": meta.get("publisher"), "datasets": item.get("datasets", []),
            "firstSeen": item.get("first_seen"), "lastSeen": item.get("last_seen"),
            "lastChange": item.get("last_change"), "schema": item.get("schema"),
            "referents": item.get("referents", []), "upstreamVersion": meta.get("version"),
        }
        records.append({"id": key, "name": name, "aliases": list(dict.fromkeys(aliases)),
                        "kind": KIND.get(item.get("schema"), "other"), "details": details})
    if not records:
        raise ValueError("empty_source")
    return records


def parse_simple(payload, meta):
    """Fallback for datasets whose rich targets.nested.json is missing or empty: parse the flat
    targets.simple.csv. Loses per-record topics/positions where the CSV omits them, but keeps the
    entity searchable (its risk category still comes from the catalog collection)."""
    split = lambda v: [x.strip() for x in (v or "").split(";") if x.strip()]
    records, seen = [], set()
    reader = csv.DictReader(io.StringIO(payload.decode("utf-8-sig")))
    for row in reader:
        key = (row.get("id") or "").strip()
        name = (row.get("name") or "").strip()
        if not key or not name or key in seen:
            continue
        seen.add(key)
        aliases = [a for a in split(row.get("aliases")) if a != name]
        details = {"name": [name]}
        if aliases: details["alias"] = aliases
        for col, field in (("countries", "country"), ("birth_date", "birthDate"),
                           ("identifiers", "identification"), ("sanctions", "sanctions"),
                           ("addresses", "address"), ("topics", "topics")):
            vals = split(row.get(col))
            if vals: details[field] = vals
        details["_provenance"] = {
            "provider": "OpenSanctions", "officialUrl": meta.get("officialUrl"),
            "publisher": meta.get("publisher"), "datasets": split(row.get("dataset")),
            "firstSeen": row.get("first_seen"), "lastSeen": row.get("last_seen"),
            "lastChange": row.get("last_change") or meta.get("lastChange"),
            "schema": row.get("schema"), "upstreamVersion": meta.get("version"),
        }
        records.append({"id": key, "name": name, "aliases": list(dict.fromkeys(aliases)),
                        "kind": KIND.get(row.get("schema"), "other"), "details": details})
    if not records:
        raise ValueError("empty_source")
    return records


def sync_dataset(code):
    meta = dataset_meta(code)
    resource = meta.get("nestedResource")
    # Prefer the rich nested snapshot; fall back to the flat simple.csv when nested is absent or empty.
    use_simple = not resource or not resource.get("size")
    if use_simple:
        url = meta.get("csvUrl")
        if not url:
            raise ValueError(f"{code}: no supported snapshot (no nested.json or simple.csv)")
    else:
        url = resource["url"]
        if resource.get("size", 0) > LIMIT:
            raise ValueError("source_exceeds_limit")
    if not url.startswith("https://data.opensanctions.org/"):
        raise ValueError("unexpected_resource_host")
    payload = fetch(url)
    if not use_simple:
        checksum = resource.get("checksum")
        if checksum and len(checksum) == 40 and hashlib.sha1(payload).hexdigest() != checksum:
            raise ValueError("source_checksum_mismatch")
    sha = hashlib.sha256(payload).hexdigest()
    out = ROOT / code
    out.mkdir(parents=True, exist_ok=True)
    raw = out / f"{sha}.ndjson"
    if not raw.exists():
        raw.write_bytes(payload)
    records = parse_simple(payload, meta) if use_simple else parse_nested(payload, meta)
    result = {"code": code, "url": url, "sha256": sha,
        "retrievedAt": datetime.now(timezone.utc).isoformat(), "parserVersion": PARSER_VERSION,
        "upstreamVersion": meta.get("version"), "upstreamLastChange": meta.get("lastChange"),
        "records": records}
    tmp = out / "parsed.tmp"
    tmp.write_text(json.dumps(result, ensure_ascii=False))
    tmp.replace(out / "parsed.json")
    print(f"{code}: {len(records)} rich records parsed", flush=True)
    return code, len(records)


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args or args[0] == "catalog":
        build_catalog()
        for code in args[1:]:
            sync_dataset(code)
    else:
        for code in args:
            sync_dataset(code)
