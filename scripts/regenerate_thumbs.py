"""Regenerate all thumbnails with .jpg extension."""
from pathlib import Path
import shutil

from pillow_heif import register_heif_opener
register_heif_opener()
from PIL import Image

PHOTO_ROOT = Path(r"C:\Users\Win 11\sf-hubs-photos")
THUMB_WIDTH = 480
ALLOWED = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"}

def thumb_key(key: str) -> str:
    return Path(key).stem + ".jpg"

for trip_dir in sorted(PHOTO_ROOT.iterdir()):
    if not trip_dir.is_dir() or trip_dir.name.startswith("."):
        continue
    thumbs_dir = trip_dir / "thumbs"
    if thumbs_dir.exists():
        shutil.rmtree(thumbs_dir)
    thumbs_dir.mkdir(exist_ok=True)
    count_ok = 0
    count_fail = 0
    for f in sorted(trip_dir.glob("*")):
        if f.suffix.lower() not in ALLOWED:
            continue
        tkey = thumb_key(f.name)
        thumb_path = thumbs_dir / tkey
        try:
            with Image.open(f) as img:
                img = img.convert("RGB")
                w, h = img.size
                if w > THUMB_WIDTH:
                    ratio = THUMB_WIDTH / w
                    img = img.resize((THUMB_WIDTH, int(h * ratio)), Image.LANCZOS)
                img.save(thumb_path, "JPEG", quality=82, optimize=True)
            count_ok += 1
            print(f"  ✅ {f.name}  ->  {tkey}")
        except Exception as e:
            count_fail += 1
            print(f"  ❌ {f.name}: {e}")
    print(f"  [{trip_dir.name}] OK={count_ok} FAIL={count_fail}\n")
print("Done! All thumbnails regenerated as .jpg")
