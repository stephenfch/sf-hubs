"""Regenerate all thumbnails for a trip with EXIF orientation fix applied.
Also generates blurhash placeholders for new photos.

Usage:
  python scripts/regenerate_thumbs.py [trip_id] [--force]
  python scripts/regenerate_thumbs.py osaka-2026 --force
"""
import argparse, sys
sys.path.insert(0, r"C:\Users\Win 11\Desktop\sf-hubs\scripts")
from album_server import PHOTO_ROOT, _generate_thumb, _thumb_key, ALLOWED_EXTENSIONS, _load_meta_safe, _save_meta_safe

parser = argparse.ArgumentParser()
parser.add_argument("trip_id", nargs="?", default="osaka-2026")
parser.add_argument("--force", action="store_true", help="Overwrite existing thumbnails")
args = parser.parse_args()

trip_dir = PHOTO_ROOT / args.trip_id
if not trip_dir.exists():
    sys.exit(f"Trip not found: {trip_dir}")

photos = sorted([f for f in trip_dir.glob("*") if f.suffix.lower() in ALLOWED_EXTENSIONS],
                key=lambda x: x.name)

meta = _load_meta_safe(trip_dir)
print(f"Found {len(photos)} photos in {trip_dir}")
regenerated = deleted = skipped = failed = blurhash_added = 0

for p in photos:
    thumb_path = trip_dir / "thumbs" / _thumb_key(p.name)
    if thumb_path.exists():
        if args.force:
            thumb_path.unlink()
            deleted += 1
        else:
            # Even if thumb exists, check if blurhash is missing from metadata
            entry = meta.get(p.name, {})
            if entry.get("blurhash"):
                print(f"  SKIP (exists + has blurhash): {p.name}")
                skipped += 1
                continue
            else:
                print(f"  EXISTS but no blurhash — regenerating thumb for blurhash: {p.name}")
                thumb_path.unlink()
                deleted += 1
    result, blurhash_str = _generate_thumb(trip_dir, p.name)
    if result:
        if blurhash_str:
            if p.name not in meta:
                meta[p.name] = {}
            meta[p.name]["blurhash"] = blurhash_str
            blurhash_added += 1
        print(f"  OK: {p.name} -> {result}" + (f" + blurhash" if blurhash_str else ""))
        regenerated += 1
    else:
        print(f"  FAIL: {p.name}")
        failed += 1

if blurhash_added > 0:
    _save_meta_safe(trip_dir, meta)
    print(f"  → Saved {blurhash_added} blurhash entries to metadata.json")

print(f"\nDone: {regenerated} regenerated, {deleted} deleted-old, {skipped} skipped, {failed} failed, {blurhash_added} blurhash added")
