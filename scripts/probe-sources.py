"""Bounded public-source access experiment for P00, not a production sync.

Records transport and structural evidence. Does not normalize/import identities,
assert licensing, bypass blocks, or turn reachability into screening coverage.
"""
import csv
import hashlib
import io
import json
from pathlib import Path
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
import xml.etree.ElementTree as ET

SOURCES = [
    ("UN", "https://scsanctions.un.org/resources/xml/en/consolidated.xml", "xml"),
    ("UK", "https://sanctionslist.fcdo.gov.uk/docs/UK-Sanctions-List.csv", "csv"),
    ("OFAC", "https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.XML", "xml"),
    ("UAE", "https://www.uaeiec.gov.ae/", "landing"),
]
LIMIT = 64 * 1024 * 1024

def probe(spec):
    code, url, fmt = spec
    result = {"code": code, "url": url, "checkedAt": datetime.now(timezone.utc).isoformat(),
              "status": "unavailable", "format": fmt, "screeningReady": False}
    try:
        req = Request(url, headers={"User-Agent": "MizanDevelopmentSourceCheck/0.1", "Accept": "*/*"})
        with urlopen(req, timeout=25) as response:
            payload = response.read(LIMIT + 1)
            result.update(httpStatus=response.status, finalUrl=response.url.split("?")[0],
                          contentType=response.headers.get("Content-Type"), bytes=len(payload))
        if len(payload) > LIMIT:
            raise ValueError("response_exceeds_probe_limit")
        if not payload:
            raise ValueError("empty_response")
        result["sha256"] = hashlib.sha256(payload).hexdigest()
        if fmt == "xml":
            if b"<!DOCTYPE" in payload.upper():
                raise ValueError("doctype_not_allowed")
            root = ET.fromstring(payload)
            expected = "CONSOLIDATED_LIST" if code == "UN" else "sdnList"
            local_tag = root.tag.split("}")[-1]
            result["rootTag"] = local_tag
            if local_tag != expected:
                raise ValueError("unexpected_xml_schema")
            record_tags = {"INDIVIDUAL", "ENTITY"} if code == "UN" else {"sdnEntry"}
            result["recordCount"] = sum(1 for el in root.iter() if el.tag.split("}")[-1] in record_tags)
            result["sourceDate"] = root.attrib.get("dateGenerated")
            if not result["recordCount"]:
                raise ValueError("no_records")
            result["status"] = "structure_verified"
        elif fmt == "csv":
            rows = csv.reader(io.StringIO(payload.decode("utf-8-sig")))
            header = None
            for _ in range(8):
                row = next(rows, [])
                if "Unique ID" in row:
                    header = row
                    break
            if not header:
                raise ValueError("expected_csv_header_missing")
            result["columns"] = len(header)
            identifiers = set()
            row_count = 0
            id_index = header.index("Unique ID")
            for row in rows:
                if any(row):
                    row_count += 1
                    if len(row) > id_index and row[id_index].strip():
                        identifiers.add(row[id_index].strip())
            result["rowCount"] = row_count
            result["recordCount"] = len(identifiers)
            result["status"] = "structure_verified" if result["recordCount"] else "unavailable"
        else:
            result["status"] = "landing_only"
            result["note"] = "A current machine-readable download still needs verification."
    except HTTPError as exc:
        result.update(httpStatus=exc.code, error=f"http_{exc.code}")
    except (URLError, TimeoutError, ValueError, ET.ParseError, UnicodeDecodeError) as exc:
        result["error"] = str(exc)[:240]
    except Exception as exc:
        result["error"] = type(exc).__name__
    return result

if __name__ == "__main__":
    out = Path("docs/evidence")
    out.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=4) as executor:
        results = list(executor.map(probe, SOURCES))
    report = {"purpose": "P00 access and format experiment only", "sources": results}
    (out / "source-access.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    for item in results:
        print(item["code"], item["status"], item.get("httpStatus", ""), item.get("recordCount", ""), item.get("error", ""))
