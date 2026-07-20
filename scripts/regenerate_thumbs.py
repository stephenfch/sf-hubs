"""Regenerate all thumbnails for a trip with EXIF orientation fix applied.
Usage:
  python scripts/regenerate_thumbs.py [trip_id] [--force]
  python scripts/regenerate_thumbs.py osaka-2026 --force
"""
import argparse, sys
sys.path.insert(0, r"C:\Users\Win 11\Desktop\sf-hubs\scripts")
from album_server import PHOTO_ROOT, _generate_thumb, _thumb_key, ALLOWED_EXTENSIONS

parser = argparse.ArgumentParser()
parser.add_argument("trip_id", nargs="?", default="osaka-2026")
parser.add_argument("--force", action="store_true", help="Overwrite existing thumbnails")
args = parser.parse_args()

trip_dir = PHOTO_ROOT / args.trip_id
if not trip_dir.exists():
    sys.exit(f"Trip not found: {trip_dir}")

photos = sorted([f for f in trip_dir.glob("*") if f.suffix.lower() in ALLOWED_EXTENSIONS],
                key=lambda x: x.name)

print(f"Found {len(photos)} photos in {trip_dir}")
regenerated = deleted = skipped = failed = 0

for p in photos:
    thumb_path = trip_dir / "thumbs" / _thumb_key(p.name)
    if thumb_path.exists():
        if args.force:
            thumb_path.unlink()
            deleted += 1
        else:
            print(f"  SKIP (exists): {p.name}")
            skipped += 1
            continue
    result = _generate_thumb(trip_dir, p.name)
    if result:
        print(f"  OK: {p.name} -> {result}")
        regenerated += 1
    else:
        print(f"  FAIL: {p.name}")
        failed += 1

print(f"\nDone: {regenerated} regenerated, {deleted} deleted-old, {skipped} skipped, {failed} failed")
