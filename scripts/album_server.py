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

import argparse, json, os, sys, uuid, threading
from datetime import datetime
from pathlib import Path

try:
    from fastapi import FastAPI, UploadFile, Form, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import FileResponse
    import uvicorn
except ImportError as e:
    sys.exit(f"Missing dependency: {e}\nRun: pip install fastapi uvicorn python-multipart pillow")

try:
    from PIL import Image
except ImportError:
    Image = None
    print("[WARN] Pillow not installed — thumbnails disabled. Run: pip install pillow")

# ── Config ──────────────────────────────────────────────────────────────────
PHOTO_ROOT = Path(r"C:\Users\Win 11\sf-hubs-photos")
THUMB_WIDTH = 480
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".heic", ".heif"}
ITINERARY_PATH = Path(__file__).resolve().parent.parent / "data" / "osaka-2026.json"

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


def _classify_async(filepath: str, trip_id: str, key: str):
    """Background thread: classify photo and update metadata."""
    try:
        classifier, itinerary = _get_classifier()
        if not itinerary.get("days"):
            return

        def _llm_call(prompt: str) -> str:
            """Call Ollama Local_LLM."""
            import urllib.request
            payload = json.dumps({
                "model": "qwen2.5:7b",
                "prompt": prompt,
                "stream": False,
                "options": {"temperature": 0.1, "num_predict": 200},
            }).encode("utf-8")
            req = urllib.request.Request(
                "http://127.0.0.1:11434/api/generate",
                data=payload,
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                return data.get("response", "")

        result = classifier.classify_photo(filepath, itinerary, llm_call=_llm_call)
        if result.get("day") or result.get("spot"):
            trip_dir = PHOTO_ROOT / trip_id
            meta = _load_meta(trip_dir)
            if key in meta:
                meta[key]["day"] = result.get("day", meta[key].get("day", 0))
                meta[key]["spot"] = result.get("spot", meta[key].get("spot", ""))
                meta[key]["classifier"] = {
                    "method": result.get("method", ""),
                    "confidence": result.get("confidence", 0),
                }
                _save_meta(trip_dir, meta)
                print(f"[Classifier] Tagged {key}: day={result['day']}, spot={result['spot']} ({result.get('confidence', 0):.0%})")
    except Exception as e:
        print(f"[Classifier] Async classify failed for {key}: {e}")

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

def _load_meta(trip_dir: Path) -> dict:
    """Load metadata.json for a trip directory."""
    meta_file = trip_dir / "metadata.json"
    if meta_file.exists():
        try:
            return json.loads(meta_file.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            pass
    return {}

def _save_meta(trip_dir: Path, meta: dict) -> None:
    """Save metadata.json atomically."""
    meta_file = trip_dir / "metadata.json"
    tmp = trip_dir / "metadata.json.tmp"
    tmp.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(meta_file)  # atomic on Windows if same volume

def _generate_thumb(trip_dir: Path, key: str) -> str | None:
    """Generate a 480px-wide thumbnail. Returns thumb filename or None."""
    if Image is None:
        return None
    src = trip_dir / key
    thumbs_dir = trip_dir / "thumbs"
    thumbs_dir.mkdir(exist_ok=True)
    thumb_path = thumbs_dir / key
    if thumb_path.exists():
        return key  # already generated
    try:
        with Image.open(src) as img:
            img = img.convert("RGB")
            w, h = img.size
            if w > THUMB_WIDTH:
                ratio = THUMB_WIDTH / w
                img = img.resize((THUMB_WIDTH, int(h * ratio)), Image.LANCZOS)
            img.save(thumb_path, "JPEG", quality=82, optimize=True)
        return key
    except Exception as e:
        print(f"[WARN] Thumbnail failed for {key}: {e}")
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
                meta = _load_meta(d)
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
    meta = _load_meta(trip_dir)
    photos = []
    for f in sorted(trip_dir.glob("*"), key=lambda x: x.name):
        if f.suffix.lower() not in ALLOWED_EXTENSIONS:
            continue
        info = meta.get(f.name, {})
        has_thumb = (trip_dir / "thumbs" / f.name).exists()
        photos.append({
            "key": f.name,
            "url": f"/api/photo/{trip_id}/{f.name}",
            "thumb_url": f"/api/photo/{trip_id}/thumbs/{f.name}" if has_thumb else f"/api/photo/{trip_id}/{f.name}",
            "caption": info.get("caption", ""),
            "day": info.get("day", 0),
            "spot": info.get("spot", ""),
            "uploaded": info.get("uploaded", ""),
            "size": f.stat().st_size,
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

    # Generate thumbnail
    has_thumb = _generate_thumb(trip_dir, key)

    # Update metadata
    meta = _load_meta(trip_dir)
    meta[key] = {
        "caption": caption,
        "day": day,
        "spot": spot,
        "uploaded": datetime.now().isoformat(),
        "original_name": file.filename,
    }
    meta["updated"] = datetime.now().isoformat()
    meta["trip_label"] = meta.get("trip_label", trip_id_safe)
    _save_meta(trip_dir, meta)

    # Auto-classify in background
    filepath = str(trip_dir / key)
    threading.Thread(target=_classify_async, args=(filepath, trip_id_safe, key), daemon=True).start()

    return {
        "ok": True,
        "key": key,
        "url": f"/api/photo/{trip_id_safe}/{key}",
        "thumb_url": f"/api/photo/{trip_id_safe}/thumbs/{key}" if has_thumb else None,
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
        raise HTTPException(404, "Photo not found")
    return FileResponse(file_path)


@app.delete("/api/photo/{trip_id}/{key}")
def soft_delete_photo(trip_id: str, key: str):
    """Soft-delete: move to .trash/ with deleted_at timestamp. Undoable for 30s."""
    trip_dir = PHOTO_ROOT / _safe_filename(trip_id)
    safe_key = _safe_filename(key)
    photo_path = trip_dir / safe_key
    thumb_path = trip_dir / "thumbs" / safe_key

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
    meta = _load_meta(trip_dir)
    if safe_key in meta:
        meta[f".trash:{safe_key}"] = {
            "deleted_at": datetime.now().isoformat(),
            **meta.pop(safe_key),
        }
    meta["updated"] = datetime.now().isoformat()
    _save_meta(trip_dir, meta)

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
    trash_thumb = trash_dir / "thumbs" / safe_key
    if trash_thumb.exists():
        thumbs_dir = trip_dir / "thumbs"
        thumbs_dir.mkdir(exist_ok=True)
        trash_thumb.rename(thumbs_dir / safe_key)

    # Restore metadata
    meta = _load_meta(trip_dir)
    trash_key = f".trash:{safe_key}"
    if trash_key in meta:
        trashed = meta.pop(trash_key)
        del trashed["deleted_at"]
        meta[safe_key] = trashed
    meta["updated"] = datetime.now().isoformat()
    _save_meta(trip_dir, meta)

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

    meta = _load_meta(trip_dir)
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
    trash_thumb = trash_dir / "thumbs" / safe_key

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
    meta = _load_meta(trip_dir)
    trash_key = f".trash:{safe_key}"
    if trash_key in meta:
        del meta[trash_key]
    meta["updated"] = datetime.now().isoformat()
    _save_meta(trip_dir, meta)

    return {"ok": True, "permanently_deleted": deleted, "key": safe_key}


# ═══════════════════════════════════════════════════════════════════════════════
# Classifier API
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/api/classify/{trip_id}/{key}")
def classify_photo_endpoint(trip_id: str, key: str):
    """Run classifier on an already-uploaded photo (on-demand)."""
    trip_dir = PHOTO_ROOT / _safe_filename(trip_id)
    safe_key = _safe_filename(key)
    filepath = trip_dir / safe_key
    if not filepath.exists():
        raise HTTPException(404, "Photo not found")

    classifier, itinerary = _get_classifier()

    def _llm_call(prompt: str) -> str:
        import urllib.request
        payload = json.dumps({
            "model": "qwen2.5:7b",
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.1, "num_predict": 200},
        }).encode("utf-8")
        req = urllib.request.Request(
            "http://127.0.0.1:11434/api/generate",
            data=payload,
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("response", "")

    result = classifier.classify_photo(str(filepath), itinerary, llm_call=_llm_call)

    # Update metadata
    if result.get("day") or result.get("spot"):
        meta = _load_meta(trip_dir)
        if safe_key in meta:
            meta[safe_key]["day"] = result.get("day", meta[safe_key].get("day", 0))
            meta[safe_key]["spot"] = result.get("spot", meta[safe_key].get("spot", ""))
            meta[safe_key]["classifier"] = {
                "method": result.get("method", ""),
                "confidence": result.get("confidence", 0),
            }
            _save_meta(trip_dir, meta)

    return {"ok": True, "result": result}


@app.post("/api/classify-all/{trip_id}")
def classify_all_photos(trip_id: str):
    """Batch re-classify all photos in a trip (useful after itinerary updates)."""
    trip_dir = PHOTO_ROOT / _safe_filename(trip_id)
    if not trip_dir.exists():
        raise HTTPException(404, "Trip not found")

    photos = [f for f in trip_dir.glob("*") if f.suffix.lower() in ALLOWED_EXTENSIONS]
    results = []
    for photo_path in photos:
        threading.Thread(
            target=_classify_async,
            args=(str(photo_path), _safe_filename(trip_id), photo_path.name),
            daemon=True,
        ).start()
        results.append({"key": photo_path.name, "status": "queued"})

    return {"ok": True, "queued": len(results), "photos": results}


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
