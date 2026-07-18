#!/usr/bin/env python3
"""
Album Classifier — EXIF + LLM auto-tagging
===========================================
Extract EXIF from uploaded photos, match against itinerary data,
call Local_LLM to classify day/spot, auto-populate metadata.

Architecture:
  classify_photo() → extract EXIF → match date ±1 → match GPS haversine
  → build LLM prompt with nearby spots → call Local_LLM → return {day, spot, confidence}

Called by album_server.py async background thread after upload.

Usage:
  $ python scripts/album_classifier.py photo.jpg --itinerary data/osaka-2026.json
  $ python scripts/album_classifier.py photo.jpg --itinerary data/osaka-2026.json --llm-url http://localhost:11434
"""

import argparse, json, os, sys, math
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

# ── EXIF extraction ──────────────────────────────────────────────────────────
try:
    from PIL import Image
    from PIL.ExifTags import TAGS, GPSTAGS
    HAS_PIL = True
except ImportError:
    HAS_PIL = False


def _dms_to_decimal(dms_tuple, ref):
    """Convert EXIF GPS DMS tuple + ref to decimal degrees."""
    degrees, minutes, seconds = dms_tuple
    decimal = float(degrees) + float(minutes) / 60.0 + float(seconds) / 3600.0
    if ref in ("S", "W"):
        decimal = -decimal
    return decimal


def extract_exif(filepath: str) -> dict:
    """Extract EXIF metadata. Returns {datetime, lat, lon, camera, ...}"""
    result = {"datetime": None, "lat": None, "lon": None, "camera": "", "error": ""}
    if not HAS_PIL:
        result["error"] = "Pillow not installed"
        return result
    try:
        img = Image.open(filepath)
        exif_data = img._getexif()
        if not exif_data:
            result["error"] = "No EXIF data"
            # Fallback: use file modification time as datetime
            mtime = os.path.getmtime(filepath)
            dt = datetime.fromtimestamp(mtime)
            result["datetime"] = dt.strftime("%Y:%m:%d %H:%M:%S")
            result["fallback"] = "mtime"
            return result

        gps_info = {}
        for tag_id, value in exif_data.items():
            tag_name = TAGS.get(tag_id, tag_id)
            if tag_name == "DateTimeOriginal":
                result["datetime"] = value  # "2026:07:20 14:30:00"
            if tag_name == "Make":
                result["camera"] = str(value).strip()
            if tag_name == "Model":
                result["camera"] = f"{result['camera']} {value}".strip()
            if tag_name == "GPSInfo":
                for gps_tag_id, gps_value in value.items():
                    gps_tag_name = GPSTAGS.get(gps_tag_id, gps_tag_id)
                    gps_info[gps_tag_name] = gps_value

        if "GPSLatitude" in gps_info and "GPSLatitudeRef" in gps_info:
            result["lat"] = _dms_to_decimal(
                gps_info["GPSLatitude"], gps_info["GPSLatitudeRef"]
            )
        if "GPSLongitude" in gps_info and "GPSLongitudeRef" in gps_info:
            result["lon"] = _dms_to_decimal(
                gps_info["GPSLongitude"], gps_info["GPSLongitudeRef"]
            )

        # If no datetime found, fallback to mtime
        if not result["datetime"]:
            mtime = os.path.getmtime(filepath)
            dt = datetime.fromtimestamp(mtime)
            result["datetime"] = dt.strftime("%Y:%m:%d %H:%M:%S")
            result["fallback"] = "mtime"

        return result
    except Exception as e:
        result["error"] = str(e)
        # Fallback: mtime even on open failure
        try:
            mtime = os.path.getmtime(filepath)
            dt = datetime.fromtimestamp(mtime)
            result["datetime"] = dt.strftime("%Y:%m:%d %H:%M:%S")
            result["fallback"] = "mtime"
        except Exception:
            pass
        return result


# ── Date matching ±1 day ─────────────────────────────────────────────────────
def _parse_exif_datetime(dt_str: str) -> Optional[datetime]:
    """Parse EXIF datetime string like '2026:07:20 14:30:00'"""
    if not dt_str:
        return None
    try:
        return datetime.strptime(dt_str, "%Y:%m:%d %H:%M:%S")
    except ValueError:
        try:
            return datetime.strptime(dt_str, "%Y-%m-%d %H:%M:%S")
        except ValueError:
            return None


def match_date(exif_dt: str, itinerary: dict) -> list[int]:
    """Match EXIF datetime to itinerary days. Returns list of candidate day numbers (±1 day)."""
    dt = _parse_exif_datetime(exif_dt)
    if not dt:
        return []
    exif_date = dt.date()
    candidates = []
    for day_info in itinerary.get("days", []):
        try:
            day_date = datetime.strptime(day_info["date"], "%Y-%m-%d").date()
            diff = abs((exif_date - day_date).days)
            if diff <= 1:  # ±1 day tolerance
                candidates.append(day_info["day"])
        except (KeyError, ValueError):
            continue
    return sorted(set(candidates))


# ── GPS matching (haversine) ──────────────────────────────────────────────────
def _haversine(lat1, lon1, lat2, lon2) -> float:
    """Distance in km between two lat/lon points."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def match_gps(lat: float, lon: float, itinerary: dict, top_n: int = 5) -> list[dict]:
    """Find nearest locations from itinerary weatherCoords + day locations."""
    results = []

    # Match against weatherCoords (city-level)
    coords_map = itinerary.get("weatherCoords", {})
    for name, coord in coords_map.items():
        dist = _haversine(lat, lon, coord["lat"], coord["lon"])
        results.append({"name": name, "dist_km": round(dist, 1), "source": "weatherCoords"})

    # Match against day locations (from days[].location field)
    for day_info in itinerary.get("days", []):
        loc = day_info.get("location", "")
        if loc and "→" in loc:
            for city in loc.split("→"):
                city = city.strip()
                if city in coords_map:
                    dist = _haversine(lat, lon, coords_map[city]["lat"], coords_map[city]["lon"])
                    results.append({"name": city, "dist_km": round(dist, 1), "source": f"day{day_info['day']}"})

    # Sort by distance, deduplicate
    seen = set()
    unique = []
    for r in sorted(results, key=lambda x: x["dist_km"]):
        if r["name"] not in seen:
            seen.add(r["name"])
            unique.append(r)
            if len(unique) >= top_n:
                break
    return unique


# ── Collect spots for a day ───────────────────────────────────────────────────
def _collect_day_spots(day_info: dict) -> list[str]:
    """Collect spot names from a day's items or spots field."""
    spots = []
    # Try spots[] first (our itinerary format)
    for s in day_info.get("spots", []):
        title = " ".join(str(s).split()).strip()
        if title:
            spots.append(title)
    # Fallback: items[].title (alternate format)
    for item in day_info.get("items", []):
        title = item.get("title", "")
        title = " ".join(title.split()).strip()
        if title:
            spots.append(title)
    return spots


# ── LLM classification ──────────────────────────────────────────────────────
def build_classification_prompt(
    exif: dict,
    candidate_days: list[int],
    nearby_spots: list[dict],
    itinerary: dict,
) -> str:
    """Build a prompt for LLM to classify which day + spot a photo belongs to."""

    # Collect candidate day info
    days_text = []
    all_spots = []
    for day_info in itinerary.get("days", []):
        if day_info["day"] in candidate_days or not candidate_days:
            spots = _collect_day_spots(day_info)
            all_spots.extend(spots)
            days_text.append(
                f"Day {day_info['day']} ({day_info['date']}): {day_info['title']}\n"
                f"  Location: {day_info.get('location', '?')}\n"
                f"  Spots: {', '.join(spots[:8]) or '(none)'}"
            )

    # Nearest cities
    nearby_text = "\n".join(
        f"  {r['name']} — {r['dist_km']}km away" for r in nearby_spots[:5]
    )

    # Build unique spot list for LLM to choose from
    spot_options = "\n".join(f"  - {s}" for s in sorted(set(all_spots))) or "  (no spots listed)"

    prompt = f"""Classify this travel photo for an itinerary:

## EXIF Data
- Date/Time: {exif.get('datetime', 'unknown')}
- GPS: {exif.get('lat', '?')}, {exif.get('lon', '?')}
- Camera: {exif.get('camera', 'unknown')}

## Itinerary Candidate Days
{chr(10).join(days_text) if days_text else '(no date match — classify from GPS only)'}

## Nearest Known Cities
{nearby_text or '(no GPS match)'}

## Available Spot Names (choose one)
{spot_options}

## Instructions
Based on the photo's date, GPS location, and the itinerary above, determine:
1. Which DAY (number only, e.g. 3) this photo most likely belongs to
2. Which SPOT (exact name from the list above, or "unknown" if unsure)
3. CONFIDENCE (0.0–1.0)

Reply in this EXACT JSON format (no markdown, no extra text):
{{"day": 3, "spot": "鳥取沙丘", "confidence": 0.85}}"""

    return prompt


def parse_llm_response(text: str) -> dict:
    """Parse LLM JSON response, handling markdown code fences."""
    text = text.strip()
    # Strip markdown code fences
    for fence in ["```json", "```"]:
        text = text.replace(fence, "")
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Try to extract JSON object
        import re
        match = re.search(r'\{[^{}]*"day"\s*:\s*\d+[^{}]*\}', text)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                pass
        return {"day": 0, "spot": "", "confidence": 0.0, "error": "Failed to parse LLM response"}


# ── Main classify function ────────────────────────────────────────────────────
def classify_photo(
    filepath: str,
    itinerary: dict,
    llm_call=None,
) -> dict:
    """
    Classify a photo against itinerary data.
    
    Args:
        filepath: Path to photo file
        itinerary: Loaded itinerary dict (with days[], weatherCoords{})
        llm_call: Callable(prompt: str) -> str (LLM API call). If None, returns best-guess from EXIF only.
    
    Returns:
        {"day": int, "spot": str, "confidence": float, "exif": {...}, "llm_raw": "..."}
    """
    result = {
        "day": 0,
        "spot": "",
        "confidence": 0.0,
        "exif": {},
        "llm_raw": "",
        "method": "exif-only",
    }

    # 1. Extract EXIF
    exif = extract_exif(filepath)
    result["exif"] = exif

    # 2. Match date
    candidate_days = []
    if exif["datetime"]:
        candidate_days = match_date(exif["datetime"], itinerary)
        if candidate_days:
            result["day"] = candidate_days[0]  # Best guess: first match
            result["confidence"] = 0.6
        elif exif.get("fallback") == "mtime":
            # mtime fallback is weak — treat as tentative date match
            candidate_days = match_date(exif["datetime"], itinerary)
            if candidate_days:
                result["day"] = candidate_days[0]
                result["confidence"] = 0.35  # lower confidence for mtime
                result["method"] = "mtime"

    # 3. Match GPS
    nearby = []
    if exif["lat"] is not None and exif["lon"] is not None:
        nearby = match_gps(exif["lat"], exif["lon"], itinerary)
        if nearby and not candidate_days:
            result["spot"] = nearby[0]["name"]
            result["confidence"] = 0.4

    # 4. LLM classification — only if we have SOME signal
    has_signal = bool(candidate_days) or bool(nearby) or bool(exif.get("camera"))
    if llm_call and has_signal:
        try:
            prompt = build_classification_prompt(exif, candidate_days, nearby, itinerary)
            llm_response = llm_call(prompt)
            result["llm_raw"] = llm_response
            parsed = parse_llm_response(llm_response)
            if parsed.get("day"):
                result["day"] = parsed["day"]
            if parsed.get("spot"):
                result["spot"] = parsed["spot"]
            result["confidence"] = parsed.get("confidence", result["confidence"])
            result["method"] = "exif+llm" if (candidate_days or nearby) else "llm-only"
        except Exception as e:
            result["llm_raw"] = f"LLM error: {e}"

    # 5. If no spot identified, mark as unknown
    if not result.get("spot"):
        result["spot"] = "unknown"

    return result


# ── CLI ───────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Album Photo Classifier")
    parser.add_argument("photo", help="Path to photo file")
    parser.add_argument("--itinerary", required=True, help="Path to itinerary JSON file")
    parser.add_argument("--llm-url", default="http://127.0.0.1:11434/api/generate",
                        help="Ollama API URL (default: local Ollama)")
    parser.add_argument("--model", default="qwen2.5:7b", help="LLM model name")
    parser.add_argument("--no-llm", action="store_true", help="Skip LLM call (EXIF-only)")
    args = parser.parse_args()

    # Load itinerary
    with open(args.itinerary, "r", encoding="utf-8") as f:
        itinerary = json.load(f)

    # LLM call function
    def call_ollama(prompt: str) -> str:
        import urllib.request
        payload = json.dumps({
            "model": args.model,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.1, "num_predict": 200},
        }).encode("utf-8")
        req = urllib.request.Request(args.llm_url, data=payload,
                                     headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("response", "")

    llm_fn = None if args.no_llm else call_ollama

    result = classify_photo(args.photo, itinerary, llm_call=llm_fn)

    print(json.dumps(result, ensure_ascii=False, indent=2))
    return result


if __name__ == "__main__":
    main()
