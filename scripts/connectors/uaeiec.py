"""UAE EOCN Local Terrorism List — primary-source evidence connector.

The Executive Office for Control & Non-proliferation (المكتب التنفيذي للرقابة وحظر
الانتشار) publishes the UAE Local Terrorist List as a PDF on uaeiec.gov.ae. The
download uses an opaque, rotating FileID, so we discover the current link by
matching the anchor whose visible text is exactly "قائمة الإرهاب المحلية" in the
server-rendered page HTML, then record the file's sha256, the regulator's own
filename (which carries the list date, e.g. "LS 130923 2026.pdf") and the fetch
time as auditable evidence that the official source was checked.

This is a PRIMARY-SOURCE POINTER, not a parser: the list is a PDF, so structured,
searchable records still come from the OpenSanctions `ae_local_terrorists` dataset,
which parses this same PDF. A change in sha256 or filename here means EOCN
republished and the structured feed should be re-synced and re-reviewed.
"""
import re, json, hashlib
from pathlib import Path
from datetime import datetime, timezone
from urllib.request import Request, urlopen

BASE = "https://www.uaeiec.gov.ae"
PAGE = BASE + "/ar-ae/un-page?p=1"          # قائمة الإرهاب الوطنية / المحلية
LABEL = "قائمة الإرهاب المحلية"
DOWNLOAD = BASE + "/API/Upload/DownloadFile?FileID={}"
OUT = Path(".local/sources/UAE_EOCN")
UA = {"User-Agent": "Mozilla/5.0 (compatible; MizanSourceSync/0.3)", "Accept": "*/*"}
# The exact-text anchor for the current consolidated list (history entries excluded).
ANCHOR = re.compile(
    r'<a\b[^>]*?href="[^"]*?DownloadFile\?FileID=([0-9a-f-]{36})"[^>]*>([\s\S]*?)</a>',
    re.I)


def fetch(url, limit=64 * 1024 * 1024):
    with urlopen(Request(url, headers=UA), timeout=45) as r:
        payload = r.read(limit + 1)
        disp = r.headers.get("Content-Disposition", "")
        ctype = r.headers.get("Content-Type", "")
    if len(payload) > limit:
        raise ValueError("source_exceeds_limit")
    if not payload:
        raise ValueError("empty_response")
    return payload, ctype, disp


def find_file_id(html):
    for fid, raw in ANCHOR.findall(html):
        text = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", raw)).strip()
        if text == LABEL:                    # exact match = the current list, not a resolution
            return fid
    raise ValueError("local_terrorism_list_link_not_found")


def run():
    OUT.mkdir(parents=True, exist_ok=True)
    html, _, _ = fetch(PAGE)
    file_id = find_file_id(html.decode("utf-8", "replace"))
    payload, ctype, disp = fetch(DOWNLOAD.format(file_id))
    if "pdf" not in ctype.lower() and not payload[:5] == b"%PDF-":
        raise ValueError(f"unexpected_content_type: {ctype}")
    filename = re.search(r'filename="?([^"]+)"?', disp)
    filename = filename.group(1).strip() if filename else f"{file_id}.pdf"
    sha = hashlib.sha256(payload).hexdigest()
    (OUT / f"{sha}.pdf").write_bytes(payload)

    prev = {}
    ev_path = OUT / "evidence.json"
    if ev_path.exists():
        prev = json.loads(ev_path.read_text())
    changed = prev.get("sha256") != sha

    evidence = {
        "code": "UAE_EOCN",
        "source": "EOCN — UAE Local Terrorism List (primary source)",
        "pageUrl": PAGE,
        "fileId": file_id,
        "downloadUrl": DOWNLOAD.format(file_id),
        "filename": filename,
        "contentType": ctype,
        "bytes": len(payload),
        "sha256": sha,
        "retrievedAt": datetime.now(timezone.utc).isoformat(),
        "previousSha256": prev.get("sha256"),
        "changedSinceLastCheck": changed,
        "note": "PDF primary source; structured records via OpenSanctions ae_local_terrorists.",
    }
    tmp = OUT / "evidence.tmp"
    tmp.write_text(json.dumps(evidence, ensure_ascii=False, indent=1))
    tmp.replace(ev_path)
    print(f"UAE_EOCN: {filename} | {len(payload)} bytes | sha {sha[:16]} | "
          f"{'CHANGED' if changed else 'unchanged'}")
    return evidence


if __name__ == "__main__":
    run()
