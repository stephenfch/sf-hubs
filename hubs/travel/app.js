// =============================================================================
// Travel Hub — app.js
// 渲染 window.TRAVEL_DATA → trip 卡片 + 每日 itinerary timeline
// Vanilla JS，zero dependency
// =============================================================================
(function () {
  "use strict";

  const DATA = window.TRAVEL_DATA || { trips: [] };

  // ---- helpers -------------------------------------------------------------
  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function esc(s) {
    if (!s) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
  function fmtDate(d) {
    const dt = new Date(d + "T00:00:00");
    return dt.toLocaleDateString("zh-HK", { month: "short", day: "numeric" });
  }
  function statusMeta(s) {
    if (s === "upcoming") return { label: "Upcoming", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" };
    if (s === "ongoing") return { label: "Ongoing", cls: "bg-sky-500/15 text-sky-300 border-sky-500/30" };
    return { label: "Past", cls: "bg-white/10 text-white/50 border-white/20" };
  }
  function riskMeta(l) {
    if (l === "red") return { dot: "bg-red-500", tag: "bg-red-500/15 text-red-300 border-red-500/30", label: "高" };
    if (l === "orange") return { dot: "bg-orange-500", tag: "bg-orange-500/15 text-orange-300 border-orange-500/30", label: "中" };
    return { dot: "bg-yellow-500", tag: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30", label: "低" };
  }

  // 移除 emoji / 裝飾符號，拎出純地名做 Google Maps 搜尋 query
  function stripEmoji(s) {
    if (!s) return "";
    return String(s)
      .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu, "")
      .replace(/[A-Za-z0-9]+\s*/g, "") // 拎走 "A：" "B：" 等英數前綴
      .replace(/[（）()]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  function cleanQuery(title) {
    // 優先攞括號前嘅主地名；例如 "Sasagaoka Park 笹ヶ丘公園" → "笹ヶ丘公園"
    let t = String(title || "");
    const m = t.match(/[一-鿿぀-ヿ가-힯]{2,}/); // 揀第一個日/中/韓文段
    if (m) return m[0];
    return stripEmoji(t) || t;
  }
  // 全程路線總覧：KIX → 每日城市 → （用 Google Maps directions embed，免 API key）
  function buildOverview(trip) {
    const seen = new Set();
    const stops = [];
    (trip.days || []).forEach((d) => {
      const loc = String(d.location || "").split("→")[0].trim();
      if (loc && !seen.has(loc)) {
        seen.add(loc);
        stops.push(loc);
      }
    });
    const enc = encodeURIComponent;
    const saddr = enc("關西國際機場 Kansai Airport");
    const daddr = stops.map(enc).join("+to:");
    return `https://maps.google.com/maps?saddr=${saddr}&daddr=${daddr}&output=embed`;
  }

  // ---- render: trip cards --------------------------------------------------
  function renderTrips(container) {
    if (!DATA.trips.length) {
      container.appendChild(el("div", "text-white/40 text-sm", "暫時無行程資料"));
      return;
    }
    DATA.trips.forEach((trip) => {
      const st = statusMeta(trip.status);
      const card = el("div", "card-hover block bg-card border border-white/5 rounded-2xl overflow-hidden cursor-pointer group");
      card.dataset.tripId = trip.id;

      // hero
      const hero = el("div", `h-28 bg-gradient-to-br ${trip.gradient} relative flex items-end p-4`);
      hero.innerHTML = `
        <div class="absolute top-3 right-3 px-2 py-0.5 rounded-full text-xs border ${st.cls} bg-card/60 backdrop-blur">${st.label}</div>
        <span class="text-3xl drop-shadow">${esc(trip.emoji || "✈️")}</span>`;
      card.appendChild(hero);

      // body
      const body = el("div", "p-4");
      body.innerHTML = `
        <h3 class="font-semibold text-lg group-hover:text-accent transition">${esc(trip.title)}</h3>
        <p class="text-white/40 text-xs mt-0.5">${esc(trip.region || "")}</p>
        <p class="text-white/60 text-sm mt-2 leading-relaxed">${esc(trip.summary || "")}</p>
        <div class="mt-3 flex flex-wrap gap-2 text-xs">
          <span class="px-2 py-1 rounded-lg bg-white/5 text-white/60">📅 ${fmtDate(trip.startDate)} – ${fmtDate(trip.endDate)}</span>
          <span class="px-2 py-1 rounded-lg bg-white/5 text-white/60">👥 ${esc(trip.party || "")}</span>
          <span class="px-2 py-1 rounded-lg bg-white/5 text-white/60">${esc(trip.transport || "")}</span>
        </div>
        <div class="mt-3 flex items-center gap-2 text-accent text-xs font-medium opacity-0 group-hover:opacity-100 transition">
          睇行程 <span>→</span>
        </div>`;
      card.appendChild(body);

      card.addEventListener("click", () => openDetail(trip.id));
      container.appendChild(card);
    });
  }

  // ---- render: detail view -------------------------------------------------
  function openDetail(tripId) {
    const trip = DATA.trips.find((t) => t.id === tripId);
    if (!trip) return;
    document.getElementById("view-list").classList.add("hidden");
    const detail = document.getElementById("view-detail");
    detail.classList.remove("hidden");
    detail.innerHTML = "";

    const st = statusMeta(trip.status);

    // back bar
    const back = el("button", "mb-5 inline-flex items-center gap-2 text-white/50 hover:text-white transition text-sm", "← 返去所有行程");
    back.addEventListener("click", backToList);
    detail.appendChild(back);

    // header
    const header = el("div", "mb-6");
    header.innerHTML = `
      <div class="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <span class="text-3xl">${esc(trip.emoji || "✈️")}</span>
            <h1 class="text-3xl font-black tracking-tight gradient-text">${esc(trip.title)}</h1>
          </div>
          <p class="text-white/40 text-sm">${esc(trip.region || "")} · ${esc(trip.summary || "")}</p>
        </div>
        <span class="px-3 py-1 rounded-full text-xs border ${st.cls}">${st.label}</span>
      </div>
      <div class="mt-4 flex flex-wrap gap-2 text-xs">
        <span class="px-3 py-1.5 rounded-lg bg-white/5 text-white/70">📅 ${fmtDate(trip.startDate)} – ${fmtDate(trip.endDate)}</span>
        <span class="px-3 py-1.5 rounded-lg bg-white/5 text-white/70">👥 ${esc(trip.party || "")}</span>
        <span class="px-3 py-1.5 rounded-lg bg-white/5 text-white/70">${esc(trip.transport || "")}</span>
      </div>`;
    detail.appendChild(header);

    // flights strip
    if (trip.flights && trip.flights.length) {
      const fwrap = el("div", "grid grid-cols-1 md:grid-cols-2 gap-3 mb-6");
      trip.flights.forEach((f) => {
        const fcard = el("div", "bg-card border border-white/5 rounded-xl p-3 flex items-center gap-3");
        fcard.innerHTML = `
          <div class="text-2xl">${f.from === "HKG" ? "🛫" : "🛬"}</div>
          <div class="flex-1">
            <div class="text-sm font-medium">${esc(f.flight)} · ${esc(f.from)} → ${esc(f.to)}</div>
            <div class="text-xs text-white/50">${fmtDate(f.date)} · ${esc(f.depart)} – ${esc(f.arrive)}</div>
            <div class="text-xs text-white/30">${esc(f.note || "")}</div>
          </div>`;
        fwrap.appendChild(fcard);
      });
      detail.appendChild(fwrap);
    }

    // tabs
    const tabs = el("div", "flex gap-2 mb-5 border-b border-white/5");
    const tabDefs = [
      { id: "itinerary", label: "📅 每日行程" },
      { id: "map", label: "🗺️ 地圖總覧" },
      { id: "risks", label: "⚠️ 風險提示" },
      { id: "tbc", label: "📌 待決事項" },
      { id: "extras", label: "💡 加推 / 備選" },
    ];
    const panes = {};
    tabDefs.forEach((t, i) => {
      const btn = el("button", `px-4 py-2 text-sm font-medium border-b-2 transition ${i === 0 ? "text-accent border-accent" : "text-white/40 border-transparent hover:text-white/70"}`, t.label);
      btn.dataset.tab = t.id;
      btn.addEventListener("click", () => switchTab(t.id));
      tabs.appendChild(btn);
      panes[t.id] = el("div", i === 0 ? "" : "hidden");
    });
    detail.appendChild(tabs);

    function switchTab(id) {
      tabs.querySelectorAll("button").forEach((b) => {
        const on = b.dataset.tab === id;
        b.className = `px-4 py-2 text-sm font-medium border-b-2 transition ${on ? "text-accent border-accent" : "text-white/40 border-transparent hover:text-white/70"}`;
      });
      Object.keys(panes).forEach((k) => panes[k].classList.toggle("hidden", k !== id));
      detail.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    // ---- itinerary timeline ----
    if (trip.days && trip.days.length) {
      const tl = el("div", "relative pl-6");
      tl.innerHTML = `<div class="absolute left-[7px] top-2 bottom-2 w-px bg-gradient-to-b from-accent/60 to-white/10"></div>`;
      trip.days.forEach((d) => {
        const node = el("div", "relative mb-6");
        const dot = el("div", "absolute -left-[22px] top-1.5 w-3.5 h-3.5 rounded-full bg-accent ring-4 ring-accent/20");
        node.appendChild(dot);

        const card = el("div", "bg-card border border-white/5 rounded-xl p-4");
        card.innerHTML = `
          <div class="flex items-center justify-between gap-2 flex-wrap mb-3">
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 rounded-md bg-accent/15 text-accent text-xs font-bold">Day ${d.day}</span>
              <span class="text-sm font-semibold">${esc(d.title)}</span>
            </div>
            <span class="text-xs text-white/40">${fmtDate(d.date)} (${esc(d.weekday || "")}) · 📍 ${esc(d.location || "")}</span>
          </div>`;

        const list = el("div", "space-y-2");
        (d.items || []).forEach((it) => {
          const row = el("div", "flex gap-3 items-start");
          const left = el("div", "w-14 shrink-0 text-right pt-0.5");
          left.innerHTML = it.time ? `<span class="text-xs text-white/50 font-mono">${esc(it.time)}</span>` : `<span class="text-xs text-white/20">—</span>`;
          const mid = el("div", "pt-1 text-base leading-none", it.icon || "•");
          const right = el("div", "flex-1");
          const tbcCls = it.tbc ? "border-amber-500/40 bg-amber-500/5" : "border-white/5 bg-white/[0.02]";
          right.innerHTML = `
            <div class="rounded-lg border ${tbcCls} px-3 py-2">
              <div class="text-sm font-medium ${it.tbc ? "text-amber-200" : "text-white/90"}">${esc(it.title)} ${it.tbc ? '<span class="text-[10px] align-middle ml-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">TBC</span>' : ""}</div>
              ${it.desc ? `<div class="text-xs text-white/50 mt-0.5 leading-relaxed">${esc(it.desc)}</div>` : ""}
              ${it.url ? `<a href="${esc(it.url)}" target="_blank" rel="noopener" class="text-xs text-accent hover:underline mt-1 inline-block">🔗 連結 ↗</a>` : ""}
            </div>`;
          row.appendChild(left);
          row.appendChild(mid);
          row.appendChild(right);
          list.appendChild(row);
        });
        card.appendChild(list);

        // hotel footer
        if (d.hotel) {
          const hf = el("div", "mt-3 pt-3 border-t border-white/5 flex items-center gap-2 text-xs text-white/50");
          hf.innerHTML = `<span>🏨</span><span>${esc(d.hotel)}</span>`;
          card.appendChild(hf);
        }

        node.appendChild(card);
        tl.appendChild(node);
      });
      panes.itinerary.appendChild(tl);
    }

    // ---- risks ----
    if (trip.risks && trip.risks.length) {
      const wrap = el("div", "space-y-2");
      trip.risks.forEach((r) => {
        const m = riskMeta(r.level);
        const row = el("div", "flex gap-3 items-start bg-card border border-white/5 rounded-xl p-3");
        row.innerHTML = `
          <div class="flex items-center gap-2 pt-0.5">
            <span class="w-2 h-2 rounded-full ${m.dot}"></span>
            <span class="text-lg">${esc(r.icon || "")}</span>
          </div>
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium">${esc(r.title)}</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded border ${m.tag}">${m.label}</span>
            </div>
            <div class="text-xs text-white/50 mt-1 leading-relaxed">${esc(r.desc)}</div>
          </div>`;
        wrap.appendChild(row);
      });
      panes.risks.appendChild(wrap);
    }

    // ---- tbc ----
    if (trip.tbc && trip.tbc.length) {
      const wrap = el("div", "space-y-2");
      trip.tbc.forEach((t) => {
        const row = el("div", "flex gap-3 items-start bg-card border border-amber-500/20 rounded-xl p-3");
        row.innerHTML = `<span class="text-amber-400 pt-0.5">📌</span><span class="text-sm text-white/80 leading-relaxed">${esc(t)}</span>`;
        wrap.appendChild(row);
      });
      panes.tbc.appendChild(wrap);
    }

    // ---- extras ----
    if (trip.extras && trip.extras.length) {
      const wrap = el("div", "grid grid-cols-1 md:grid-cols-2 gap-3");
      trip.extras.forEach((x) => {
        const card = el("div", "bg-card border border-white/5 rounded-xl p-3");
        card.innerHTML = `
          <div class="text-sm font-medium text-white/90">${esc(x.title)}</div>
          <div class="text-xs text-white/50 mt-1 leading-relaxed">${esc(x.desc || "")}</div>
          ${x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener" class="text-xs text-accent hover:underline mt-1 inline-block">🔗 連結 ↗</a>` : ""}`;
        wrap.appendChild(card);
      });
      panes.extras.appendChild(wrap);
    }

    // ---- map (Google My Maps 多 marker 互動地圖，免 API key) ----
    if (trip.days && trip.days.length) {
      const MYMAPS_MID = "1LuuiiWAbTEBuR2loYXmtRSgLz-vNYZE"; // 由 Google My Maps import mymaps-spots.csv 生成
      const mymapsUrl = `https://www.google.com/maps/d/embed?mid=${MYMAPS_MID}`;

      const mapWrap = el("div", "");

      const toolbar = el("div", "flex items-center gap-2 mb-3 flex-wrap");
      const btnOverview = el(
        "button",
        "px-3 py-1.5 rounded-lg bg-accent/15 text-accent text-xs font-medium hover:bg-accent/25 transition",
        "🗺️ 切換：路線總覧"
      );
      const btnMyMaps = el(
        "button",
        "px-3 py-1.5 rounded-lg bg-white/5 text-white/60 text-xs font-medium hover:bg-white/10 transition",
        "📍 切換：My Maps 景點圖"
      );
      const hint = el("span", "text-xs text-white/40", "撳下方 chip → 開該景點 Google Maps 連結");
      toolbar.appendChild(btnMyMaps);
      toolbar.appendChild(btnOverview);
      toolbar.appendChild(hint);

      const frame = document.createElement("iframe");
      frame.id = "gmap-frame";
      frame.className = "w-full rounded-xl border border-white/5 bg-white/5";
      frame.style.height = "480px";
      frame.setAttribute("loading", "lazy");
      frame.setAttribute("referrerpolicy", "no-referrer-when-downgrade");
      frame.allowFullscreen = true;

      const overviewUrl = buildOverview(trip);
      frame.src = mymapsUrl; // 預設顯示 My Maps 多 marker 景點圖

      btnMyMaps.addEventListener("click", () => {
        frame.src = mymapsUrl;
        btnMyMaps.className = "px-3 py-1.5 rounded-lg bg-accent/15 text-accent text-xs font-medium hover:bg-accent/25 transition";
        btnOverview.className = "px-3 py-1.5 rounded-lg bg-white/5 text-white/60 text-xs font-medium hover:bg-white/10 transition";
      });
      btnOverview.addEventListener("click", () => {
        frame.src = overviewUrl;
        btnOverview.className = "px-3 py-1.5 rounded-lg bg-accent/15 text-accent text-xs font-medium hover:bg-accent/25 transition";
        btnMyMaps.className = "px-3 py-1.5 rounded-lg bg-white/5 text-white/60 text-xs font-medium hover:bg-white/10 transition";
      });

      mapWrap.appendChild(toolbar);
      mapWrap.appendChild(frame);

      // 每日景點 chips（點擊 → 新分頁開該景點 Google Maps 連結）
      const list = el("div", "mt-4 space-y-3");
      trip.days.forEach((d) => {
        const grp = el("div", "");
        grp.appendChild(
          el("div", "text-xs font-bold text-accent/80 mb-1.5", `Day ${d.day} · ${esc(d.title)}`)
        );
        const sub = el("div", "flex flex-wrap gap-2");
        (d.items || []).forEach((it) => {
          if (!it || !it.title) return;
          const label = (it.icon ? it.icon + " " : "") + stripEmoji(it.title).slice(0, 16);
          const chip = el(
            "button",
            "px-2.5 py-1 rounded-lg bg-white/5 hover:bg-accent/20 text-white/70 text-xs transition text-left",
            label
          );
          chip.title = it.title;
          if (it.url) {
            chip.addEventListener("click", () => window.open(it.url, "_blank", "noopener"));
          } else {
            chip.addEventListener("click", () => {
              const q = cleanQuery(it.title);
              window.open(`https://maps.google.com/maps?q=${encodeURIComponent(q)}`, "_blank", "noopener");
            });
          }
          sub.appendChild(chip);
        });
        grp.appendChild(sub);
        list.appendChild(grp);
      });
      mapWrap.appendChild(list);

      panes.map.appendChild(mapWrap);
    }

    Object.values(panes).forEach((p) => detail.appendChild(p));
  }

  function backToList() {
    document.getElementById("view-detail").classList.add("hidden");
    document.getElementById("view-detail").innerHTML = "";
    document.getElementById("view-list").classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---- init ---------------------------------------------------------------
  document.addEventListener("DOMContentLoaded", () => {
    renderTrips(document.getElementById("trip-grid"));
    const meta = DATA.meta;
    if (meta && meta.updated) {
      const u = document.getElementById("data-updated");
      if (u) u.textContent = "資料更新：" + meta.updated;
    }
  });
})();
