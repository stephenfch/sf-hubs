r"""
Album Hub — Local Photo Server (FastAPI)
=========================================
Serves photos from C:\Users\Win 11\sf-hubs-photos\
Exposed via Cloudflare Tunnel: album.sf-hubs.dev -> localhost:5300

Run:
  python scripts/album_server.py
  python scripts/album_server.py --port 5300
  python scripts/album_server.py --reload   # dev mode

Install (one-time):
  pip install fastapi uvicorn python-multipart pillow
"""

import argparse, json, os, sys, uuid, threading, time, urllib.request
from concurrent.futures import ThreadPoolExecutor, Future
from datetime import datetime
from pathlib import Path
from typing import Optional
from fastapi import Body

try:
    from fastapi import FastAPI, UploadFile, Form, HTTPException, Request, Body
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import FileResponse
    import uvicorn
except ImportError as e:
    sys.exit(f"Missing dependency: {e}\nRun: pip install fastapi uvicorn python-multipart pillow")

# Register HEIC/HEIF support for iPhone photos
try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
    print("[HEIC] pillow-heif opener registered — HEIC/HEIF support enabled")
except ImportError:
    print("[WARN] pillow-heif not installed — HEIC/HEIF thumbnails will fail. Run: pip install pillow-heif")

try:
    from PIL import Image, ImageOps
except ImportError:
    Image = None
    ImageOps = None
    print("[WARN] Pillow not installed — thumbnails disabled. Run: pip install pillow")

# BlurHash for progressive image placeholders
try:
    import blurhash as _blurhash
    _HAS_BLURHASH = True
    print("[BlurHash] blurhash module loaded — placeholder enabled")
except ImportError:
    _HAS_BLURHASH = False
    print("[BlurHash] blurhash not installed. Run: pip install blurhash")

# ── Config ──────────────────────────────────────────────────────────────────
PHOTO_ROOT = Path(r"C:\Users\Win 11\sf-hubs-photos")
THUMB_WIDTH = 480
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".heic", ".heif"}
ITINERARY_PATH = Path(__file__).resolve().parent.parent / "data" / "osaka-2026.json"

# ── Bounded Classifier Worker Pool ────────────────────────────────────────────
_CLASSIFY_WORKERS = 2          # max concurrent Ollama calls
_CLASSIFY_RETRY_MAX = 2        # max retries on LLM failure
_CLASSIFY_RETRY_BACKOFF = [1.0, 3.0]  # seconds between retries

_executor = ThreadPoolExecutor(max_workers=_CLASSIFY_WORKERS)
print(f"[Classifier Pool] Created ThreadPoolExecutor(max_workers={_CLASSIFY_WORKERS})")


def _call_ollama_classify(prompt: str, img_b64: str, retries: int = _CLASSIFY_RETRY_MAX) -> str:
    """Call Ollama qwen3.5:9b-32k via /api/chat with vision + JSON schema.

    Automatic retry on timeout/exception with exponential backoff (1s, 3s).
    Raises RuntimeError if all retries exhausted.
    """
    last_error = None
    for attempt in range(retries + 1):  # 1 initial + N retries
        try:
            # NOTE: `format` (JSON schema) is REMOVED for vision calls.
            # qwen3.5:9b-32k hangs when format=json + images are used together.
            # The prompt itself already enforces JSON output via <classification_task>.
            payload = json.dumps({
                "model": "qwen3.5:9b-32k",
                "messages": [{
                    "role": "user",
                    "content": prompt,
                    "images": [img_b64],
                }],
                "stream": False,
                "options": {"temperature": 0},
            }).encode("utf-8")
            req = urllib.request.Request(
                "http://127.0.0.1:11434/api/chat",
                data=payload,
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=150) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                return data.get("message", {}).get("content", "")
        except Exception as e:
            last_error = e
            if attempt < retries:
                backoff = _CLASSIFY_RETRY_BACKOFF[min(attempt, len(_CLASSIFY_RETRY_BACKOFF) - 1)]
                print(f"[Classifier Pool] LLM call failed (attempt {attempt+1}/{retries+1}): {e} — retrying in {backoff}s")
                time.sleep(backoff)
            else:
                print(f"[Classifier Pool] LLM call failed all {retries+1} attempts: {e}")

    raise RuntimeError(f"Ollama classify failed after {retries+1} attempts: {type(last_error).__name__}")


# ── Classify Progress Tracker ─────────────────────────────────────────────────
# Tracks batch classify progress per trip so /api/classify-progress can poll it.
# _classify_progress: {trip_id: {"total": int, "done": int, "errors": int,
#                                 "results": list[dict], "started": float, "finished": float|None}}
_classify_progress: dict[str, dict] = {}
_classify_progress_lock = threading.Lock()


def _init_progress(trip_id: str, total: int) -> None:
    with _classify_progress_lock:
        _classify_progress[trip_id] = {
            "total": total,
            "done": 0,
            "errors": 0,
            "results": [],
            "started": time.time(),
            "finished": None,
        }


def _update_progress(trip_id: str, key: str, status_dict: dict) -> None:
    with _classify_progress_lock:
        tracker = _classify_progress.get(trip_id)
        if not tracker:
            return
        if status_dict.get("status") == "done":
            tracker["done"] += 1
        elif status_dict.get("status") == "error":
            tracker["errors"] += 1
        tracker["results"].append({
            "key": key,
            "status": status_dict.get("status", "unknown"),
            "classifier": status_dict.get("classifier"),
            "error": status_dict.get("error"),
        })
        if tracker["done"] + tracker["errors"] >= tracker["total"]:
            tracker["finished"] = time.time()


def _get_progress(trip_id: str) -> Optional[dict]:
    with _classify_progress_lock:
        t = _classify_progress.get(trip_id)
        if not t:
            return None
        return dict(t)  # shallow copy


# ── Metadata cache (LRU-like, per-trip) ──────────────────────────────────────
# Avoids re-reading metadata.json from disk on every request.
# _meta_cache: {trip_id: (metadata_dict, mtime_timestamp)}
_meta_cache: dict[str, tuple[dict, float]] = {}
_meta_lock = threading.Lock()
_META_CACHE_TTL = 2.0  # seconds — stale reads will re-read from disk


def _load_meta_safe(trip_dir: Path, force_reload: bool = False) -> dict:
    """Thread-safe load metadata.json with in-memory cache.

    Cache invalidates after _META_CACHE_TTL seconds or when file mtime changes.
    Pass force_reload=True to skip cache entirely (e.g. after write).
    """
    meta_file = trip_dir / "metadata.json"
    trip_id = trip_dir.name

    if not force_reload:
        with _meta_lock:
            cached = _meta_cache.get(trip_id)
            if cached is not None:
                meta_dict, cached_at = cached
                age = time.time() - cached_at
                try:
                    current_mtime = meta_file.stat().st_mtime if meta_file.exists() else 0
                except OSError:
                    current_mtime = 0
                if age < _META_CACHE_TTL and current_mtime <= cached_at:
                    return meta_dict

    if meta_file.exists():
        try:
            meta_dict = json.loads(meta_file.read_text(encoding="utf-8"))
            with _meta_lock:
                _meta_cache[trip_id] = (meta_dict, time.time())
            return meta_dict
        except (json.JSONDecodeError, OSError) as e:
            corrupt_backup = trip_dir / f"metadata.json.corrupt.{datetime.now().strftime('%Y%m%d-%H%M%S')}"
            try:
                import shutil
                shutil.copy2(meta_file, corrupt_backup)
                print(f"[WARN] Corrupt metadata.json backed up to {corrupt_backup.name}: {e}")
            except Exception:
                print(f"[ERROR] Failed to backup corrupt metadata.json: {e}")
    return {}


def _save_meta_safe(trip_dir: Path, meta: dict) -> None:
    """Thread-safe atomic save of metadata.json + invalidate cache."""
    meta_file = trip_dir / "metadata.json"
    tmp = trip_dir / "metadata.json.tmp"
    tmp.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(meta_file)  # atomic on Windows if same volume
    # Invalidate cache immediately
    with _meta_lock:
        _meta_cache[trip_dir.name] = (meta, time.time())


def _atomic_update_meta(trip_dir: Path, key: str, update_fn) -> dict:
    """Load metadata, apply update_fn to entry, save — all under _meta_lock.

    Args:
        trip_dir: Trip directory path
        key: Photo key in metadata dict
        update_fn: callable(entry_dict) -> updated_entry_dict

    Returns:
        The metadata dict after update.
    """
    meta_file = trip_dir / "metadata.json"
    with _meta_lock:
        # Read directly — don't call _load_meta_safe which also acquires _meta_lock
        if meta_file.exists():
            try:
                meta = json.loads(meta_file.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                meta = {}
        else:
            meta = {}
        if key in meta:
            meta[key] = update_fn(meta[key])
        # Save atomically
        tmp = trip_dir / "metadata.json.tmp"
        tmp.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp.replace(meta_file)
        # Update cache
        _meta_cache[trip_dir.name] = (meta, time.time())
        return meta


# ── Classifier (lazy load) ───────────────────────────────────────────────────
_classifier = None
_itinerary = None
_classifier_lock = threading.Lock()

def _get_classifier():
    """Lazy-load classifier module and itinerary data."""
    global _classifier, _itinerary
    if _classifier is None:
        with _classifier_lock:
            if _classifier is None:  # double-check
                # Import our classifier
                sys.path.insert(0, str(Path(__file__).resolve().parent))
                import album_classifier
                _classifier = album_classifier
                # Load itinerary
                if ITINERARY_PATH.exists():
                    _itinerary = json.loads(ITINERARY_PATH.read_text(encoding="utf-8"))
                else:
                    print(f"[Classifier] Itinerary not found: {ITINERARY_PATH}")
                    _itinerary = {"days": [], "weatherCoords": {}}
    return _classifier, _itinerary


def _classify_one(filepath: str, trip_id: str, key: str, progress_callback=None) -> dict:
    """Classify one photo and update metadata. Returns classifier metadata dict.
    
    If progress_callback is provided, calls it with (key, status_dict) after metadata update.
    """
    import io, tempfile, os as _os
    orig_path = filepath
    tmp_file_created = False
    try:
        # ── HEIC/HEIF pre-conversion to JPEG (bypass PIL's lack of native _getexif support) ──
        ext = _os.path.splitext(key)[1].lower()
        if ext in ('.heic', '.heif'):
            try:
                import pillow_heif
                pillow_heif.register_heif_opener()
                from PIL import Image as PILImage
                pil_img = PILImage.open(filepath)
                pil_img = pil_img.convert("RGB")
                # Resize if needed
                w, h = pil_img.size
                if max(w, h) > 1024:
                    ratio = min(1024 / w, 1024 / h)
                    pil_img = pil_img.resize((int(w * ratio), int(h * ratio)), PILImage.LANCZOS)
                tmp_jpg = tempfile.NamedTemporaryFile(suffix='.jpg', delete=False)
                pil_img.save(tmp_jpg, format='JPEG', quality=85, optimize=True)
                filepath = tmp_jpg.name
                tmp_file_created = True
                print(f"[Classifier] HEIC→JPEG converted {key} -> {_os.path.basename(filepath)}")
            except Exception as e:
                print(f"[Classifier] HEIC conversion failed for {key}: {e} — using original")
                import traceback as _tb
                _tb.print_exc()

        classifier, itinerary = _get_classifier()
        if not itinerary.get("days"):
            return {"error": "no_itinerary"}

        # ── Read caption from existing metadata for extra context ──
        caption = ""
        trip_dir = PHOTO_ROOT / _safe_filename(trip_id)
        meta = _load_meta_safe(trip_dir)
        existing = meta.get(key, {})
        if isinstance(existing, dict):
            caption = existing.get("caption", "")

        result = classifier.classify_photo(
            filepath, itinerary,
            llm_call=_call_ollama_classify,
            caption=caption,
        )

        # ── Conformal calibration ──
        cal_result = _apply_conformal(result.get("confidence", 0))

        # ── Determine needs_review ──
        fallback_reason = result.get("fallback_reason")
        needs_review = cal_result.get("needs_review", False) or bool(fallback_reason)

        # ── Build classifier metadata ──
        classifier_meta = {
            "method": result.get("method", ""),
            "confidence": result.get("confidence", 0),
            "calibrated_confidence": cal_result.get("calibrated_confidence", result.get("confidence", 0)),
            "needs_review": needs_review,
            "heuristic_threshold": cal_result.get("conformal_threshold"),
            "coverage_target": cal_result.get("coverage"),
        }
        if fallback_reason:
            classifier_meta["fallback_reason"] = fallback_reason

        # ── Update metadata (thread-safe: _atomic_update_meta holds _meta_lock) ──
        if result.get("day") or result.get("spot") or fallback_reason:
            trip_dir = PHOTO_ROOT / trip_id

            def _apply(entry):
                entry["day"] = result.get("day", entry.get("day", 0))
                entry["spot"] = result.get("spot", entry.get("spot", ""))
                entry["classifier"] = classifier_meta
                return entry

            _atomic_update_meta(trip_dir, key, _apply)
            review_flag = "⚠️NEEDS_REVIEW" if needs_review else "✅"
            print(f"[Classifier] Tagged {key}: day={result['day']}, spot={result['spot']} "
                  f"({result.get('confidence', 0):.0%} raw → {cal_result.get('calibrated_confidence', 0):.0%} cal) {review_flag}")

        # ── Call progress callback ──
        if progress_callback:
            progress_callback(key, {"status": "done", "classifier": classifier_meta})
        return classifier_meta

    except Exception as e:
        print(f"[Classifier] Classify failed for {key}: {e}")
        if progress_callback:
            progress_callback(key, {"status": "error", "error": str(e)})
        return {"error": str(e)}
    finally:
        # Clean up temp HEIC→JPEG converted file
        if tmp_file_created and filepath != orig_path and _os.path.exists(filepath):
            try:
                _os.unlink(filepath)
            except Exception:
                pass


def _classify_async(filepath: str, trip_id: str, key: str):
    """Background thread: classify photo via bounded executor pool."""
    _executor.submit(_classify_one, filepath, trip_id, key)


# ── Conformal calibration helper ─────────────────────────────────────────────
_conformal_calibrator = None
_conformal_lock = threading.Lock()


def _get_conformal() -> "ConformalCalibrator | None":
    """Lazy-load heuristic calibrator (NOT a conformal guarantee — self-referential labels)."""
    global _conformal_calibrator
    if _conformal_calibrator is None:
        with _conformal_lock:
            if _conformal_calibrator is None:
                meta_path = PHOTO_ROOT / ITINERARY_PATH.parent.name / ITINERARY_PATH.name
                # Re-derive: metadata sits at sf-hubs-photos/<trip>/metadata.json
                # ITINERARY_PATH = .../sf-hubs/data/osaka-2026.json
                # So we need: PHOTO_ROOT / "osaka-2026" / "metadata.json"
                trip_id = ITINERARY_PATH.stem  # e.g. "osaka-2026"
                meta_path = PHOTO_ROOT / trip_id / "metadata.json"
                if meta_path.exists():
                    try:
                        from conformal_calibrator import ConformalCalibrator
                        _conformal_calibrator = ConformalCalibrator.load_from_metadata(
                            str(meta_path), coverage=0.9
                        )
                        print(f"[Heuristic] Loaded calibrator: threshold={_conformal_calibrator.threshold:.4f}, "
                              f"n={_conformal_calibrator.calibration_size} (self-referential labels — NOT a coverage guarantee)")
                    except Exception as e:
                        print(f"[Heuristic] Failed to load: {e}")
                        _conformal_calibrator = False  # sentinel: tried and failed
    return _conformal_calibrator if _conformal_calibrator is not False else None


def _apply_conformal(raw_confidence: float) -> dict:
    """Apply heuristic confidence threshold (NOT a conformal guarantee).

    Returns:
        {"calibrated_confidence": float, "needs_review": bool,
         "heuristic_threshold": float|None, "coverage_target": float|None}
    """
    cal = _get_conformal()
    if cal is None:
        return {
            "calibrated_confidence": raw_confidence,
            "needs_review": False,
            "conformal_threshold": None,
            "coverage": None,
        }
    return cal.calibrate(raw_confidence)

# ── App ─────────────────────────────────────────────────────────────────────
app = FastAPI(title="Album Hub Server", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ═══════════════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════════════

def _safe_filename(name: str) -> str:
    """Strip path separators from filenames."""
    return Path(name).name

def _thumb_key(key: str) -> str:
    """Derive thumbnail filename: always .webp regardless of original extension."""
    return Path(key).stem + ".webp"

def _generate_blurhash(src_path: Path) -> str | None:
    """Generate a BlurHash string (~100 bytes) from a thumbnail-sized image."""
    if not _HAS_BLURHASH:
        return None
    try:
        with Image.open(src_path) as img:
            img = ImageOps.exif_transpose(img)
            img = img.convert("RGB")
            # Use a tiny 32x32 preview for the hash — enough for blur guidance
            img.thumbnail((32, 32), Image.LANCZOS)
            width, height = img.size
            pixels = img.load()
            # Build pixel array for blurhash
            pixel_array = []
            for y in range(height):
                for x in range(width):
                    r, g, b = pixels[x, y]
                    pixel_array.append((r, g, b))
            bhash = _blurhash.encode(pixel_array, width, height, x_comp=4, y_comp=3)
            return bhash
    except Exception as e:
        print(f"[BlurHash] Failed for {src_path.name}: {e}")
        return None

def _generate_thumb(trip_dir: Path, key: str) -> tuple[str | None, str | None]:
    """Generate a 480px-wide WebP thumbnail (~33% smaller than JPEG).
    
    Returns (thumb_filename, blurhash_string).
    If WebP generation fails, falls back to JPEG.
    If blurhash generation fails, blurhash is None.
    """
    if Image is None:
        return None, None
    src = trip_dir / key
    thumbs_dir = trip_dir / "thumbs"
    thumbs_dir.mkdir(exist_ok=True)
    tkey = _thumb_key(key)
    thumb_path = thumbs_dir / tkey
    blurhash_str = None
    if thumb_path.exists():
        # Re-use existing thumb: still try to get blurhash from metadata
        return tkey, None  # blurhash will be populated from metadata if available
    try:
        with Image.open(src) as img:
            img = ImageOps.exif_transpose(img)  # Apply EXIF orientation (fix portrait→landscape)
            img = img.convert("RGB")
            # Generate blurhash from full-res before resize (more accurate colors)
            blurhash_str = _generate_blurhash_from_img(img)
            w, h = img.size
            if w > THUMB_WIDTH:
                ratio = THUMB_WIDTH / w
                img = img.resize((THUMB_WIDTH, int(h * ratio)), Image.LANCZOS)
            img.save(thumb_path, "WebP", quality=80, optimize=True)
        print(f"[Thumb] {tkey} — saved as WebP (q=80), blurhash={blurhash_str[:20] if blurhash_str else 'N/A'}...")
        return tkey, blurhash_str
    except Exception as e:
        print(f"[WARN] Thumbnail failed for {key}: {e}")
        # Fallback: try saving as JPEG
        try:
            fallback_tkey = Path(key).stem + ".jpg"
            fallback_path = thumbs_dir / fallback_tkey
            if not fallback_path.exists():
                with Image.open(src) as img:
                    img = ImageOps.exif_transpose(img)
                    img = img.convert("RGB")
                    w, h = img.size
                    if w > THUMB_WIDTH:
                        ratio = THUMB_WIDTH / w
                        img = img.resize((THUMB_WIDTH, int(h * ratio)), Image.LANCZOS)
                    img.save(fallback_path, "JPEG", quality=82, optimize=True)
                print(f"[Thumb] {fallback_tkey} — fallback to JPEG")
                return fallback_tkey, None
        except Exception as e2:
            print(f"[WARN] Thumbnail fallback also failed for {key}: {e2}")
        return None, None


def _generate_blurhash_from_img(img: Image.Image) -> str | None:
    """Generate blurhash from an already-opened PIL Image."""
    if not _HAS_BLURHASH:
        return None
    try:
        thumb = img.copy()
        thumb.thumbnail((32, 32), Image.LANCZOS)
        tw, th = thumb.size
        # blurhash.encode expects: image[y][x][r,g,b] 3D array, 0-255 sRGB integers
        pixels = [[[thumb.getpixel((x, y))[0],
                     thumb.getpixel((x, y))[1],
                     thumb.getpixel((x, y))[2]]
                    for x in range(tw)]
                   for y in range(th)]
        bhash = _blurhash.encode(pixels, components_x=4, components_y=3)
        return bhash
    except Exception as e:
        print(f"[BlurHash] encode failed: {e}")
        return None


# ═══════════════════════════════════════════════════════════════════════════════
# API Routes
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/health")
def health():
    return {"ok": True, "photo_root": str(PHOTO_ROOT), "ts": datetime.now().isoformat()}


@app.get("/api/trips")
def list_trips():
    """List all trips: merge Travel Hub data + sf-hubs-photos/ photo counts."""
    trips = []   # {id: {label, photo_count, updated, startDate, endDate, region}}
    trips_by_id = {}

    # 1. Load Travel Hub itinerary data (always show, even 0 photos)
    if ITINERARY_PATH.exists():
        try:
            itin = json.loads(ITINERARY_PATH.read_text(encoding="utf-8"))
            tid = itin["trip_id"]
            trips_by_id[tid] = {
                "id": tid,
                "label": itin.get("title", tid),
                "photo_count": 0,
                "updated": "",
                "startDate": itin.get("startDate", ""),
                "endDate": itin.get("endDate", ""),
                "region": itin.get("title", ""),
            }
        except Exception as e:
            print(f"[Trips] Failed to load itinerary: {e}")

    # 2. Merge photo counts from sf-hubs-photos/
    if PHOTO_ROOT.exists():
        for d in PHOTO_ROOT.iterdir():
            if d.is_dir() and not d.name.startswith("."):
                photo_count = len([f for f in d.glob("*") if f.suffix.lower() in ALLOWED_EXTENSIONS])
                meta = _load_meta_safe(d)
                tid = d.name
                if tid in trips_by_id:
                    trips_by_id[tid]["photo_count"] = photo_count
                    if meta.get("updated"):
                        trips_by_id[tid]["updated"] = meta["updated"]
                elif photo_count > 0:
                    # Legacy: trip with photos but not in itinerary
                    trips_by_id[tid] = {
                        "id": tid,
                        "label": meta.get("trip_label", tid),
                        "photo_count": photo_count,
                        "updated": meta.get("updated", ""),
                        "startDate": "",
                        "endDate": "",
                        "region": "",
                    }

    # 3. Sort: upcoming first, then by startDate desc
    today = datetime.now().strftime("%Y-%m-%d")
    def sort_key(t):
        dd = t.get("startDate", "0000-00-00")
        return (0 if dd >= today else 1, dd)

    return sorted(trips_by_id.values(), key=sort_key, reverse=True)


@app.get("/api/photos/{trip_id}")
def list_photos(trip_id: str):
    """List all photos in a trip, with metadata."""
    trip_dir = PHOTO_ROOT / _safe_filename(trip_id)
    if not trip_dir.exists():
        return []
    meta = _load_meta_safe(trip_dir)
    photos = []
    for f in sorted(trip_dir.glob("*"), key=lambda x: x.name):
        if f.suffix.lower() not in ALLOWED_EXTENSIONS:
            continue
        info = meta.get(f.name, {})
        tkey = _thumb_key(f.name)
        has_thumb = (trip_dir / "thumbs" / tkey).exists()
        # Check if classifier has run (has "classifier" key) vs pending (no classifier, no user day)
        classifier_done = "classifier" in info
        user_tagged = info.get("day", 0) > 0 or info.get("spot", "")
        classifying = not classifier_done and not user_tagged
        photos.append({
            "key": f.name,
            "url": f"/api/photo/{trip_id}/{f.name}",
            "thumb_url": f"/api/photo/{trip_id}/thumbs/{tkey}" if has_thumb else f"/api/photo/{trip_id}/{f.name}",
            "caption": info.get("caption", ""),
            "day": info.get("day", 0),
            "spot": info.get("spot", ""),
            "blurhash": info.get("blurhash"),
            "uploaded": info.get("uploaded", ""),
            "size": f.stat().st_size,
            "classifying": classifying,
        })
    return photos


@app.post("/api/upload/{trip_id}")
async def upload_photo(
    trip_id: str,
    file: UploadFile,
    caption: str = Form(""),
    day: int = Form(0),
    spot: str = Form(""),
):
    """Upload a photo to a trip. Generates thumbnail automatically."""
    trip_id_safe = _safe_filename(trip_id)
    trip_dir = PHOTO_ROOT / trip_id_safe
    trip_dir.mkdir(parents=True, exist_ok=True)

    # Validate extension
    ext = Path(file.filename).suffix.lower() if file.filename else ".jpg"
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"Unsupported file type: {ext}. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}")

    # Generate unique key
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    key = f"{ts}-{uuid.uuid4().hex[:8]}{ext}"

    # Read file content
    content = await file.read()
    if len(content) == 0:
        raise HTTPException(400, "Empty file")

    # Save original
    (trip_dir / key).write_bytes(content)

    # Generate thumbnail + blurhash
    thumb_key, blurhash_str = _generate_thumb(trip_dir, key)
    has_thumb = thumb_key is not None

    # Update metadata
    meta = _load_meta_safe(trip_dir)
    meta[key] = {
        "caption": caption,
        "day": day,
        "spot": spot,
        "uploaded": datetime.now().isoformat(),
        "original_name": file.filename,
    }
    if blurhash_str:
        meta[key]["blurhash"] = blurhash_str
    meta["updated"] = datetime.now().isoformat()
    meta["trip_label"] = meta.get("trip_label", trip_id_safe)
    _save_meta_safe(trip_dir, meta)

    # Auto-classify in background via executor
    filepath = str(trip_dir / key)
    _executor.submit(_classify_one, filepath, trip_id_safe, key)

    return {
        "ok": True,
        "key": key,
        "url": f"/api/photo/{trip_id_safe}/{key}",
        "thumb_url": f"/api/photo/{trip_id_safe}/thumbs/{_thumb_key(key)}" if has_thumb else None,
        "size": len(content),
    }


@app.get("/api/photo/{trip_id}/{key:path}")
def get_photo(trip_id: str, key: str):
    """Serve a photo file (original or thumbnail). Anti-traversal: resolve + containment check."""
    trip_dir = PHOTO_ROOT / _safe_filename(trip_id)
    safe_key = _safe_filename(key)
    if key.startswith("thumbs/"):
        file_path = (trip_dir / "thumbs" / safe_key.replace("thumbs/", "", 1)).resolve()
    else:
        file_path = (trip_dir / safe_key).resolve()

    # Anti-path-traversal: ensure resolved path stays within PHOTO_ROOT
    photo_root_resolved = PHOTO_ROOT.resolve()
    if not str(file_path).startswith(str(photo_root_resolved)):
        raise HTTPException(403, "Access denied")

    if not file_path.is_file():
        # For thumbnail requests, fallback: if key is not .jpg, try _thumb_key()
        if key.startswith("thumbs/") and not key.lower().endswith(".jpg"):
            alt_key = key.split("/", 1)[1]
            alt_tkey = _thumb_key(alt_key)
            alt_path = (trip_dir / "thumbs" / alt_tkey).resolve()
            if str(alt_path).startswith(str(photo_root_resolved)) and alt_path.is_file():
                return FileResponse(alt_path, headers={
                    "Cache-Control": "public, max-age=31536000, immutable",
                })
        raise HTTPException(404, "Photo not found")

    # Thumbnails are immutable — cache aggressively
    if key.startswith("thumbs/"):
        # Infer MIME type from extension for correct Content-Type header
        ext = Path(file_path).suffix.lower()
        media_type_map = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".gif": "image/gif",
            ".webp": "image/webp",
            ".avif": "image/avif",
        }
        media_type = media_type_map.get(ext, "image/jpeg")
        return FileResponse(
            file_path,
            media_type=media_type,
            headers={"Cache-Control": "public, max-age=31536000, immutable"},
        )
    return FileResponse(file_path)


@app.delete("/api/photo/{trip_id}/{key}")
def soft_delete_photo(trip_id: str, key: str):
    """Soft-delete: move to .trash/ with deleted_at timestamp. Undoable for 30s."""
    trip_dir = PHOTO_ROOT / _safe_filename(trip_id)
    safe_key = _safe_filename(key)
    photo_path = trip_dir / safe_key
    tkey = _thumb_key(safe_key)
    thumb_path = trip_dir / "thumbs" / tkey

    if not photo_path.exists():
        raise HTTPException(404, "Photo not found")

    trash_dir = trip_dir / ".trash"
    trash_dir.mkdir(exist_ok=True)

    # Move original to trash
    trash_path = trash_dir / safe_key
    photo_path.rename(trash_path)

    # Move thumbnail if exists
    thumb_trashed = False
    if thumb_path.exists():
        trash_thumb_dir = trash_dir / "thumbs"
        trash_thumb_dir.mkdir(exist_ok=True)
        thumb_path.rename(trash_thumb_dir / safe_key)
        thumb_trashed = True

    # Mark metadata as deleted (keep it for restore)
    meta = _load_meta_safe(trip_dir)
    if safe_key in meta:
        meta[f".trash:{safe_key}"] = {
            "deleted_at": datetime.now().isoformat(),
            **meta.pop(safe_key),
        }
    meta["updated"] = datetime.now().isoformat()
    _save_meta_safe(trip_dir, meta)

    remaining = [f for f in trip_dir.glob("*") if f.suffix.lower() in ALLOWED_EXTENSIONS]

    return {
        "ok": True,
        "deleted": "soft",
        "key": safe_key,
        "remaining": len(remaining),
        "thumb_trashed": thumb_trashed,
    }


@app.post("/api/photo/{trip_id}/{key}/restore")
def restore_photo(trip_id: str, key: str):
    """Restore a soft-deleted photo from .trash/ back to trip folder."""
    trip_dir = PHOTO_ROOT / _safe_filename(trip_id)
    safe_key = _safe_filename(key)
    trash_dir = trip_dir / ".trash"
    trash_path = trash_dir / safe_key

    if not trash_path.exists():
        raise HTTPException(404, "Photo not found in trash (may already be permanently deleted)")

    # Move back to trip root
    dest_path = trip_dir / safe_key
    trash_path.rename(dest_path)

    # Restore thumbnail
    trash_thumb = trash_dir / "thumbs" / _thumb_key(safe_key)
    if trash_thumb.exists():
        thumbs_dir = trip_dir / "thumbs"
        thumbs_dir.mkdir(exist_ok=True)
        trash_thumb.rename(thumbs_dir / _thumb_key(safe_key))

    # Restore metadata
    meta = _load_meta_safe(trip_dir)
    trash_key = f".trash:{safe_key}"
    if trash_key in meta:
        trashed = meta.pop(trash_key)
        del trashed["deleted_at"]
        meta[safe_key] = trashed
    meta["updated"] = datetime.now().isoformat()
    _save_meta_safe(trip_dir, meta)

    remaining = [f for f in trip_dir.glob("*") if f.suffix.lower() in ALLOWED_EXTENSIONS]
    # Auto-classify in background (photo restored, so classify it)
    trip_id_safe = _safe_filename(trip_id)
    filepath = str(trip_dir / safe_key)
    threading.Thread(target=_classify_async, args=(filepath, trip_id_safe, safe_key), daemon=True).start()

    return {"ok": True, "key": safe_key, "remaining": len(remaining)}


@app.get("/api/trash/{trip_id}")
def list_trash(trip_id: str):
    """List soft-deleted photos in .trash/ for a trip."""
    trip_dir = PHOTO_ROOT / _safe_filename(trip_id)
    trash_dir = trip_dir / ".trash"
    if not trash_dir.exists():
        return []

    meta = _load_meta_safe(trip_dir)
    items = []
    for f in sorted(trash_dir.glob("*"), key=lambda x: x.name):
        if f.is_dir() or f.suffix.lower() not in ALLOWED_EXTENSIONS:
            continue
        trashed_meta = meta.get(f".trash:{f.name}", {})
        items.append({
            "key": f.name,
            "deleted_at": trashed_meta.get("deleted_at", ""),
            "original_name": trashed_meta.get("original_name", ""),
            "caption": trashed_meta.get("caption", ""),
            "size": f.stat().st_size,
        })
    return items


@app.delete("/api/trash/{trip_id}/{key}")
def permanent_delete_photo(trip_id: str, key: str):
    """Permanently delete a photo from .trash/ (cannot be undone)."""
    trip_dir = PHOTO_ROOT / _safe_filename(trip_id)
    safe_key = _safe_filename(key)
    trash_dir = trip_dir / ".trash"
    trash_path = trash_dir / safe_key
    trash_thumb = trash_dir / "thumbs" / _thumb_key(safe_key)

    deleted = []
    if trash_path.exists():
        trash_path.unlink()
        deleted.append("original")
    if trash_thumb.exists():
        trash_thumb.unlink()
        deleted.append("thumbnail")

    # Clean up emptied directories
    for d in [trash_dir / "thumbs", trash_dir]:
        try:
            if d.exists() and not any(d.iterdir()):
                d.rmdir()
        except OSError:
            pass

    # Remove trash metadata entry
    meta = _load_meta_safe(trip_dir)
    trash_key = f".trash:{safe_key}"
    if trash_key in meta:
        del meta[trash_key]
    meta["updated"] = datetime.now().isoformat()
    _save_meta_safe(trip_dir, meta)

    return {"ok": True, "permanently_deleted": deleted, "key": safe_key}


# ═══════════════════════════════════════════════════════════════════════════════
# Classifier API
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/api/classify/{trip_id}/{key}")
def classify_photo_endpoint(trip_id: str, key: str):
    """Run classifier on an already-uploaded photo (on-demand, via executor)."""
    trip_dir = PHOTO_ROOT / _safe_filename(trip_id)
    safe_key = _safe_filename(key)
    filepath = trip_dir / safe_key
    if not filepath.exists():
        raise HTTPException(404, "Photo not found")

    # Submit to bounded executor (ensures at most 2 concurrent Ollama calls)
    future = _executor.submit(_classify_one, str(filepath), _safe_filename(trip_id), safe_key)
    classifier_meta = future.result(timeout=180)  # 3 min timeout per photo

    return {"ok": True, "classifier": classifier_meta}


@app.post("/api/classify-all/{trip_id}")
def classify_all_photos(trip_id: str):
    """Batch classify all photos in a trip — submits all and returns immediately.
    
    Returns a tracking ID. Poll GET /api/classify-progress/{trip_id} for progress.

    Query params (future use via Pydantic model):
      force: bool = query param (default False)
    """
    trip_dir = PHOTO_ROOT / _safe_filename(trip_id)
    if not trip_dir.exists():
        raise HTTPException(404, "Trip not found")

    trip_id_safe = _safe_filename(trip_id)
    photos = sorted(
        [f for f in trip_dir.glob("*") if f.suffix.lower() in ALLOWED_EXTENSIONS],
        key=lambda x: x.name,
    )

    if not photos:
        return {"ok": True, "total": 0, "results": []}

    # Init progress tracker
    _init_progress(trip_id_safe, len(photos))

    # Submit all to executor at once (true parallelism up to max_workers=2)
    for photo_path in photos:
        key = photo_path.name
        _executor.submit(
            _classify_one, str(photo_path), trip_id_safe, key,
            lambda k, s: _update_progress(trip_id_safe, k, s)
        )

    return {
        "ok": True,
        "total": len(photos),
        "trip_id": trip_id_safe,
        "status": "running",
        "progress_url": f"/api/classify-progress/{trip_id_safe}",
    }


@app.get("/api/classify-progress/{trip_id}")
def get_classify_progress(trip_id: str):
    """Get progress of a running classify-all batch."""
    trip_id_safe = _safe_filename(trip_id)
    pb = _get_progress(trip_id_safe)
    if pb is None:
        # No progress record — check if there's anything to classify
        trip_dir = PHOTO_ROOT / trip_id_safe
        if not trip_dir.exists():
            raise HTTPException(404, "Trip not found")
        return {
            "ok": True,
            "trip_id": trip_id_safe,
            "status": "idle",
            "total": 0,
            "done": 0,
            "errors": 0,
            "pct": 0,
            "results": [],
        }

    total = pb["total"]
    done = pb["done"]
    errors = pb["errors"]
    pct = (done + errors) / total * 100 if total > 0 else 0

    status = "running"
    if pb["finished"] is not None:
        elapsed = round(pb["finished"] - pb["started"], 1)
        status = f"finished ({elapsed}s)"

    return {
        "ok": True,
        "trip_id": trip_id_safe,
        "status": status,
        "total": total,
        "done": done,
        "errors": errors,
        "pct": round(pct, 1),
        "results": sorted(pb.get("results", []), key=lambda r: r["key"]),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# Update Photo Metadata (PATCH)
# ═══════════════════════════════════════════════════════════════════════════════

@app.patch("/api/photo/{trip_id}/{key:path}")
def update_photo_meta(trip_id: str, key: str, body: dict = Body(None)):
    """Update photo metadata via JSON body.

    Accepts JSON body with any subset of: day, spot, caption.
    Only provided fields are updated.
    Example: {"day": 3, "caption": "Osaka Castle in autumn"}
    """
    body = body or {}
    trip_dir = PHOTO_ROOT / _safe_filename(trip_id)
    safe_key = _safe_filename(key)
    photo_path = trip_dir / safe_key
    if not photo_path.exists():
        raise HTTPException(404, "Photo not found")

    # Use _load_meta_safe (cached) then write under lock
    def _apply(entry):
        if "day" in body:
            entry["day"] = body["day"]
        elif "day" not in entry:
            entry["day"] = 0

        if "spot" in body:
            entry["spot"] = body["spot"]
        elif "spot" not in entry:
            entry["spot"] = "unknown"

        if "caption" in body:
            entry["caption"] = body["caption"]

        return entry

    meta = _atomic_update_meta(trip_dir, safe_key, _apply)
    entry = meta.get(safe_key, {})
    return {
        "ok": True,
        "key": safe_key,
        "day": entry.get("day", 0),
        "spot": entry.get("spot", ""),
        "caption": entry.get("caption", ""),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# Startup
# ═══════════════════════════════════════════════════════════════════════════════

@app.on_event("startup")
def startup():
    PHOTO_ROOT.mkdir(parents=True, exist_ok=True)
    print(f"[Album Server] Photo root: {PHOTO_ROOT}")
    print(f"[Album Server] Thumbnails: {'enabled' if Image else 'disabled (install Pillow)'}")


def main():
    parser = argparse.ArgumentParser(description="Album Hub Photo Server")
    parser.add_argument("--port", type=int, default=5300, help="Listen port (default: 5300)")
    parser.add_argument("--reload", action="store_true", help="Enable auto-reload (dev mode)")
    args = parser.parse_args()

    print(f"[Album Server] Starting on http://127.0.0.1:{args.port}")
    uvicorn.run(
        "album_server:app" if args.reload else app,
        host="127.0.0.1",
        port=args.port,
        reload=args.reload,
        log_level="info",
    )

if __name__ == "__main__":
    main()
