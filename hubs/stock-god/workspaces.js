// ── Workspaces tab ────────────────────────────────────────

let currentWorkspace = null;
let currentScan = null;
let selectedItems = new Set();

function formatMB(mb) {
    const n = parseFloat(mb);
    if (isNaN(n)) return "-";
    if (n >= 1024) return (n / 1024).toFixed(2) + " GB";
    if (n >= 1) return n.toFixed(1) + " MB";
    return (n * 1024).toFixed(0) + " KB";
}

async function loadWorkspacesList() {
    try {
        const r = await fetch(`${API}/workspace/list`);
        if (!r.ok) throw new Error("HTTP " + r.status);
        const d = await r.json();
        renderWorkspacesList(d.workspaces);
    } catch (e) {
        $("workspaces-list").innerHTML = `<div class="text-red-400">Error: ${e.message}</div>`;
    }
}

async function renderWorkspacesList(workspaces) {
    // For each workspace, get owner + scan summary (parallel)
    const cards = workspaces.map(async (name) => {
        let owner = "—";
        try {
            const r = await fetch(`${API}/workspace/${encodeURIComponent(name)}/owner`);
            if (r.ok) {
                const d = await r.json();
                owner = d.agent_id || "—";
            }
        } catch { /* ignore */ }
        return { name, owner };
    });
    const resolved = await Promise.all(cards);
    const el = $("workspaces-list");
    el.innerHTML = resolved.map(w => `
        <div class="card cursor-pointer hover:border-blue-500" onclick="openWorkspace('${w.name}')">
            <div class="font-semibold">${escapeHtml(w.name)}</div>
            <div class="text-xs text-slate-400 mt-1">owner: <span class="text-blue-300">${escapeHtml(w.owner)}</span></div>
            <div class="text-xs text-slate-500 mt-2">Click to scan →</div>
        </div>
    `).join("");
}

async function openWorkspace(name) {
    currentWorkspace = name;
    $("workspace-detail").classList.remove("hidden");
    $("workspace-detail").innerHTML = `<div class="text-slate-400">Scanning ${escapeHtml(name)}…</div>`;
    try {
        const r = await fetch(`${API}/workspace/${encodeURIComponent(name)}/scan?max_files=200`);
        if (!r.ok) throw new Error("HTTP " + r.status);
        currentScan = await r.json();
        if (currentScan.error) {
            $("workspace-detail").innerHTML = `<div class="text-red-400">${currentScan.error}</div>`;
            return;
        }
        renderWorkspaceDetail(currentScan);
    } catch (e) {
        $("workspace-detail").innerHTML = `<div class="text-red-400">Error: ${e.message}</div>`;
    }
}

function renderWorkspaceDetail(scan) {
    const cats = scan.categories;
    const totalSafe = cats.safe.length;
    const totalYellow = cats.yellow.length;
    const totalOrange = cats.orange.length;
    selectedItems.clear();

    const html = `
        <div class="flex justify-between items-center mb-3">
            <h3 class="text-xl font-bold">${escapeHtml(scan.workspace)}</h3>
            <div class="text-sm text-slate-400">
                ${scan.total_files} files · ${formatMB(scan.total_size_mb)}
            </div>
        </div>

        <div class="grid grid-cols-3 gap-3 mb-4">
            ${categoryCard("🟢 Safe (auto)", cats.safe, "safe", "border-green-700", "bg-green-900/30")}
            ${categoryCard("🟡 Yellow (debug)", cats.yellow, "yellow", "border-yellow-700", "bg-yellow-900/30")}
            ${categoryCard("🟠 Orange (backup)", cats.orange, "orange", "border-orange-700", "bg-orange-900/30")}
        </div>

        <div class="flex gap-2 mb-4">
            <button onclick="selectAllInCategory('safe')" class="px-3 py-1 bg-green-700 hover:bg-green-600 rounded text-sm">Select all Safe</button>
            <button onclick="selectAllInCategory('yellow')" class="px-3 py-1 bg-yellow-700 hover:bg-yellow-600 rounded text-sm">Select all Yellow</button>
            <button onclick="selectAllInCategory('orange')" class="px-3 py-1 bg-orange-700 hover:bg-orange-600 rounded text-sm">Select all Orange</button>
            <button onclick="clearSelection()" class="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm">Clear</button>
        </div>

        <div id="ws-files" class="space-y-2 mb-4">
            ${renderFileList(scan)}
        </div>

        <div class="flex gap-2">
            <button onclick="executeSelected(true)" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded font-medium">
                🔍 Dry run
            </button>
            <button onclick="executeSelected(false)" class="px-4 py-2 bg-red-600 hover:bg-red-500 rounded font-medium">
                🗑️ Execute (move to backup)
            </button>
            <button onclick="openWorkspace('${scan.workspace}')" class="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded font-medium">
                🔄 Re-scan
            </button>
        </div>
        <div id="ws-result" class="mt-4"></div>
    `;
    $("workspace-detail").innerHTML = html;
}

function categoryCard(title, items, key, border, bg) {
    const sizeMB = items.reduce((s, i) => s + (i.size_mb || 0), 0);
    return `
        <div class="card ${border} ${bg}">
            <div class="font-semibold text-sm">${title}</div>
            <div class="text-2xl font-bold mt-1">${items.length}</div>
            <div class="text-xs text-slate-400">${formatMB(sizeMB)} total</div>
        </div>
    `;
}

function renderFileList(scan) {
    let html = "";
    for (const cat of ["yellow", "orange", "safe"]) {
        const items = scan.categories[cat];
        if (items.length === 0) continue;
        const color = cat === "safe" ? "green" : cat === "yellow" ? "yellow" : "orange";
        html += `<details class="card" open>
            <summary class="cursor-pointer font-semibold text-${color}-300">
                ${cat.toUpperCase()} (${items.length})
            </summary>
            <div class="mt-2 space-y-1">`;
        for (const it of items) {
            const checked = selectedItems.has(it.path) ? "checked" : "";
            const isDir = it.is_dir ? "📁" : "📄";
            html += `
                <label class="flex items-center gap-2 text-xs hover:bg-slate-700 px-2 py-1 rounded cursor-pointer">
                    <input type="checkbox" ${checked}
                           onchange="toggleItem('${it.path.replace(/\\/g, "\\\\")}', this.checked)">
                    <span>${isDir}</span>
                    <span class="font-mono flex-1 truncate" title="${escapeAttr(it.path)}">${escapeHtml(it.name)}</span>
                    <span class="text-slate-400 flex-shrink-0">${formatMB(it.size_mb)}</span>
                </label>
            `;
        }
        html += `</div></details>`;
    }
    return html || '<div class="text-slate-500 text-sm">No items to clean.</div>';
}

function toggleItem(path, checked) {
    if (checked) selectedItems.add(path);
    else selectedItems.delete(path);
}

function selectAllInCategory(cat) {
    if (!currentScan) return;
    for (const it of currentScan.categories[cat]) selectedItems.add(it.path);
    openWorkspace(currentWorkspace);  // re-render
}

function clearSelection() {
    selectedItems.clear();
    openWorkspace(currentWorkspace);
}

async function executeSelected(dryRun) {
    if (!currentWorkspace) return;
    const items = Array.from(selectedItems);
    if (items.length === 0) {
        alert("No items selected. Check the boxes next to files you want to clean.");
        return;
    }
    if (!dryRun) {
        const ok = confirm(
            `About to MOVE ${items.length} items from workspace "${currentWorkspace}" to:\n` +
            `data/workspace-cleanups/<date>/${currentWorkspace}/\n\n` +
            `Files will NOT be deleted from disk. Continue?`
        );
        if (!ok) return;
    }
    $("ws-result").innerHTML = `<div class="text-blue-300">${dryRun ? "Simulating" : "Executing"}…</div>`;
    try {
        const r = await fetch(`${API}/workspace/${encodeURIComponent(currentWorkspace)}/execute`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items, dry_run: dryRun }),
        });
        if (!r.ok) throw new Error("HTTP " + r.status);
        const d = await r.json();
        renderExecResult(d);
        if (!dryRun) {
            selectedItems.clear();
            openWorkspace(currentWorkspace);  // re-scan to reflect moved files
        }
    } catch (e) {
        $("ws-result").innerHTML = `<div class="text-red-400">Error: ${e.message}</div>`;
    }
}

function renderExecResult(d) {
    const tone = d.failed_count > 0 ? "text-yellow-300" : "text-green-300";
    $("ws-result").innerHTML = `
        <div class="card ${tone}">
            <div class="font-semibold mb-1">
                ${d.dry_run ? "[DRY RUN]" : "[EXECUTED]"} moved=${d.moved_count} failed=${d.failed_count} locked=${d.skipped_locked} size=${formatMB(d.size_mb_moved)}
            </div>
            <div class="text-xs text-slate-400">Backup: ${escapeHtml(d.backup_dir)}</div>
            ${d.results && d.results.length > 0 ? `
                <details class="mt-2">
                    <summary class="cursor-pointer text-xs">Show ${d.results.length} result(s)</summary>
                    <div class="mt-1 max-h-48 overflow-y-auto text-xs space-y-0.5">
                        ${d.results.map(r => `
                            <div class="font-mono">
                                <span class="text-${r.status === "moved" || r.status === "would_move" ? "green" : "yellow"}-400">${r.status.padEnd(12)}</span>
                                ${escapeHtml((r.dest || r.path || "").split(/[\\\/]/).pop())}
                            </div>
                        `).join("")}
                    </div>
                </details>
            ` : ""}
        </div>
    `;
}

async function showBackups() {
    try {
        const r = await fetch(`${API}/workspace/backup`);
        if (!r.ok) throw new Error("HTTP " + r.status);
        const d = await r.json();
        const html = d.backups.length === 0
            ? '<div class="text-slate-500">No backups yet.</div>'
            : '<div class="space-y-2">' + d.backups.map(b => `
                <div class="card flex justify-between items-center">
                    <div>
                        <div class="font-semibold">${escapeHtml(b.date)}</div>
                        <div class="text-xs text-slate-400">${b.file_count} files · ${formatMB(b.size_mb)}</div>
                    </div>
                    <div class="text-xs text-slate-500 font-mono">${escapeHtml(b.path)}</div>
                </div>
            `).join("") + '</div>';
        $("workspace-detail").classList.remove("hidden");
        $("workspace-detail").innerHTML = `
            <h3 class="text-xl font-bold mb-3">📦 Backup history</h3>
            ${html}
        `;
    } catch (e) {
        alert(`Error: ${e.message}`);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    $("ws-backup-btn").addEventListener("click", showBackups);
});
