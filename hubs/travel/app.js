// =============================================================================
// Travel Hub — app.js
// 渲染 window.TRAVEL_DATA → trip 卡片 + 每日 itinerary + 景點 info + 📸加相 + 📔日誌
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
    if (s === undefined || s === null) return "";
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
      .replace(/[A-Za-z0-9]+\s*/g, "")
      .replace(/[（）()]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  function cleanQuery(title) {
    let t = String(title || "");
    const m = t.match(/[一-鿿぀-ヿ가-힯]{2,}/);
    if (m) return m[0];
    return stripEmoji(t) || t;
  }
  // 全程路線總覽：KIX → 每日城市（Google Maps directions embed，免 API key）
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
  // MapCode → Mapion 導航網址
  function mapcodeUrl(mc) {
    const code = String(mc).replace(/\s+/g, "");
    return `https://www.mapion.co.jp/route/?nl=1&uc=${encodeURIComponent(code)}`;
  }

  // ---- WMO weather codes → emoji mapping（Open-Meteo 免費 API）--------------
  const WMO = {
    0:  { icon: "☀️", label: "天晴" },
    1:  { icon: "🌤️", label: "大致天晴" },
    2:  { icon: "⛅", label: "多雲" },
    3:  { icon: "☁️", label: "陰天" },
    45: { icon: "🌫️", label: "霧" },
    48: { icon: "🌫️", label: "霧淞" },
    51: { icon: "🌦️", label: "微雨" },
    53: { icon: "🌦️", label: "毛毛雨" },
    55: { icon: "🌦️", label: "密毛雨" },
    56: { icon: "🌦️", label: "凍毛毛雨" },
    57: { icon: "🌦️", label: "密凍毛毛雨" },
    61: { icon: "🌧️", label: "雨" },
    63: { icon: "🌧️", label: "中雨" },
    65: { icon: "🌧️", label: "大雨" },
    66: { icon: "🌧️", label: "凍雨" },
    67: { icon: "🌧️", label: "密凍雨" },
    71: { icon: "❄️", label: "雪" },
    73: { icon: "❄️", label: "中雪" },
    75: { icon: "❄️", label: "大雪" },
    77: { icon: "❄️", label: "雪粒" },
    80: { icon: "🌦️", label: "陣雨" },
    81: { icon: "🌦️", label: "中陣雨" },
    82: { icon: "🌦️", label: "大陣雨" },
    85: { icon: "❄️", label: "小陣雪" },
    86: { icon: "❄️", label: "大陣雪" },
    95: { icon: "⛈️", label: "雷暴" },
    96: { icon: "⛈️", label: "雷暴+雹" },
    99: { icon: "⛈️", label: "強雷暴+雹" },
  };
  const _weatherCache = {}; // "lat,lon|date" → promise of { icon, label, high, low }

  // 從 location 字串拎主要城市 → weatherCoords
  function resolveCoords(locStr, trip) {
    const coords = trip.weatherCoords || {};
    if (coords[locStr]) return coords[locStr];
    const parts = locStr.split(/[→,、\/\s]+/).filter(Boolean);
    for (const p of parts) {
      if (coords[p]) return coords[p];
    }
    for (const key of Object.keys(coords)) {
      if (locStr.includes(key)) return coords[key];
    }
    return null;
  }

  // 用 Open-Meteo API（free，no API key）fetch 單日天氣
  async function fetchWeather(lat, lon, dateStr) {
    const cacheKey = `${lat},${lon}|${dateStr}`;
    if (_weatherCache[cacheKey]) return _weatherCache[cacheKey];
    const promise = (async () => {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=Asia%2FTokyo&start_date=${dateStr}&end_date=${dateStr}`;
      try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        const day = data.daily;
        if (!day || !day.time || !day.time.length) throw new Error("no data");
        const wcode = day.weathercode[0];
        const w = WMO[wcode] || { icon: "🌡️", label: "未知" };
        return { icon: w.icon, label: w.label, high: day.temperature_2m_max[0], low: day.temperature_2m_min[0] };
      } catch (e) {
        console.warn("Weather fetch fail:", e);
        return null;
      }
    })();
    _weatherCache[cacheKey] = promise;
    return promise;
  }

  // Fetch 全日程天氣 → 更新 DOM
  async function loadWeatherForTrip(trip) {
    if (!trip.days) return;
    const unique = {};
    trip.days.forEach((d) => {
      const coords = resolveCoords(d.location, trip);
      if (coords) {
        const key = `${coords.lat},${coords.lon}|${d.date}`;
        if (!unique[key]) unique[key] = { lat: coords.lat, lon: coords.lon, date: d.date, day: d.day };
      }
    });
    const results = await Promise.allSettled(
      Object.values(unique).map((u) => fetchWeather(u.lat, u.lon, u.date))
    );
    Object.values(unique).forEach((u, i) => {
      const badge = document.querySelector(`[data-weather="${u.day}"]`);
      if (!badge) return;
      const r = results[i];
      if (r.status === "fulfilled" && r.value) {
        badge.textContent = `${r.value.icon} ${r.value.high}°/${r.value.low}°`;
        badge.setAttribute("data-tip", `${r.value.label} · 最高 ${r.value.high}°C · 最低 ${r.value.low}°C`);
        badge.className = "weather-badge text-xs px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/20 cursor-default relative";
      } else {
        badge.textContent = "🌡️ N/A";
        badge.className = "weather-badge text-xs px-1.5 py-0.5 rounded bg-white/5 text-white/40";
      }
    });
  }

  // ---- 加相 modal（A 模式：貼 URL → 生成要 push 嘅 snippet）-----------------
  function openAddPhoto(tripId, dayNum, itemTitle, itemIndex) {
    const overlay = el("div", "fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4");
    const box = el("div", "w-full max-w-lg bg-card border border-white/10 rounded-2xl p-5 shadow-2xl");
    box.innerHTML = `
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-base font-bold text-white/90">📸 加相 — ${esc(itemTitle)}</h3>
        <button class="text-white/40 hover:text-white text-xl leading-none" data-close>✕</button>
      </div>
      <p class="text-xs text-white/50 mb-3 leading-relaxed">貼你嘅相 URL（Google Photos / Imgur / GitHub issue 附件）。呢度只係<b class="text-white/70">本機預覽</b>；要 publish 就 copy 底嘅 code 貼落 <code class="text-accent">data.js</code> 再 push 去 master。</p>
      <label class="block text-xs text-white/60 mb-1">相片 URL</label>
      <input data-url class="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/90 outline-none focus:border-accent mb-3" placeholder="https://photos.app.goo.gl/xxxx 或 https://i.imgur.com/yyyy.jpg" />
      <label class="block text-xs text-white/60 mb-1">Caption（一句說明，可留空）</label>
      <input data-cap class="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/90 outline-none focus:border-accent mb-3" placeholder="例如：滑沙超好玩！" />
      <div data-preview class="mb-3 hidden"></div>
      <div class="flex gap-2 mb-3">
        <button data-prev class="flex-1 px-3 py-2 rounded-lg bg-accent/15 text-accent text-sm font-medium hover:bg-accent/25 transition">👁 本機預覽</button>
        <button data-copy class="flex-1 px-3 py-2 rounded-lg bg-emerald-500/15 text-emerald-300 text-sm font-medium hover:bg-emerald-500/25 transition">📋 複製 code</button>
      </div>
      <div data-snippet class="hidden text-[11px] bg-black/40 border border-white/10 rounded-lg p-3 text-white/70 font-mono whitespace-pre-wrap break-all"></div>
    `;
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    const urlI = box.querySelector("[data-url]");
    const capI = box.querySelector("[data-cap]");
    const prevBtn = box.querySelector("[data-prev]");
    const copyBtn = box.querySelector("[data-copy]");
    const prevBox = box.querySelector("[data-preview]");
    const snipBox = box.querySelector("[data-snippet]");

    function buildSnippet() {
      const u = urlI.value.trim();
      const c = capI.value.trim();
      if (!u) return null;
      return `// 喺 data.js 搵到呢個 item，將 info.photos 加埋：\n` +
        `//   ... Day ${dayNum} · ${itemTitle}\n` +
        `info: { ... photos: [ "${u}" ] }\n` +
        (c ? `\n// 想入日誌就加落 trip.journal：\n` +
             `{ day: ${dayNum}, time: "", spot: ${JSON.stringify(itemTitle)}, caption: ${JSON.stringify(c)}, photo: "${u}" }`
           : "");
    }

    function showPreview() {
      const u = urlI.value.trim();
      if (!u) { prevBox.classList.add("hidden"); return; }
      prevBox.classList.remove("hidden");
      prevBox.innerHTML = `<img src="${esc(u)}" class="w-full max-h-60 object-contain rounded-lg bg-black/30" onerror="this.parentNode.innerHTML='<div class=\\'text-xs text-red-300 p-2\\'>⚠️ 相 URL 載唔到，檢查下個 link</div>'" /><div class="text-xs text-white/50 mt-1">${esc(capI.value.trim() || "(無 caption)")}</div>`;
    }
    function showSnippet() {
      const snip = buildSnippet();
      if (!snip) { snipBox.classList.remove("hidden"); snipBox.textContent = "⚠️ 先貼個相 URL"; return; }
      snipBox.classList.remove("hidden");
      snipBox.textContent = snip;
    }

    prevBtn.addEventListener("click", () => { showPreview(); showSnippet(); });
    copyBtn.addEventListener("click", () => {
      const snip = buildSnippet();
      if (!snip) { alert("先貼個相 URL 先啦～"); return; }
      navigator.clipboard.writeText(snip).then(
        () => { copyBtn.textContent = "✅ 已複製！"; setTimeout(() => (copyBtn.textContent = "📋 複製 code"), 1500); },
        () => { showSnippet(); }
      );
    });

    box.querySelector("[data-close]").addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
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

      const hero = el("div", `h-28 bg-gradient-to-br ${trip.gradient} relative flex items-end p-4`);
      hero.innerHTML = `
        <div class="absolute top-3 right-3 px-2 py-0.5 rounded-full text-xs border ${st.cls} bg-card/60 backdrop-blur">${st.label}</div>
        <span class="text-3xl drop-shadow">${esc(trip.emoji || "✈️")}</span>`;
      card.appendChild(hero);

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
    const tabs = el("div", "flex gap-2 mb-5 border-b border-white/5 flex-wrap");
    const tabDefs = [
      { id: "itinerary", label: "📅 每日行程" },
      { id: "journal", label: "📔 旅行日誌" },
      { id: "map", label: "🗺️ 地圖總覽" },
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
            <div class="flex items-center gap-2 flex-wrap">
              <span data-weather="${d.day}" class="weather-badge text-xs px-1.5 py-0.5 rounded bg-white/5 text-white/40 border border-white/10">⏳ 載入天氣...</span>
              <span class="text-xs text-white/40">${fmtDate(d.date)} (${esc(d.weekday || "")}) · 📍 ${esc(d.location || "")}</span>
            </div>
          </div>`;

        const list = el("div", "space-y-2");
        (d.items || []).forEach((it, idx) => {
          const row = el("div", "flex gap-3 items-start");
          const left = el("div", "w-14 shrink-0 text-right pt-0.5");
          left.innerHTML = it.time ? `<span class="text-xs text-white/50 font-mono">${esc(it.time)}</span>` : `<span class="text-xs text-white/20">—</span>`;
          const mid = el("div", "pt-1 text-base leading-none", it.icon || "•");
          const right = el("div", "flex-1");
          const tbcCls = it.tbc ? "border-amber-500/40 bg-amber-500/5" : "border-white/5 bg-white/[0.02]";

          // info block（mapcode / hours / intro / photoSpot）
          let infoHtml = "";
          if (it.info) {
            const info = it.info;
            const mc = info.mapcode
              ? `<a href="${mapcodeUrl(info.mapcode)}" target="_blank" rel="noopener" class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 text-xs font-mono hover:bg-sky-500/25">🧭 ${esc(info.mapcode)} ↗</a>`
              : `<span class="px-2 py-0.5 rounded bg-white/5 text-white/30 text-xs font-mono">mapcode 待填</span>`;
            infoHtml = `
              <div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
                ${mc}
                ${info.hours ? `<span class="px-2 py-0.5 rounded bg-white/5 text-white/60">🕐 ${esc(info.hours)}</span>` : ""}
              </div>
              ${info.intro ? `<div class="text-xs text-white/55 mt-1.5 leading-relaxed">${esc(info.intro)}</div>` : ""}
              ${info.photoSpot ? `<div class="text-xs text-emerald-300/80 mt-1">📸 拍照位：${esc(info.photoSpot)}</div>` : ""}`;
          }

          const photoImgs = (it.info && it.info.photos && it.info.photos.length)
            ? `<div class="mt-2 flex flex-wrap gap-2">` +
              it.info.photos.map((p) => `<a href="${esc(p)}" target="_blank" rel="noopener"><img src="${esc(p)}" class="h-20 w-28 object-cover rounded-lg border border-white/10 hover:border-accent/50" onerror="this.style.display='none'"/></a>`).join("") +
              `</div>`
            : "";

          right.innerHTML = `
            <div class="rounded-lg border ${tbcCls} px-3 py-2">
              <div class="text-sm font-medium ${it.tbc ? "text-amber-200" : "text-white/90"}">${esc(it.title)} ${it.tbc ? '<span class="text-[10px] align-middle ml-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">TBC</span>' : ""}</div>
              ${it.desc ? `<div class="text-xs text-white/50 mt-0.5 leading-relaxed">${esc(it.desc)}</div>` : ""}
              ${it.url ? `<a href="${esc(it.url)}" target="_blank" rel="noopener" class="text-xs text-accent hover:underline mt-1 inline-block">🔗 連結 ↗</a>` : ""}
              ${infoHtml}
              ${photoImgs}
              <button data-addphoto class="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-500/15 text-emerald-300 text-xs font-medium hover:bg-emerald-500/25 transition">📸 加相</button>
            </div>`;
          row.appendChild(left);
          row.appendChild(mid);
          row.appendChild(right);
          list.appendChild(row);

          // 加相 button 事件
          right.querySelector("[data-addphoto]").addEventListener("click", (e) => {
            e.stopPropagation();
            openAddPhoto(trip.id, d.day, it.title, idx);
          });
        });
        card.appendChild(list);

        if (d.hotel) {
          const hf = el("div", "mt-3 pt-3 border-t border-white/5 flex items-center gap-2 text-xs text-white/50");
          hf.innerHTML = `<span>🏨</span><span>${esc(d.hotel)}</span>`;
          card.appendChild(hf);
        }

        node.appendChild(card);
        tl.appendChild(node);
      });
      panes.itinerary.appendChild(tl);
      // 非同步載入天氣（auto-update！）
      loadWeatherForTrip(trip);
    }

    // ---- 旅行日誌（📔 獨立 tab）：按 Day/時間 排時間線 ----
    (function renderJournal() {
      const j = (trip.journal || []).slice().sort((a, b) => {
        if ((a.day || 0) !== (b.day || 0)) return (a.day || 0) - (b.day || 0);
        return String(a.time || "").localeCompare(String(b.time || ""));
      });
      if (!j.length) {
        panes.journal.appendChild(
          el("div", "text-center text-white/40 text-sm py-12",
            "📔 仲未有人寫日誌～<br/>去到景點撳「📸 加相」→ 複製 code 貼落 data.js 嘅 <code class='text-accent'>journal</code> 陣列再 push 就得！")
        );
        return;
      }
      const wrap = el("div", "relative pl-6");
      wrap.innerHTML = `<div class="absolute left-[7px] top-2 bottom-2 w-px bg-gradient-to-b from-pink-400/50 to-white/10"></div>`;
      j.forEach((e) => {
        const node = el("div", "relative mb-5");
        node.appendChild(el("div", "absolute -left-[22px] top-1.5 w-3.5 h-3.5 rounded-full bg-pink-400 ring-4 ring-pink-400/20"));
        const card = el("div", "bg-card border border-white/5 rounded-xl p-3");
        const head = `<div class="flex items-center gap-2 mb-2">
            <span class="px-2 py-0.5 rounded-md bg-pink-400/15 text-pink-300 text-xs font-bold">Day ${esc(e.day || "")}</span>
            ${e.time ? `<span class="text-xs text-white/50 font-mono">${esc(e.time)}</span>` : ""}
            <span class="text-sm font-medium text-white/85">${esc(e.spot || "")}</span>
          </div>`;
        const photo = e.photo
          ? `<a href="${esc(e.photo)}" target="_blank" rel="noopener"><img src="${esc(e.photo)}" class="w-full max-h-80 object-cover rounded-lg border border-white/10 hover:border-pink-400/50" onerror="this.style.display='none'"/></a>`
          : "";
        const cap = e.caption ? `<div class="text-sm text-white/75 mt-2 leading-relaxed">${esc(e.caption)}</div>` : "";
        card.innerHTML = head + (photo ? `<div class="mb-1">${photo}</div>` : "") + cap;
        node.appendChild(card);
        wrap.appendChild(node);
      });
      panes.journal.appendChild(wrap);
    })();

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
        const info = x.info || {};
        const mc = info.mapcode
          ? `<a href="${mapcodeUrl(info.mapcode)}" target="_blank" rel="noopener" class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 text-xs font-mono hover:bg-sky-500/25">🧭 ${esc(info.mapcode)} ↗</a>`
          : "";
        const photos = (info.photos && info.photos.length)
          ? `<div class="mt-2 flex flex-wrap gap-2">` + info.photos.map((p) => `<a href="${esc(p)}" target="_blank" rel="noopener"><img src="${esc(p)}" class="h-20 w-28 object-cover rounded-lg border border-white/10" onerror="this.style.display='none'"/></a>`).join("") + `</div>`
          : "";
        card.innerHTML = `
          <div class="text-sm font-medium text-white/90">${esc(x.title)}</div>
          <div class="text-xs text-white/50 mt-1 leading-relaxed">${esc(x.desc || "")}</div>
          ${mc ? `<div class="mt-2">${mc}</div>` : ""}
          ${info.intro ? `<div class="text-xs text-white/55 mt-1.5 leading-relaxed">${esc(info.intro)}</div>` : ""}
          ${photos}
          ${x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener" class="text-xs text-accent hover:underline mt-1 inline-block">🔗 連結 ↗</a>` : ""}`;
        wrap.appendChild(card);
      });
      panes.extras.appendChild(wrap);
    }

    // ---- map (Google My Maps 多 marker 互動地圖，免 API key) ----
    if (trip.days && trip.days.length) {
      const MYMAPS_MID = "1LuuiiWAbTEBuR2loYXmtRSgLz-vNYZE";
      const mymapsUrl = `https://www.google.com/maps/d/embed?mid=${MYMAPS_MID}`;

      const mapWrap = el("div", "");
      const toolbar = el("div", "flex items-center gap-2 mb-3 flex-wrap");
      const btnOverview = el("button", "px-3 py-1.5 rounded-lg bg-accent/15 text-accent text-xs font-medium hover:bg-accent/25 transition", "🗺️ 切換：路線總覽");
      const btnMyMaps = el("button", "px-3 py-1.5 rounded-lg bg-white/5 text-white/60 text-xs font-medium hover:bg-white/10 transition", "📍 切換：My Maps 景點圖");
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
      frame.src = mymapsUrl;

      btnMyMaps.addEventListener("click", () => {
        frame.src = mymapsUrl;
        btnMyMaps.className = "px-3 py-1.5 rounded-lg bg-accent/15 text-accent text-xs font-medium hover:bg-accent/25 transition";
        btnOverview.className = "px-3 py-1.5 rounded-lg bg-white/5 text-white/60 text-xs font-medium hover:bg-white/10 transition";
      });
      btnOverview.addEventListener("click", () => {
        frame.src = buildOverview(trip);
        btnOverview.className = "px-3 py-1.5 rounded-lg bg-accent/15 text-accent text-xs font-medium hover:bg-accent/25 transition";
        btnMyMaps.className = "px-3 py-1.5 rounded-lg bg-white/5 text-white/60 text-xs font-medium hover:bg-white/10 transition";
      });

      mapWrap.appendChild(toolbar);
      mapWrap.appendChild(frame);

      // 每日景點 chips（點擊 → 新分頁開該景點 Google Maps 連結）
      const list = el("div", "mt-4 space-y-3");
      trip.days.forEach((d) => {
        const grp = el("div", "");
        grp.appendChild(el("div", "text-xs font-bold text-accent/80 mb-1.5", `Day ${d.day} · ${esc(d.title)}`));
        const sub = el("div", "flex flex-wrap gap-2");
        (d.items || []).forEach((it) => {
          if (!it || !it.title) return;
          const label = (it.icon ? it.icon + " " : "") + stripEmoji(it.title).slice(0, 16);
          const chip = el("button", "px-2.5 py-1 rounded-lg bg-white/5 hover:bg-accent/20 text-white/70 text-xs transition text-left", label);
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
