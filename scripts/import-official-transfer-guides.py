#!/usr/bin/env python3
"""Generate verified NEXT_TRANSFER door guides from official/public CSV sources.

Safety rules:
- Only explicit car/door rows from official/public CSVs are emitted.
- Inventory rows are never used to synthesize anchors.
- Known field-verified conflicts are suppressed and documented.
- Multiple valid doors for one direction may be recorded; recommendation code must compact to one nearby anchor window.
"""

from __future__ import annotations

import csv
import json
import re
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "data" / "door-guidance" / "source"
OUTPUT_PATH = ROOT / "data" / "door-guidance" / "verified-next-transfer-guides.json"
INVENTORY_PATH = ROOT / "data" / "door-guidance" / "transfer-inventory.json"

SEOUL_CSV = SOURCE_DIR / "seoul-metro-transfer-20250317.csv"
MOLIT_CSV = SOURCE_DIR / "molit-quick-transfer-20250923.csv"

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
    "경의선": "경의중앙선",
    "경의중앙": "경의중앙선",
    "경의·중앙선": "경의중앙선",
    "수인분당": "수인분당선",
    "우이신설": "우이신설선",
    "우이신설경전철": "우이신설선",
}

STATION_ALIASES = {
    "서울": "서울",
    "서울역": "서울",
    "고속터미널": "고속터미널",
    "고속터미널역": "고속터미널",
    "교대법원검찰청": "교대",
    "충정로경기대입구": "충정로",
    "불암산당고개": "불암산",
    "숙대입구갈월": "숙대입구",
}

# Rows where public source values are known to be directionally inconsistent with field verification.
# STATIC_CURATED records in staticFixture.ts provide the production replacement.
SUPPRESSED_SOURCE_ROWS = {
    ("SEOUL_METRO_TRANSFER_CSV", "124"),
    ("SEOUL_METRO_TRANSFER_CSV", "126"),
    ("SEOUL_METRO_TRANSFER_CSV", "127"),
    ("SEOUL_METRO_TRANSFER_CSV", "128"),
    # Hongdae Line 2 -> Gyeongui-Jungang: public rows point Shinchon-side transfers to 3-3,
    # but field verification/user report places the Shinchon-side transfer doors at 7-2/9-2.
    # STATIC_CURATED records in staticFixture.ts are the production replacement.
    ("SEOUL_METRO_TRANSFER_CSV", "129"),
    ("SEOUL_METRO_TRANSFER_CSV", "130"),
    # Daegok Gyeongui-Jungang -> Line 3: Seoul CSV local-direction rows conflict with MOLIT terminal-direction rows.
    # Keep MOLIT 2025-09-23 rows because they match the previously verified Daegok anchor contract.
    ("SEOUL_METRO_TRANSFER_CSV", "138"),
    ("SEOUL_METRO_TRANSFER_CSV", "139"),
    ("SEOUL_METRO_TRANSFER_CSV", "140"),
    ("SEOUL_METRO_TRANSFER_CSV", "141"),
    ("MOLIT_QUICK_TRANSFER_CSV", "653"),
    ("MOLIT_QUICK_TRANSFER_CSV", "654"),
    ("MOLIT_QUICK_TRANSFER_CSV", "655"),
    ("MOLIT_QUICK_TRANSFER_CSV", "656"),
    ("MOLIT_QUICK_TRANSFER_CSV", "657"),
    ("MOLIT_QUICK_TRANSFER_CSV", "659"),
}


def compact(value: str | None) -> str:
    return re.sub(r"\s+", "", (value or "").strip())


def normalize_station(value: str | None) -> str:
    text = compact(value)
    text = re.sub(r"\(.+?\)", "", text)
    text = text.removesuffix("역")
    return STATION_ALIASES.get(text, text)


def station_name(value: str | None) -> str:
    normalized = normalize_station(value)
    return "서울역" if normalized == "서울" else f"{normalized}역"


def normalize_line(value: str | None) -> str:
    text = compact(value)
    return LINE_ALIASES.get(text, text)


def normalize_direction(value: str | None) -> str | None:
    text = compact(value)
    text = re.sub(r"\(.+?\)", "", text)
    for suffix in ("방향", "방면", "쪽", "행", "역"):
        text = text.removesuffix(suffix)
    text = STATION_ALIASES.get(text, text)
    if not text:
        return None
    if text == "내선":
        return "INNER"
    if text == "외선":
        return "OUTER"
    if text == "상행":
        return "UP"
    if text == "하행":
        return "DOWN"
    return f"TOWARD_{text}"


def parse_int(value: str | None) -> int | None:
    try:
        return int(compact(value))
    except Exception:
        return None


def valid_car_door(car_no: int | None, door_no: int | None) -> bool:
    return isinstance(car_no, int) and isinstance(door_no, int) and 1 <= car_no <= 12 and 1 <= door_no <= 4


def record_key(record: dict[str, Any]) -> tuple[Any, ...]:
    return (
        record["source"],
        record.get("sourceId"),
        record["line"],
        normalize_station(record["stationName"]),
        record.get("directionKey"),
        record["targetLine"],
        record["carNo"],
        record["doorNo"],
    )


def make_seoul_records() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    records: list[dict[str, Any]] = []
    skipped: list[dict[str, Any]] = []
    with SEOUL_CSV.open(encoding="utf-8", newline="") as f:
        for row_index, row in enumerate(csv.DictReader(f), start=1):
            source_id = compact(row.get("고유번호")) or str(row_index)
            source = "SEOUL_METRO_TRANSFER_CSV"
            if (source, source_id) in SUPPRESSED_SOURCE_ROWS:
                skipped.append({"source": source, "sourceId": source_id, "reason": "FIELD_VERIFIED_CONFLICT_SUPPRESSED"})
                continue
            car_no = parse_int(row.get("하차위치(호차)"))
            door_no = parse_int(row.get("하차위치(문)"))
            if not valid_car_door(car_no, door_no):
                skipped.append({"source": source, "sourceId": source_id, "reason": "INVALID_CAR_DOOR"})
                continue
            line = normalize_line(row.get("환승시작 호선"))
            target_line = normalize_line(row.get("환승종료 호선"))
            if not line or not target_line or line == target_line:
                skipped.append({"source": source, "sourceId": source_id, "reason": "INVALID_LINE_PAIR"})
                continue
            records.append({
                "source": source,
                "sourceId": source_id,
                "line": line,
                "stationName": station_name(row.get("환승시작역")),
                "stationCode": compact(row.get("환승시작 코드")) or None,
                "directionKey": normalize_direction(row.get("하차 열차 방면")),
                "goal": "NEXT_TRANSFER",
                "targetLine": target_line,
                "carNo": car_no,
                "doorNo": door_no,
                "facility": "환승통로",
                "confidence": "MEDIUM",
                "updatedAt": "2025-03-17",
            })
    return records, skipped


def make_molit_records() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    records: list[dict[str, Any]] = []
    skipped: list[dict[str, Any]] = []
    with MOLIT_CSV.open(encoding="utf-8", newline="") as f:
        for row_index, row in enumerate(csv.DictReader(f), start=1):
            source_id = str(row_index)
            source = "MOLIT_QUICK_TRANSFER_CSV"
            if (source, source_id) in SUPPRESSED_SOURCE_ROWS:
                skipped.append({"source": source, "sourceId": source_id, "reason": "FIELD_VERIFIED_CONFLICT_SUPPRESSED"})
                continue
            car_no = parse_int(row.get("차량순서"))
            door_no = parse_int(row.get("차량출입문번호"))
            if not valid_car_door(car_no, door_no):
                skipped.append({"source": source, "sourceId": source_id, "reason": "INVALID_CAR_DOOR"})
                continue
            line = normalize_line(row.get("노선명"))
            target_line = normalize_line(row.get("환승선"))
            if not line or not target_line or line == target_line:
                skipped.append({"source": source, "sourceId": source_id, "reason": "INVALID_LINE_PAIR"})
                continue
            records.append({
                "source": source,
                "sourceId": source_id,
                "line": line,
                "stationName": station_name(row.get("역명")),
                "directionKey": normalize_direction(row.get("종착역명")),
                "goal": "NEXT_TRANSFER",
                "targetLine": target_line,
                "carNo": car_no,
                "doorNo": door_no,
                "facility": "환승통로",
                "confidence": "MEDIUM",
                "updatedAt": "2025-09-23",
            })
    return records, skipped


def load_inventory_pairs() -> set[tuple[str, str, str]]:
    payload = json.loads(INVENTORY_PATH.read_text(encoding="utf-8"))
    pairs: set[tuple[str, str, str]] = set()
    for item in payload.get("inventory", []):
        station = normalize_station(item.get("stationName"))
        for pair in item.get("linePairs", []):
            pairs.add((station, normalize_line(pair.get("fromLine")), normalize_line(pair.get("toLine"))))
    return pairs


def strip_none(record: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in record.items() if v is not None and v != ""}


def main() -> None:
    inventory_pairs = load_inventory_pairs()
    seoul_records, seoul_skipped = make_seoul_records()
    molit_records, molit_skipped = make_molit_records()
    source_records = [*seoul_records, *molit_records]
    out_of_inventory = []
    deduped: dict[tuple[Any, ...], dict[str, Any]] = {}
    duplicate_count = 0
    for record in source_records:
        if (normalize_station(record["stationName"]), record["line"], record["targetLine"]) not in inventory_pairs:
            out_of_inventory.append({
                "source": record["source"],
                "sourceId": record.get("sourceId"),
                "stationName": record["stationName"],
                "line": record["line"],
                "targetLine": record["targetLine"],
                "reason": "OUT_OF_PRODUCT_INVENTORY",
            })
            continue
        clean = strip_none(record)
        key = record_key(clean)
        if key in deduped:
            duplicate_count += 1
            continue
        deduped[key] = clean

    records = sorted(
        deduped.values(),
        key=lambda r: (normalize_station(r["stationName"]), r["line"], r["targetLine"], r.get("directionKey", ""), r["carNo"], r["doorNo"], r["source"], str(r.get("sourceId", ""))),
    )

    pairs = {(normalize_station(r["stationName"]), r["line"], r["targetLine"]) for r in records}
    groups: dict[tuple[str, str, str, str], list[dict[str, Any]]] = defaultdict(list)
    for r in records:
        groups[(normalize_station(r["stationName"]), r["line"], r["targetLine"], r.get("directionKey", "NO_DIRECTION"))].append(r)
    broad_groups = []
    for key, group in groups.items():
        cars = sorted({r["carNo"] for r in group})
        if cars and max(cars) - min(cars) > 2:
            broad_groups.append({
                "stationName": key[0] + "역" if key[0] != "서울" else "서울역",
                "line": key[1],
                "targetLine": key[2],
                "directionKey": key[3],
                "carNos": cars,
                "recordCount": len(group),
            })

    payload = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "policy": "Verified NEXT_TRANSFER anchors from public/official CSV sources only. Known field-verified conflicts are suppressed; broad same-direction anchor groups are recorded but recommendation uses a compact representative anchor window.",
        "sources": [
            {
                "id": "SEOUL_METRO_TRANSFER_CSV",
                "name": "서울교통공사_서울 도시철도 환승정보",
                "url": "https://data.seoul.go.kr/dataList/OA-22521/F/1/datasetView.do",
                "localPath": "data/door-guidance/source/seoul-metro-transfer-20250317.csv",
                "license": "공공누리 제1유형 출처표시",
                "updatedAt": "2025-03-17",
            },
            {
                "id": "MOLIT_QUICK_TRANSFER_CSV",
                "name": "국토교통부_철도역 빠른 환승 정보",
                "url": "https://www.data.go.kr/data/15151816/fileData.do",
                "localPath": "data/door-guidance/source/molit-quick-transfer-20250923.csv",
                "license": "이용허락범위 제한 없음",
                "updatedAt": "2025-09-23",
            },
        ],
        "stats": {
            "records": len(records),
            "directedPairs": len(pairs),
            "sourceRowsWithValidCarDoor": len(source_records),
            "outOfInventoryRowsSkipped": len(out_of_inventory),
            "suppressedKnownConflicts": len([s for s in [*seoul_skipped, *molit_skipped] if s["reason"] == "FIELD_VERIFIED_CONFLICT_SUPPRESSED"]),
            "invalidRowsSkipped": len([s for s in [*seoul_skipped, *molit_skipped] if s["reason"] != "FIELD_VERIFIED_CONFLICT_SUPPRESSED"]),
            "duplicateRowsSkipped": duplicate_count,
            "broadAnchorGroups": len(broad_groups),
        },
        "suppressedRows": [*seoul_skipped, *molit_skipped, *out_of_inventory],
        "broadAnchorGroups": broad_groups,
        "records": records,
    }
    OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"ok": True, "outputPath": str(OUTPUT_PATH), "stats": payload["stats"]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
