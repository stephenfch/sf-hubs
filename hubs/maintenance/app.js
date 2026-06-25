// Computer Maintenance — Frontend
const API = "http://127.0.0.1:8765/api";

let currentTab = "dashboard";
let currentSort = "ram";
let refreshTimer = null;

const $ = (id) => document.getElementById(id);

// ── Tab switching ─────────────────────────────────────────
document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        document.querySelectorAll(".tab-content").forEach(c => c.classList.add("hidden"));
        $("tab-" + btn.dataset.tab).classList.remove("hidden");
        currentTab = btn.dataset.tab;
        if (currentTab === "dashboard") loadSystem();
        else if (currentTab === "processes") loadProcesses();
        else if (currentTab === "watchdog") loadWatchdogStatus();
        else if (currentTab === "workspaces") loadWorkspacesList();
    });
});

// ── Sort buttons ──────────────────────────────────────────
document.querySelectorAll(".sort-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".sort-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        currentSort = btn.dataset.sort;
        loadProcesses();
    });
});

// ── Cleanup scan button ───────────────────────────────────
$("scan-btn").addEventListener("click", loadCleanup);

// ── System info ───────────────────────────────────────────
async function loadSystem() {
    try {
        const r = await fetch(`${API}/system`);
        if (!r.ok) throw new Error("HTTP " + r.status);
        renderSystem(await r.json());
    } catch (e) {
        console.error("loadSystem failed:", e);
    }
}

function renderSystem(d) {
    $("cpu-percent").textContent = `${d.cpu.percent}%`;
    $("cpu-detail").textContent = `${d.cpu.count_physical} cores / ${d.cpu.count_logical} threads @ ${d.cpu.freq_mhz.toFixed(0)} MHz`;
    $("cpu-bar").style.width = `${d.cpu.percent}%`;

    $("ram-percent").textContent = `${d.memory.percent}%`;
    $("ram-detail").textContent = `${d.memory.used_gb} / ${d.memory.total_gb} GB`;
    $("ram-bar").style.width = `${d.memory.percent}%`;

    $("disk-percent").textContent = `${d.disk.percent}%`;
    $("disk-detail").textContent = `${d.disk.used_gb} / ${d.disk.total_gb} GB`;
    $("disk-bar").style.width = `${d.disk.percent}%`;

    if (d.gpu.available) {
        $("gpu-percent").textContent = `${d.gpu.percent}%`;
        $("gpu-detail").textContent = `${d.gpu.name} | VRAM ${d.gpu.memory_used_mb} / ${d.gpu.memory_total_mb} MB`;
        $("gpu-bar").style.width = `${d.gpu.percent}%`;
    } else {
        $("gpu-percent").textContent = "N/A";
        $("gpu-detail").textContent = d.gpu.error || "GPU not available";
        $("gpu-bar").style.width = "0%";
    }

    $("uptime").textContent = `Up: ${d.uptime.uptime_human}`;
    $("last-update").textContent = `Updated: ${new Date().toLocaleTimeString()}`;
}

// ── Process list ──────────────────────────────────────────
async function loadProcesses() {
    try {
        const r = await fetch(`${API}/processes?sort=${currentSort}&limit=50`);
        if (!r.ok) throw new Error("HTTP " + r.status);
        renderProcesses(await r.json());
    } catch (e) {
        console.error("loadProcesses failed:", e);
    }
}

function renderProcesses(procs) {
    const tbody = $("process-table");
    if (!procs || procs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="px-3 py-4 text-center text-slate-400">No processes</td></tr>`;
        return;
    }
    tbody.innerHTML = procs.map(p => `
        <tr class="hover:bg-slate-700/50">
            <td class="px-3 py-2 font-mono text-xs">${p.pid}</td>
            <td class="px-3 py-2">${escapeHtml(p.name)}</td>
            <td class="px-3 py-2 text-xs text-slate-400">${escapeHtml(p.user)}</td>
            <td class="px-3 py-2 text-right font-mono">${p.ram_mb}</td>
            <td class="px-3 py-2 text-right font-mono">${p.cpu_percent}</td>
            <td class="px-3 py-2 text-xs text-slate-400">${p.status}</td>
            <td class="px-3 py-2">
                <button onclick="killProcess(${p.pid}, '${escapeAttr(p.name)}')"
                    class="text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded hover:bg-red-900/30">
                    Kill
                </button>
            </td>
        </tr>
    `).join("");
}

async function killProcess(pid, name) {
    if (!confirm(`Kill ${name} (PID ${pid})?\n\nThis will attempt graceful termination first, then force-kill after 3s.`)) return;
    try {
        const r = await fetch(`${API}/processes/${pid}/kill`, { method: "POST" });
        if (r.ok) {
            setTimeout(loadProcesses, 500);
        } else {
            const err = await r.json();
            alert(`Failed: ${err.detail || "Unknown error"}`);
        }
    } catch (e) {
        alert(`Error: ${e.message}`);
    }
}

function formatSize(mb) {
    const n = parseFloat(mb);
    if (isNaN(n)) return "-";
    if (n >= 1024) return (n / 1024).toFixed(2) + " GB";
    if (n >= 1) return n.toFixed(1) + " MB";
    return (n * 1024).toFixed(0) + " KB";
}

async function openPath(path) {
    try {
        const r = await fetch(`${API}/cleanup/open`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path }),
        });
        if (!r.ok) {
            const err = await r.json();
            alert(`Open failed: ${err.detail || "Unknown error"}`);
        }
    } catch (e) {
        alert(`Error: ${e.message}`);
    }
}

// ── Cleanup scan ──────────────────────────────────────────
async function loadCleanup() {
    const btn = $("scan-btn");
    btn.disabled = true;
    btn.textContent = "⏳ Scanning…";
    $("cleanup-summary").innerHTML = `<div class="text-yellow-400">Scanning filesystem… may take 10-30s</div>`;
    $("cleanup-results").innerHTML = "";

    try {
        const r = await fetch(`${API}/cleanup/scan?min_size_mb=100`);
        if (!r.ok) throw new Error("HTTP " + r.status);
        renderCleanup(await r.json());
    } catch (e) {
        $("cleanup-summary").innerHTML = `<div class="text-red-400">Error: ${escapeHtml(e.message)}</div>`;
    } finally {
        btn.disabled = false;
        btn.textContent = "🔍 Scan";
    }
}

function renderCleanup(data) {
    const s = data.summary;
    $("cleanup-summary").innerHTML = `
        <div class="card">
            <strong>📦 Found:</strong>
            <span class="ml-2">${s.large_count} large files (${formatSize(s.large_total_mb)})</span> +
            <span class="ml-2">${s.stale_count} stale temp (${formatSize(s.stale_total_mb)})</span>
            <span class="ml-2">=</span>
            <strong class="text-green-400 ml-2">${formatSize(s.total_recoverable_mb)} recoverable</strong>
        </div>
    `;

    const results = $("cleanup-results");
    const items = [...data.large_files, ...data.stale_files].slice(0, 50);
    if (items.length === 0) {
        results.innerHTML = `<div class="card text-slate-400 text-center">✅ No large/stale files found</div>`;
        return;
    }
    results.innerHTML = items.map(f => `
        <div class="card cleanup-card flex justify-between items-center text-sm" onclick="openPath('${escapeAttr(f.path)}')" title="Click to open in Explorer">
            <div class="flex-1 truncate flex items-center gap-2 min-w-0">
                <span class="text-xs px-2 py-0.5 rounded font-semibold flex-shrink-0 ${f.type === 'large_file' ? 'bg-blue-900 text-blue-200' : 'bg-orange-900 text-orange-200'}">
                    ${f.type === 'large_file' ? 'LARGE' : 'STALE'}
                </span>
                <span class="font-mono text-xs text-slate-300 truncate" title="${escapeAttr(f.path)}">${escapeHtml(f.path)}</span>
            </div>
            <div class="ml-3 text-yellow-400 font-mono flex-shrink-0 text-right">
                ${formatSize(f.size_mb)}
            </div>
        </div>
    `).join("");
}

// ── Helpers ───────────────────────────────────────────────
function escapeHtml(s) {
    if (!s) return "";
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
}
function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, "\\'");
}

// ── Initial load + auto-refresh (5s) ──────────────────────
loadSystem();
loadProcesses();
refreshTimer = setInterval(() => {
    if (currentTab === "dashboard") loadSystem();
    else if (currentTab === "processes") loadProcesses();
}, 5000);
