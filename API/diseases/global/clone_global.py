"""Download selected disease.sh "global" endpoints and store JSON responses.

Notes
-----
In the disease.sh Swagger UI, sections like "COVID-19: Worldometers" and
"COVID-19: JHUCSSE" are *API groups / endpoints* (data sources), not HTTP
headers you send. This script keeps the "pick a source" workflow you want by
letting you select a group via a constant.

Usage
-----
Run with Python (no arguments):
    python API/diseases/global/clone_global.py

Edit ACTIVE_GROUP below to choose what to download.
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


# =========================
# Constants you can edit
# =========================
BASE_URL = "https://disease.sh"

# Choose one of: worldometers, jhucsse, nyt, vaccine, gov, apple, therapeutics
ACTIVE_GROUP = "worldometers"

# Where to store downloaded JSON. (Requested: another folder `/data`)
DATA_ROOT = Path("data") / "diseases" / "global"

# Basic headers for polite HTTP requests. (Not the "Worldometers/JHUCSSE" selection.)
HTTP_HEADERS: dict[str, str] = {
    "accept": "application/json",
    "user-agent": "codexp-signal/1.0 (data clone script)",
}

# Timeouts in seconds
REQUEST_TIMEOUT_S = 60


# =========================
# Endpoints (no path args)
# =========================
# Keep these to endpoints that require no path parameters.
# You can add/remove URLs as you like.
ENDPOINT_GROUPS: dict[str, list[str]] = {
    # COVID-19: Worldometers
    "worldometers": [
        "/v3/covid-19/all?allowNull=true",
        "/v3/covid-19/continents?yesterday=false&twoDaysAgo=false&allowNull=true",
        "/v3/covid-19/countries?yesterday=false&twoDaysAgo=false&allowNull=true",
    ],
    # COVID-19: JHUCSSE
    "jhucsse": [
        "/v3/covid-19/jhucsse",
        "/v3/covid-19/historical/all?lastdays=all",
        "/v3/covid-19/historical?lastdays=all",
    ],
    # COVID-19: NYT (US time series)
    "nyt": [
        "/v3/covid-19/nyt/usa",
        "/v3/covid-19/nyt/states",
        "/v3/covid-19/nyt/counties",
    ],
    # COVID-19: Vaccine
    "vaccine": [
        "/v3/covid-19/vaccine",
        "/v3/covid-19/vaccine/coverage?lastdays=all&fullData=false",
        "/v3/covid-19/vaccine/coverage/countries?lastdays=all&fullData=false",
        "/v3/covid-19/vaccine/coverage/states?lastdays=all&fullData=false",
    ],
    # COVID-19: Government (list supported countries)
    "gov": [
        "/v3/covid-19/gov/",
    ],
    # COVID-19: Apple mobility
    "apple": [
        "/v3/covid-19/apple/countries",
    ],
    # COVID-19: Therapeutics
    "therapeutics": [
        "/v3/covid-19/therapeutics",
    ],
}


@dataclass(frozen=True)
class DownloadResult:
    url: str
    output_file: Path
    ok: bool
    status: int | None
    error: str | None


def _safe_filename_from_endpoint(endpoint: str) -> str:
    # Convert something like "/v3/covid-19/all?allowNull=true" into a stable filename.
    name = endpoint.strip("/")
    name = name.replace("/", "__")
    name = name.replace("?", "__")
    name = name.replace("&", "_")
    name = name.replace("=", "-")
    name = re.sub(r"[^a-zA-Z0-9_.-]+", "_", name)
    name = re.sub(r"_+", "_", name).strip("_")
    if not name:
        name = "root"
    return f"{name}.json"


def _http_get_json(url: str, headers: dict[str, str], timeout_s: int) -> Any:
    req = Request(url, headers=headers, method="GET")
    with urlopen(req, timeout=timeout_s) as resp:
        raw = resp.read()
        encoding = resp.headers.get_content_charset() or "utf-8"
    text = raw.decode(encoding, errors="replace")
    return json.loads(text)


def download_group(group: str) -> list[DownloadResult]:
    if group not in ENDPOINT_GROUPS:
        available = ", ".join(sorted(ENDPOINT_GROUPS.keys()))
        raise SystemExit(f"Unknown ACTIVE_GROUP={group!r}. Available: {available}")

    endpoints = ENDPOINT_GROUPS[group]
    out_dir = DATA_ROOT / group
    out_dir.mkdir(parents=True, exist_ok=True)

    results: list[DownloadResult] = []

    fetched_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%SZ")

    for endpoint in endpoints:
        url = f"{BASE_URL}{endpoint}"
        filename = _safe_filename_from_endpoint(endpoint)
        # include a timestamp so repeated runs don't overwrite unless you want them to
        output_file = out_dir / f"{fetched_at}__{filename}"

        try:
            data = _http_get_json(url, headers=HTTP_HEADERS, timeout_s=REQUEST_TIMEOUT_S)
            with output_file.open("w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
                f.write("\n")

            results.append(
                DownloadResult(
                    url=url,
                    output_file=output_file,
                    ok=True,
                    status=200,
                    error=None,
                )
            )
        except HTTPError as e:
            results.append(
                DownloadResult(
                    url=url,
                    output_file=output_file,
                    ok=False,
                    status=getattr(e, "code", None),
                    error=f"HTTPError: {e}",
                )
            )
        except URLError as e:
            results.append(
                DownloadResult(
                    url=url,
                    output_file=output_file,
                    ok=False,
                    status=None,
                    error=f"URLError: {e}",
                )
            )
        except json.JSONDecodeError as e:
            results.append(
                DownloadResult(
                    url=url,
                    output_file=output_file,
                    ok=False,
                    status=None,
                    error=f"JSONDecodeError: {e}",
                )
            )

    return results


def main() -> None:
    # Ensure the repo-relative data dir works even if launched elsewhere.
    # If you run from repo root (recommended), this is a no-op.
    try:
        script_dir = Path(__file__).resolve().parent
        repo_root_guess = script_dir.parents[2]  # API/diseases/global -> repo root
        os.chdir(repo_root_guess)
    except Exception:
        pass

    results = download_group(ACTIVE_GROUP)

    ok = [r for r in results if r.ok]
    bad = [r for r in results if not r.ok]

    print(f"ACTIVE_GROUP: {ACTIVE_GROUP}")
    print(f"Saved to: {DATA_ROOT / ACTIVE_GROUP}")
    print(f"Downloaded: {len(ok)}/{len(results)}")

    for r in ok:
        print(f"  OK  {r.url} -> {r.output_file.as_posix()}")
    for r in bad:
        print(f"  ERR {r.url} ({r.status}) {r.error}")

    if bad:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
