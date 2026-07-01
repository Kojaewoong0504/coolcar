#!/usr/bin/env python3
"""Fetch Seoul getFstExit data and generate verified FINAL_EXIT door guides.

Requires SEOUL_OPENAPI_KEY or SEOUL_OPEN_API_KEY in the environment. The generated
fixture is safe to commit because it contains public door/facility data, not secrets.
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = ROOT / "data" / "door-guidance" / "verified-final-exit-guides.json"
BASE_URL = os.getenv("SEOUL_OPENAPI_BASE_URL", "http://openapi.seoul.go.kr:8088").rstrip("/")
PAGE_SIZE = 1000

LINE_ALIASES = {
    "1": "1호선",
    "2": "2호선",
    "3": "3호선",
    "4": "4호선",
    "5": "5호선",
    "6": "6호선",
    "7": "7호선",
    "8": "8호선",
    "9": "9호선",
    "01호선": "1호선",
    "02호선": "2호선",
}

STATION_ALIASES = {
    "서울": "서울",
    "서울역": "서울",
}


def compact(value: Any) -> str:
    return re.sub(r"\s+", "", str(value or "").strip())


def normalize_line(value: Any) -> str:
    text = compact(value)
    return LINE_ALIASES.get(text, text)


def normalize_station(value: Any) -> str:
    text = compact(value)
    text = re.sub(r"\(.+?\)", "", text)
    text = text.removesuffix("역")
    return STATION_ALIASES.get(text, text)


def station_name(value: Any) -> str:
    normalized = normalize_station(value)
    return "서울역" if normalized == "서울" else f"{normalized}역"


def normalize_direction(value: Any) -> str | None:
    text = compact(value)
    text = re.sub(r"\(.+?\)", "", text)
    for suffix in ("방향", "방면", "쪽", "행", "역"):
        text = text.removesuffix(suffix)
    if not text:
        return None
    return f"TOWARD_{normalize_station(text)}"


def facility_type(value: Any) -> str:
    text = str(value or "").strip()
    if "에스컬레이터" in text:
        return "ESCALATOR"
    if "엘리베이터" in text or "승강기" in text:
        return "ELEVATOR"
    if "계단" in text:
        return "STAIRS"
    return "UNKNOWN"


def parse_car_door(value: Any) -> tuple[int, int] | None:
    match = re.match(r"^(\d{1,2})-(\d)$", compact(value))
    if not match:
        return None
    car_no = int(match.group(1))
    door_no = int(match.group(2))
    if not (1 <= car_no <= 12 and 1 <= door_no <= 4):
        return None
    return car_no, door_no


def extract_rows(payload: dict[str, Any]) -> tuple[int, list[dict[str, Any]]]:
    if "getFstExit" in payload:
        root = payload.get("getFstExit") or {}
        return int(root.get("list_total_count") or 0), list(root.get("row") or [])
    body = (((payload.get("response") or {}).get("body") or {}))
    total = int(body.get("totalCount") or 0)
    item = ((body.get("items") or {}).get("item") or [])
    return total, list(item)


def fetch_page(key: str, start: int, end: int) -> tuple[int, list[dict[str, Any]]]:
    url = f"{BASE_URL}/{urllib.parse.quote(key)}/json/getFstExit/{start}/{end}/"
    with urllib.request.urlopen(url, timeout=30) as response:
        payload = json.load(response)
    return extract_rows(payload)


def row_to_record(row: dict[str, Any]) -> tuple[dict[str, Any] | None, str | None]:
    parsed = parse_car_door(row.get("qckgffVhclDoorNo"))
    if not parsed:
        return None, "INVALID_CAR_DOOR"
    line = normalize_line(row.get("lineNm"))
    stn = station_name(row.get("stnNm"))
    if not line or not stn:
        return None, "MISSING_LINE_OR_STATION"
    car_no, door_no = parsed
    source_id = compact(row.get("qckgffMngNo"))
    record: dict[str, Any] = {
        "source": "SEOUL_OPENAPI_GET_FST_EXIT",
        "sourceId": source_id,
        "line": line,
        "stationName": stn,
        "stationCode": compact(row.get("stnCd")) or None,
        "directionKey": normalize_direction(row.get("drtnInfo")),
        "goal": "FINAL_EXIT",
        "carNo": car_no,
        "doorNo": door_no,
        "facility": str(row.get("plfmCmgFac") or "").strip() or None,
        "facilityType": facility_type(row.get("plfmCmgFac")),
        "confidence": "MEDIUM",
        "updatedAt": compact(row.get("crtrYmd")) or datetime.now(timezone.utc).date().isoformat(),
        "facilityNo": compact(row.get("facNo")) or None,
        "elevatorNo": compact(row.get("elvtrNo")) or None,
        "facilityPosition": str(row.get("facPstnNm") or "").strip() or None,
    }
    return {k: v for k, v in record.items() if v is not None and v != ""}, None


def main() -> None:
    key = (os.getenv("SEOUL_OPENAPI_KEY") or os.getenv("SEOUL_OPEN_API_KEY") or "").strip()
    if not key:
        print("SEOUL_OPENAPI_KEY is missing", file=sys.stderr)
        raise SystemExit(2)

    total, first_rows = fetch_page(key, 1, PAGE_SIZE)
    if total <= 0:
        total = len(first_rows)
    rows = first_rows[:]
    for start in range(PAGE_SIZE + 1, total + 1, PAGE_SIZE):
        end = min(start + PAGE_SIZE - 1, total)
        _, page_rows = fetch_page(key, start, end)
        rows.extend(page_rows)
        time.sleep(0.1)

    records_by_key: dict[tuple[Any, ...], dict[str, Any]] = {}
    skipped: list[dict[str, Any]] = []
    duplicates = 0
    for row in rows:
        record, reason = row_to_record(row)
        if reason or record is None:
            skipped.append({"reason": reason or "UNKNOWN", "sourceId": compact(row.get("qckgffMngNo"))})
            continue
        key_tuple = (
            record.get("source"),
            record.get("sourceId"),
            record.get("line"),
            normalize_station(record.get("stationName")),
            record.get("directionKey"),
            record.get("carNo"),
            record.get("doorNo"),
            record.get("facilityType"),
            record.get("facilityNo"),
        )
        if key_tuple in records_by_key:
            duplicates += 1
            continue
        records_by_key[key_tuple] = record

    records = sorted(records_by_key.values(), key=lambda r: (
        normalize_station(r["stationName"]), r["line"], r.get("directionKey", ""), r.get("facilityType", ""), r["carNo"], r["doorNo"], str(r.get("sourceId", ""))
    ))
    stations = {(normalize_station(r["stationName"]), r["line"]) for r in records}
    by_facility: dict[str, int] = {}
    for r in records:
        by_facility[r.get("facilityType", "UNKNOWN")] = by_facility.get(r.get("facilityType", "UNKNOWN"), 0) + 1

    payload = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "policy": "Verified FINAL_EXIT anchors from Seoul OpenAPI getFstExit only. Exact car-door values are used only when direction and route context match; otherwise the product falls back to comfort-centered guidance.",
        "sources": [
            {
                "id": "SEOUL_OPENAPI_GET_FST_EXIT",
                "name": "서울시 교통공사 지하철역 빠른하차정보 현황",
                "url": "https://data.seoul.go.kr/dataList/OA-22749/A/1/datasetView.do",
                "service": "getFstExit",
                "license": "공공누리 제1유형 출처표시",
            }
        ],
        "stats": {
            "sourceRows": len(rows),
            "records": len(records),
            "stationLinePairs": len(stations),
            "duplicatesSkipped": duplicates,
            "invalidRowsSkipped": len(skipped),
            "byFacilityType": by_facility,
        },
        "skippedRows": skipped,
        "records": records,
    }
    OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"ok": True, "outputPath": str(OUTPUT_PATH), "stats": payload["stats"]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
