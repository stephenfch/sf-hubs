#!/usr/bin/env python3
"""
Extract itinerary JSON from hubs/travel/data.js for album_classifier.
Uses Node.js to eval TRAVEL_DATA since it's valid JS.
"""
import json, subprocess, sys
from pathlib import Path

DATA_JS = Path(__file__).resolve().parent.parent / "hubs" / "travel" / "data.js"
OUT_JSON = Path(__file__).resolve().parent.parent / "data" / "osaka-2026.json"

# Node.js script that loads the JS file, extracts the first trip, outputs JSON
NODE_SCRIPT = f"""
const fs = require('fs');
const vm = require('vm');

// Load data.js as a CommonJS module
const code = fs.readFileSync({json.dumps(str(DATA_JS))}, 'utf-8');
const sandbox = {{ window: {{}}, console, module: {{ exports: {{}} }} }};
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const trips = sandbox.window.TRAVEL_DATA.trips;
const trip = trips[0];

function cleanTitle(t) {{
    return (t || '').replace(/^[\\u{1F300}-\\u{1F9FF}\\u{2600}-\\u{26FF}\\u{2700}-\\u{27BF}\\u{1F600}-\\u{1F64F}]\\s*/u, '').trim();
}}

const result = {{
    trip_id: trip.id,
    title: trip.title,
    startDate: trip.startDate,
    endDate: trip.endDate,
    weatherCoords: trip.weatherCoords || {{}},
    days: (trip.days || []).map(d => ({{
        day: d.day,
        date: d.date,
        weekday: d.weekday || '',
        title: d.title || '',
        location: d.location || '',
        hotel: d.hotel || '',
        spots: (d.items || []).map(it => cleanTitle(it.title)).filter(Boolean),
    }})),
}};

console.log(JSON.stringify(result, null, 2));
"""

def main():
    print(f"Reading: {DATA_JS}")
    proc = subprocess.run(
        ["node", "-e", NODE_SCRIPT],
        capture_output=True, text=True, timeout=10,
    )
    if proc.returncode != 0:
        print("STDERR:", proc.stderr, file=sys.stderr)
        sys.exit(1)

    data = json.loads(proc.stdout)
    print(f"Extracted {len(data['days'])} days for trip: {data['trip_id']}")

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Written: {OUT_JSON} ({OUT_JSON.stat().st_size} bytes)")

    # Also print sample
    for d in data["days"]:
        print(f"  Day {d['day']}: {d['date']} — {d['title'][:50]} ({len(d['spots'])} spots)")
        for s in d["spots"][:3]:
            print(f"    - {s}")

if __name__ == "__main__":
    main()
