#!/usr/bin/env python3
"""
Album Classifier — EXIF + Vision LLM auto-tagging
==================================================
Extract EXIF from uploaded photos, match against itinerary data,
call qwen3.5:9b-32k vision model (Ollama /api/chat) to classify day/spot.

Architecture:
  classify_photo() → extract EXIF → match date ±1 → match GPS haversine
  → read image base64 → build XML-tag prompt + few-shot + JSON schema
  → call Ollama /api/chat with vision → return {day, spot, confidence, reason}

Called by album_server.py async background thread after upload.

Usage:
  $ python scripts/album_classifier.py photo.jpg --itinerary data/osaka-2026.json
  $ python scripts/album_classifier.py photo.jpg --itinerary data/osaka-2026.json --model qwen3.5:9b-32k
"""

import argparse, json, os, sys, math, base64, re
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Callable, Any

# ── EXIF extraction ──────────────────────────────────────────────────────────
try:
    from PIL import Image
    from PIL.ExifTags import TAGS, GPSTAGS
    HAS_PIL = True
    # Register HEIC/HEIF support via pillow_heif (if available)
    try:
        import pillow_heif
        pillow_heif.register_heif_opener()
    except ImportError:
        pass
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
        # HEIC/HEIF: use pillow_heif's built-in EXIF access
        exif_data = None
        if hasattr(img, 'heif_file') and img.heif_file is not None:
            try:
                # pillow_heif stores EXIF as raw bytes in info['exif']
                heif_exif_raw = img.info.get('exif')
                if heif_exif_raw and (heif_exif_raw[:2] == b'\xff\xe1' or heif_exif_raw[:2] == b'II' or heif_exif_raw[:2] == b'MM'):
                    # Parse using exifread or just hex2dict-style
                    # For robustness, fall back to a simpler method:
                    # Save to a temp JPEG buffer and read EXIF from that
                    import io as _io
                    buf = _io.BytesIO()
                    img.save(buf, format='JPEG', quality=_VISION_JPEG_QUALITY)
                    buf.seek(0)
                    with Image.open(buf) as jpg_img:
                        exif_data = jpg_img._getexif()
            except Exception:
                exif_data = None
        if exif_data is None:
            try:
                exif_data = img._getexif()
            except AttributeError:
                exif_data = None
        if not exif_data:
            result["error"] = "No EXIF data"
            mtime = os.path.getmtime(filepath)
            dt = datetime.fromtimestamp(mtime)
            result["datetime"] = dt.strftime("%Y:%m:%d %H:%M:%S")
            result["fallback"] = "mtime"
            return result

        gps_info = {}
        for tag_id, value in exif_data.items():
            tag_name = TAGS.get(tag_id, tag_id)
            if tag_name == "DateTimeOriginal":
                result["datetime"] = value
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

        if not result["datetime"]:
            mtime = os.path.getmtime(filepath)
            dt = datetime.fromtimestamp(mtime)
            result["datetime"] = dt.strftime("%Y:%m:%d %H:%M:%S")
            result["fallback"] = "mtime"

        return result
    except Exception as e:
        result["error"] = str(e)
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
            if diff <= 1:
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
    coords_map = itinerary.get("weatherCoords", {})
    for name, coord in coords_map.items():
        dist = _haversine(lat, lon, coord["lat"], coord["lon"])
        results.append({"name": name, "dist_km": round(dist, 1), "source": "weatherCoords"})

    for day_info in itinerary.get("days", []):
        loc = day_info.get("location", "")
        if loc and "→" in loc:
            for city in loc.split("→"):
                city = city.strip()
                if city in coords_map:
                    dist = _haversine(lat, lon, coords_map[city]["lat"], coords_map[city]["lon"])
                    results.append({"name": city, "dist_km": round(dist, 1), "source": f"day{day_info['day']}"})

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
    for s in day_info.get("spots", []):
        title = " ".join(str(s).split()).strip()
        if title:
            spots.append(title)
    for item in day_info.get("items", []):
        title = item.get("title", "")
        title = " ".join(title.split()).strip()
        if title:
            spots.append(title)
    return spots


# ── Vision LLM classification ────────────────────────────────────────────────
_CLASSIFY_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "day": {
            "type": "integer",
            "description": "Day number from itinerary (1-based). Use 0 if cannot determine."
        },
        "spot": {
            "type": "string",
            "description": "Exact spot name from available options, or 'unknown' if cannot match."
        },
        "confidence": {
            "type": "number",
            "description": "Confidence score 0.0-1.0. Use 0.0 if pure guess."
        },
        "reason": {
            "type": "string",
            "description": "Brief reasoning in English: what visual clues + EXIF data led to this decision."
        },
    },
    "required": ["day", "spot", "confidence", "reason"],
}


def build_classification_prompt(
    exif: dict,
    candidate_days: list[int],
    nearby_spots: list[dict],
    itinerary: dict,
    caption: str = "",
) -> str:
    """Build a vision-aware prompt for LLM to classify photo by day + spot.

    Uses XML-style structure for structured input. The image itself is sent
    as base64 in the chat message — this prompt provides the context.

    Optimisations (Phase 3):
    - GPS pre-filter: when GPS available, limit available_spots to ≤5 nearest.
    - Caption integration: user's optional caption is fed as <user_caption>.
    - Hotel-based matching: each day's hotel name included for spatial cues.
    """

    # ── Build candidate day info with hotel names ──
    days_blocks = []
    all_spots = []
    for day_info in itinerary.get("days", []):
        if day_info["day"] in candidate_days or not candidate_days:
            spots = _collect_day_spots(day_info)
            all_spots.extend(spots)
            hotel = day_info.get("hotel", "")
            hotel_xml = f"  <hotel>{hotel}</hotel>\n" if hotel else ""
            days_blocks.append(
                f"<day id=\"{day_info['day']}\" date=\"{day_info['date']}\" title=\"{day_info['title']}\">\n"
                f"  <location>{day_info.get('location', '?')}</location>\n"
                f"{hotel_xml}"
                f"  <spots>{', '.join(spots[:10]) or '(none)'}</spots>\n"
                f"</day>"
            )

    # ── Nearest GPS cities ──
    nearby_xml = "\n".join(
        f"  <city name=\"{r['name']}\" distance_km=\"{r['dist_km']}\" source=\"{r['source']}\"/>"
        for r in nearby_spots[:5]
    )

    # ── GPS pre-filter: limit available_spots to ≤6 nearest when GPS available ──
    has_gps = exif.get("lat") is not None and exif.get("lon") is not None
    all_spot_set = sorted(set(all_spots))
    spot_options_xml = ""
    if has_gps and nearby_spots:
        gps_city_names = {r["name"] for r in nearby_spots}
        filtered_spots = [s for s in all_spot_set
                          if any(city.lower() in s.lower() or s.lower() in city.lower()
                                 for city in gps_city_names)]
        if filtered_spots:
            spot_options_xml = "\n".join(f"  <spot>{s}</spot>" for s in filtered_spots[:6])
        else:
            day_preferred = []
            if candidate_days:
                for d in candidate_days:
                    for day in itinerary.get("days", []):
                        if day["day"] == d:
                            day_preferred.extend(_collect_day_spots(day))
            fallback_spots = day_preferred[:6] if day_preferred else all_spot_set[:6]
            spot_options_xml = "\n".join(f"  <spot>{s}</spot>" for s in fallback_spots)
    else:
        # No GPS — send only candidate days' spots (max 10)
        filtered = [s for s in all_spot_set if any(
            s in (d.get("title","") + " " + d.get("location",""))
            for d in itinerary.get("days", [])
            if d.get("day") in candidate_days or not candidate_days
        )] or all_spot_set[:10]
        spot_options_xml = "\n".join(f"  <spot>{s}</spot>" for s in filtered[:10])

    # ── Optional caption ──
    caption_xml = ""
    if caption and caption.strip():
        caption_xml = f"\n<user_caption>{caption.strip()}</user_caption>\n"

    prompt = f"""<classification_task>
You are a travel photo classifier. You will see a photo and must determine:
1. Which DAY of the itinerary it belongs to
2. Which specific SPOT (location/attraction) is shown
3. Your CONFIDENCE (0.0-1.0)
4. A brief REASON for your decision

<exif_data>
  datetime: {exif.get('datetime', 'unknown')}
  gps_lat: {exif.get('lat', 'N/A')}
  gps_lon: {exif.get('lon', 'N/A')}
  camera: {exif.get('camera', 'unknown')}
</exif_data>{caption_xml}

<itinerary>
{chr(10).join(days_blocks) if days_blocks else '<message>No date match — use visual + GPS only</message>'}
</itinerary>

<gps_nearest>
{nearby_xml if nearby_xml else '<message>No GPS match</message>'}
</gps_nearest>

<available_spots>
{spot_options_xml if spot_options_xml else '<message>No spots listed</message>'}
</available_spots>

<example_output>
{{
  "day": 3,
  "spot": "清水寺",
  "confidence": 0.85,
  "reason": "Traditional wooden temple visible. GPS matches Kyoto (1.2km). Date matches Day 3."
}}
</example_output>

<rules>
- GPS proximity is the strongest signal: if GPS < 2km from a spot, that spot is highly likely.
- When GPS is available (>0), prefer the nearest spot within < 5km.
- Hotel location matters: if the photo is close to the day's hotel, it is likely near the hotel.
- If GPS > 10km from all itinerary cities, rely on visual content + date.
- Pick spot name EXACTLY from available_spots list. Use "unknown" if no match.
- If user_caption is provided, use it as additional context (e.g. "Dinner at X" → spot is X).
- For confidence: 0.9+ = very sure (distinct landmark, clear GPS), 0.5-0.8 = probable, 0.3-0.5 = guess, 0.0 = cannot determine.
- Output valid JSON only. No markdown, no explanation outside JSON.
</rules>
</classification_task>"""

    return prompt


def parse_llm_response(text: str) -> dict:
    """Parse LLM JSON response, with robust fallback.

    With Ollama format=json, the response should be pure JSON.
    Fallback: strip markdown fences, regex extract JSON object.
    """
    text = text.strip()
    # Strip markdown code fences
    for fence in ["```json", "```"]:
        text = text.replace(fence, "")
    text = text.strip()

    # Try direct JSON parse
    try:
        obj = json.loads(text)
        if isinstance(obj, dict):
            return _sanitize_classification(obj)
    except json.JSONDecodeError:
        pass

    # Fallback: regex extract JSON object
    match = re.search(r'\{[^{}]*"day"\s*:\s*\d+[^{}]*\}', text)
    if match:
        try:
            obj = json.loads(match.group(0))
            return _sanitize_classification(obj)
        except json.JSONDecodeError:
            pass

    # Last resort: broader regex
    match = re.search(r'\{[^{}]*\}', text)
    if match:
        try:
            obj = json.loads(match.group(0))
            if isinstance(obj, dict):
                return _sanitize_classification(obj)
        except json.JSONDecodeError:
            pass

    return {"day": 0, "spot": "unknown", "confidence": 0.0, "reason": "Failed to parse LLM response"}


def _sanitize_classification(obj: dict) -> dict:
    """Ensure classification dict has correct types and defaults."""
    return {
        "day": int(obj.get("day", 0) or 0),
        "spot": str(obj.get("spot", "unknown") or "unknown"),
        "confidence": float(obj.get("confidence", 0.0) or 0.0),
        "reason": str(obj.get("reason", "") or ""),
    }


# ── Image loading ─────────────────────────────────────────────────────────────
# Max pixels for vision model input (keep base64 under ~500KB).
# 640px is sufficient for classifying "restaurant/temple/landmark" — higher
# resolution gives ~0% accuracy gain for 3x the latency.
_VISION_MAX_DIM = 640
_VISION_JPEG_QUALITY = 60   # Q60 vs Q85: 40% smaller base64, visually fine for VLM

# ── LRU cache for classification results ──────────────────────────────────────
# Keyed by (file_hash, itinerary_hash, caption) so same photo+context reclassifies
# instantly. LRU evictions keep memory bounded.
from collections import OrderedDict


class LRUClassifyCache:
    """Thread-safe-ish LRU dict for classification results.

    Key: (file_sha256_prefix: str, itinerary_version: str, caption: str)
    Value: dict — the full classify_photo() result dict.
    """

    def __init__(self, maxsize: int = 500):
        self._maxsize = maxsize
        self._cache: OrderedDict = OrderedDict()

    def _make_key(self, filepath: str, itinerary: dict, caption: str) -> tuple:
        """Compute stable key without reading the full file."""
        # Use file mtime+size as cheap fingerprint (fast, no IO bottleneck)
        try:
            st = os.stat(filepath)
            fp = f"{st.st_mtime_ns}:{st.st_size}"
        except OSError:
            fp = filepath  # fallback to path
        # Itinerary version fingerprint
        itin_fp = str(hash(json.dumps(itinerary, sort_keys=True, ensure_ascii=False)))
        return (fp, itin_fp, caption)

    def get(self, filepath: str, itinerary: dict, caption: str) -> Optional[dict]:
        key = self._make_key(filepath, itinerary, caption)
        if key in self._cache:
            self._cache.move_to_end(key)
            return self._cache[key]
        return None

    def put(self, filepath: str, itinerary: dict, caption: str, value: dict):
        key = self._make_key(filepath, itinerary, caption)
        self._cache[key] = value
        self._cache.move_to_end(key)
        while len(self._cache) > self._maxsize:
            self._cache.popitem(last=False)

    def clear(self):
        self._cache.clear()

    @property
    def size(self) -> int:
        return len(self._cache)


_CLASSIFY_CACHE = LRUClassifyCache(maxsize=500)


def load_image_base64(filepath: str, max_dim: int = _VISION_MAX_DIM) -> str:
    """Read image file, resize if needed, return raw base64 string (NO data: prefix).

    Ollama /api/chat requires raw base64 in images[] array —
    the "data:image/...;base64," prefix causes the model to ignore the image.
    """
    import traceback
    if HAS_PIL:
        try:
            print(f"[load_image_base64] Opening {os.path.basename(filepath)} with PIL...")
            with Image.open(filepath) as img:
                img = img.convert("RGB")
                w, h = img.size
                if w > max_dim or h > max_dim:
                    ratio = min(max_dim / w, max_dim / h)
                    img = img.resize((int(w * ratio), int(h * ratio)), Image.LANCZOS)
                # Save to JPEG buffer (smaller than PNG)
                import io
                buf = io.BytesIO()
                img.save(buf, format="JPEG", quality=_VISION_JPEG_QUALITY, optimize=True)
                return base64.b64encode(buf.getvalue()).decode("ascii")
        except Exception:
            pass  # fall through to raw read

    with open(filepath, "rb") as f:
        return base64.b64encode(f.read()).decode("ascii")


# ── Main classify function ────────────────────────────────────────────────────
def classify_photo(
    filepath: str,
    itinerary: dict,
    llm_call=None,
    caption: str = "",
) -> dict:
    """
    Classify a photo against itinerary data.

    Args:
        filepath: Path to photo file
        itinerary: Loaded itinerary dict (with days[], weatherCoords{})
        llm_call: Callable(prompt: str, image_base64: str) -> str.
                  If None, returns best-guess from EXIF only.
        caption: Optional user-supplied caption for extra context.

    Returns:
        {"day": int, "spot": str, "confidence": float, "reason": str, "exif": {...},
         "llm_raw": "...", "method": str, "fallback_reason": str|None}
    """
    result = {
        "day": 0,
        "spot": "unknown",
        "confidence": 0.0,
        "reason": "",
        "exif": {},
        "llm_raw": "",
        "method": "exif-only",
        "fallback_reason": None,  # None = vision OK; str = why vision was skipped
    }

    # 1. LRU cache check (skip everything if cached)
    if llm_call:
        cached = _CLASSIFY_CACHE.get(filepath, itinerary, caption)
        if cached is not None:
            return cached

    # 2. Extract EXIF
    exif = extract_exif(filepath)
    result["exif"] = exif

    # 2. Match date
    candidate_days = []
    if exif["datetime"]:
        candidate_days = match_date(exif["datetime"], itinerary)
        if candidate_days:
            result["day"] = candidate_days[0]
            result["confidence"] = 0.6
        elif exif.get("fallback") == "mtime":
            candidate_days = match_date(exif["datetime"], itinerary)
            if candidate_days:
                result["day"] = candidate_days[0]
                result["confidence"] = 0.35
                result["method"] = "mtime"

    # 3. Match GPS
    nearby = []
    gps_skip = False
    if exif["lat"] is not None and exif["lon"] is not None:
        nearby = match_gps(exif["lat"], exif["lon"], itinerary)
        if nearby:
            nearest = nearby[0]
            # ── GPS pre-filter: if GPS < 1km from a known spot AND date matches → skip LLM ──
            if nearest["dist_km"] < 1.0 and candidate_days:
                result["spot"] = nearest["name"]
                result["day"] = candidate_days[0]
                result["confidence"] = 0.85
                result["reason"] = f"GPS <1km from {nearest['name']} ({nearest['dist_km']}km) + date matches Day {candidate_days[0]}"
                result["method"] = "gps+date"
                gps_skip = True
            elif not candidate_days:
                result["spot"] = nearest["name"]
                result["confidence"] = 0.4

    # 4. Vision LLM classification (with fallback on failure)
    has_signal = bool(candidate_days) or bool(nearby) or bool(exif.get("camera"))
    if llm_call and has_signal and not gps_skip:
        try:
            prompt = build_classification_prompt(exif, candidate_days, nearby, itinerary, caption=caption)
            img_b64 = load_image_base64(filepath)
            llm_response = llm_call(prompt, img_b64)
            result["llm_raw"] = llm_response
            parsed = parse_llm_response(llm_response)
            if parsed.get("day"):
                result["day"] = parsed["day"]
            if parsed.get("spot") and parsed["spot"] != "unknown":
                result["spot"] = parsed["spot"]
            result["confidence"] = parsed.get("confidence", result["confidence"])
            result["reason"] = parsed.get("reason", "")
            result["method"] = "exif+vision" if (candidate_days or nearby) else "vision-only"
        except Exception as e:
            result["llm_raw"] = f"LLM error: {e}"
            result["fallback_reason"] = f"vision_call_failed: {type(e).__name__}"
            print(f"[Classifier] Vision call failed for {os.path.basename(filepath)}: {e}")
            # Keep EXIF-only day/spot/confidence as fallback

    # 5. Fallback: unknown spot
    if not result.get("spot") or result["spot"] == "unknown":
        result["spot"] = "unknown"

    # 6. Store in LRU cache (only cache if LLM was available — reflects actual system state)
    if llm_call:
        _CLASSIFY_CACHE.put(filepath, itinerary, caption, result)

    return result


# ── CLI ───────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Album Photo Classifier (Vision)")
    parser.add_argument("photo", help="Path to photo file")
    parser.add_argument("--itinerary", required=True, help="Path to itinerary JSON file")
    parser.add_argument("--llm-url", default="http://127.0.0.1:11434/api/chat",
                        help="Ollama API URL (default: /api/chat for vision)")
    parser.add_argument("--model", default="qwen3.5:9b-32k", help="LLM model name")
    parser.add_argument("--no-llm", action="store_true", help="Skip LLM call (EXIF-only)")
    args = parser.parse_args()

    # Load itinerary
    with open(args.itinerary, "r", encoding="utf-8") as f:
        itinerary = json.load(f)

    # Vision LLM call function — Ollama /api/chat
    def call_ollama_vision(prompt: str, img_b64: str) -> str:
        import urllib.request
        payload = json.dumps({
            "model": args.model,
            "messages": [{
                "role": "user",
                "content": prompt,
                "images": [img_b64],  # ⚠️ raw base64, NO data: prefix
            }],
            "stream": False,
            "format": _CLASSIFY_JSON_SCHEMA,  # JSON schema structured output
            "options": {"temperature": 0, "num_ctx": 8192, "num_batch": 256},    # deterministic
        }).encode("utf-8")
        req = urllib.request.Request(args.llm_url, data=payload,
                                     headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("message", {}).get("content", "")

    llm_fn = None if args.no_llm else call_ollama_vision

    result = classify_photo(args.photo, itinerary, llm_call=llm_fn)

    print(json.dumps(result, ensure_ascii=False, indent=2))
    return result


if __name__ == "__main__":
    main()
