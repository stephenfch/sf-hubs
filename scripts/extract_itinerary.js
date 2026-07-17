// Extract itinerary JSON from hubs/travel/data.js for album_classifier.
// Usage: node scripts/extract_itinerary.js
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const DATA_JS = path.join(__dirname, '..', 'hubs', 'travel', 'data.js');
const OUT_JSON = path.join(__dirname, '..', 'data', 'osaka-2026.json');

const code = fs.readFileSync(DATA_JS, 'utf-8');
const sandbox = { window: {}, console, module: { exports: {} } };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const trip = sandbox.window.TRAVEL_DATA.trips[0];

function cleanTitle(t) {
    return (t || '').replace(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}]\s*/u, '').trim();
}

const result = {
    trip_id: trip.id,
    title: trip.title,
    startDate: trip.startDate,
    endDate: trip.endDate,
    weatherCoords: trip.weatherCoords || {},
    days: (trip.days || []).map(d => ({
        day: d.day,
        date: d.date,
        weekday: d.weekday || '',
        title: d.title || '',
        location: d.location || '',
        hotel: d.hotel || '',
        spots: (d.items || []).map(it => cleanTitle(it.title)).filter(Boolean),
    })),
};

fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
fs.writeFileSync(OUT_JSON, JSON.stringify(result, null, 2), 'utf-8');

console.log(`Extracted ${result.days.length} days for trip: ${result.trip_id}`);
console.log(`Written: ${OUT_JSON} (${fs.statSync(OUT_JSON).size} bytes)`);

result.days.forEach(d => {
    console.log(`  Day ${d.day}: ${d.date} — ${d.title.substring(0, 50)} (${d.spots.length} spots)`);
    d.spots.slice(0, 3).forEach(s => console.log(`    - ${s}`));
});
