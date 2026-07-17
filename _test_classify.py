#!/usr/bin/env python3
"""Quick test of album classifier — run standalone"""
import sys
sys.path.insert(0, r"C:\Users\Win 11\Desktop\sf-hubs\scripts")
sys.path.insert(0, r"C:\Users\Win 11\Desktop\sf-hubs")

import album_classifier
import json
from pathlib import Path

# Load itinerary
itin_path = Path(r"C:\Users\Win 11\Desktop\sf-hubs\data\osaka-2026.json")
itinerary = json.loads(itin_path.read_text(encoding="utf-8"))

# Test with real photo
photos_dir = Path(r"C:\Users\Win 11\sf-hubs-photos\osaka-2026")
photos = sorted([p for p in photos_dir.glob("*") if p.suffix.lower() in ('.jpg','.jpeg','.png','.webp')])
if photos:
    test_photo = str(photos[0])
    print(f"Testing with: {test_photo}")
    
    # Extract EXIF
    exif = album_classifier.extract_exif(test_photo)
    print(f"EXIF: {json.dumps(exif, default=str)}")
    
    # Match date
    if exif["datetime"]:
        matched_days = album_classifier.match_date(exif["datetime"], itinerary)
        print(f"Matched days: {matched_days}")
    
    # Match GPS
    if exif["lat"] and exif["lon"]:
        matched = album_classifier.match_gps(exif["lat"], exif["lon"], itinerary)
        print(f"GPS matches: {json.dumps(matched[:3], default=str)}")
    
    # Full classify with mock LLM
    import urllib.request
    def test_llm(prompt):
        try:
            req = urllib.request.Request(
                "http://127.0.0.1:11434/api/generate",
                data=json.dumps({"model":"qwen2.5:7b","prompt":prompt,"stream":False,"options":{"temperature":0.1,"num_predict":200}}).encode("utf-8"),
                headers={"Content-Type":"application/json"}
            )
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode()).get("response","")
        except Exception as e:
            print(f"Ollama error: {e}")
            return ""
    
    result = album_classifier.classify_photo(test_photo, itinerary, llm_call=test_llm)
    print(f"Result: {json.dumps(result, default=str)}")
else:
    print("No photos found in osaka-2026")
    print(f"Dir contents: {list(photos_dir.iterdir())}")
