// ── Watchdog tab ──────────────────────────────────────────

function timeAgo(epoch) {
    if (!epoch) return "never";
    const s = Math.max(0, Math.floor(Date.now() / 1000 - epoch));
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
}

function eventBadge(event) {
    const colors = {
        down: "text-red-400",
        up: "text-green-400",
        restarting: "text-yellow-400",
        restart_skipped: "text-orange-400",
        restart_error: "text-red-500",
        loop_error: "text-red-500",
    };
    return colors[event] || "text-slate-400";
}

async function loadWatchdogStatus() {
    try {
        const r = await fetch(`${API}/watchdog/status`);
        if (!r.ok) throw new Error("HTTP " + r.status);
        const d = await r.json();
        renderWatchdog(d);
    } catch (e) {
        console.error("loadWatchdogStatus failed:", e);
        $("watchdog-meta").textContent = `Error loading status: ${e.message}`;
    }
}

async function watchdogLoopNow() {
    showToast("Triggering immediate check…");
    await fetch(`${API}/watchdog/loop-now`, { method: "POST" });
    await loadWatchdogStatus();
}

function renderWatchdog(d) {
    const meta = $("watchdog-meta");
    const runningMark = d.is_running ? "🟢 running" : "🔴 not running";
    const lastLoop = d.last_loop_at ? timeAgo(d.last_loop_at) : "—";
    meta.innerHTML = `
        <div class="card text-sm">
            <div>Loop: <span class="font-semibold">${runningMark}</span> · interval ${d.interval_sec}s · last loop ${lastLoop}</div>
            <div class="text-xs text-slate-500 mt-1">Default check every 30s. Auto-restart is OFF unless you toggle it per service.</div>
        </div>
    `;

    const cards = $("watchdog-cards");
    if (!d.services || d.services.length === 0) {
        cards.innerHTML = '<div class="text-slate-400">No services configured.</div>';
        return;
    }
    cards.innerHTML = d.services.map(s => {
        const emoji = s.healthy ? "🟢" : "🔴";
        const errTxt = s.last_error ? ` · <span class="text-red-300">${escapeHtml(s.last_error)}</span>` : "";
        const lastCheck = s.last_check_at ? timeAgo(s.last_check_at) : "never";
        const desc = s.description ? `<div class="text-xs text-slate-500">${escapeHtml(s.description)}</div>` : "";
        const restartCmd = "";
        return `
            <div class="card flex items-center gap-3">
                <div class="text-2xl">${emoji}</div>
                <div class="flex-1 min-w-0">
                    <div class="font-semibold">${escapeHtml(s.name)}</div>
                    <div class="text-xs text-slate-400">
                        Last check: ${lastCheck}${errTxt}
                    </div>
                    ${desc}
                </div>
                <div class="text-right text-sm flex flex-col items-end gap-1 flex-shrink-0">
                    <div>
                        <span class="text-yellow-400 font-mono">${s.restarts_total}</span>
                        <span class="text-xs text-slate-500">restarts</span>
                    </div>
                    <label class="flex items-center gap-1 text-xs cursor-pointer select-none" title="Auto-restart on failure (off by default)">
                        <input type="checkbox" ${s.auto_restart ? "checked" : ""}
                               onchange="toggleWatchdogService('${s.id}', this)">
                        <span class="${s.auto_restart ? 'text-yellow-300' : 'text-slate-500'}">auto-restart</span>
                    </label>
                    <button class="text-xs text-slate-400 hover:text-slate-200 underline" onclick="forceCheckService('${s.id}')">
                        check now
                    </button>
                </div>
            </div>
        `;
    }).join("");
}

async function toggleWatchdogService(id, checkbox) {
    const r = await fetch(`${API}/watchdog/services/${id}/toggle`, { method: "POST" });
    if (!r.ok) {
        alert(`Toggle failed: HTTP ${r.status}`);
        checkbox.checked = !checkbox.checked;
        return;
    }
    const d = await r.json();
    showToast(`${d.service_id}: auto-restart ${d.auto_restart ? "ENABLED" : "DISABLED"}`);
    loadWatchdogStatus();
}

async function forceCheckService(id) {
    const r = await fetch(`${API}/watchdog/check/${id}`, { method: "POST" });
    if (!r.ok) {
        alert(`Check failed: HTTP ${r.status}`);
        return;
    }
    const d = await r.json();
    showToast(`${id}: ${d.ok ? "🟢" : "🔴"} ${d.detail}`);
    loadWatchdogStatus();
}

async function loadWatchdogHistory() {
    try {
        const r = await fetch(`${API}/watchdog/history?limit=50`);
        if (!r.ok) throw new Error("HTTP " + r.status);
        const d = await r.json();
        const hist = $("watchdog-history");
        if (!d.events || d.events.length === 0) {
            hist.innerHTML = '<div class="text-slate-500">No events yet. Watchdog will log service state changes here.</div>';
            return;
        }
        hist.innerHTML = d.events.map(e => `
            <div class="font-mono text-xs flex gap-2">
                <span class="text-slate-500 flex-shrink-0">${new Date(e.ts * 1000).toLocaleTimeString()}</span>
                <span class="${eventBadge(e.event)} flex-shrink-0 w-24">${e.event}</span>
                <span class="text-slate-300 flex-shrink-0 w-24">${e.service}</span>
                <span class="text-slate-400 flex-1 truncate" title="${escapeAttr(e.detail)}">${escapeHtml(e.detail)}</span>
            </div>
        `).join("");
    } catch (e) {
        console.error("loadWatchdogHistory failed:", e);
    }
}

function showToast(msg) {
    const t = document.createElement("div");
    t.className = "fixed bottom-4 right-4 bg-slate-700 text-white px-4 py-2 rounded shadow-lg text-sm z-50";
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2500);
}

// Hook up tab buttons when DOM is ready
function watchdogInit() {
    $("wd-refresh-btn").addEventListener("click", watchdogLoopNow);
    $("wd-history-btn").addEventListener("click", loadWatchdogHistory);
}

// Auto-load status when watchdog tab is opened
document.addEventListener("DOMContentLoaded", watchdogInit);
