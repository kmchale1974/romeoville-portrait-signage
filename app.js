// romeoville-portrait-signage/app.js
(() => {
  "use strict";

  // ==============================
  // A) Slideshow manifest selector (?set=...)
  // ==============================
  function setSlideshowManifest() {
    const qs = new URLSearchParams(location.search);

    // Default if no ?set= provided
    const set = (qs.get("set") || "admin").toLowerCase().trim();

    // Map set → manifest name
    // admin uses images.json (your current default)
    // others use images-<set>.json (e.g. images-villagepublic.json)
    const manifest = (set === "admin") ? "images.json" : `images-${set}.json`;

    const slideshowUrl =
      "https://kmchale1974.github.io/Yodeck-HTML-Slideshow/" +
      `?manifest=${encodeURIComponent(manifest)}` +
      `&refresh=5&dur=10&fade=500&captions=0`;

    const frame = document.getElementById("slideshowFrame");
    if (frame) frame.src = slideshowUrl;
  }
  setSlideshowManifest();

  // ==============================
  // 1) Scale the fixed 1080x1920 stage to the browser
  // ==============================
  function scaleStage() {
    const w = 1080, h = 1920;
    const sx = window.innerWidth / w;
    const sy = window.innerHeight / h;
    const s = Math.min(sx, sy);
    document.documentElement.style.setProperty("--scale", String(s));
  }
  window.addEventListener("resize", scaleStage);
  scaleStage();

  // ==============================
  // 2) Midnight hard-refresh
  // ==============================
  setInterval(() => {
    const n = new Date();
    if (n.getHours() === 0 && n.getMinutes() === 0 && n.getSeconds() < 2) {
      location.reload();
    }
  }, 1000);

  // ==============================
  // 3) Date + time (Month Day Year, 12-hour)
  // ==============================
  function formatDateWithOrdinal(d) {
    const month = d.toLocaleDateString("en-US", { month: "long" });
    const day = d.getDate();
    const year = d.getFullYear();

    const suf =
      (day % 10 === 1 && day !== 11) ? "st" :
      (day % 10 === 2 && day !== 12) ? "nd" :
      (day % 10 === 3 && day !== 13) ? "rd" : "th";

    return `${month} ${day}${suf}, ${year}`;
  }

  function tickClock() {
    const now = new Date();
    const dateEl = document.getElementById("dateLine");
    const timeEl = document.getElementById("timeLine");

    if (dateEl) dateEl.textContent = formatDateWithOrdinal(now);

    if (timeEl) {
      timeEl.textContent = now.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true
      });
    }
  }
  tickClock();
  setInterval(tickClock, 1000);

  // ==============================
  // 4) Weather (from data/weather.json) + SVG icon (no emoji)
  // ==============================
  async function loadWeather() {
    const tempEl = document.getElementById("temp");
    const iconEl = document.getElementById("weatherIcon");
    const descEl = document.getElementById("weatherDesc");
    if (!tempEl || !iconEl) return;

    function svgIcon(kind) {
      const common = `fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"`;
      const wrap = (inner) =>
        `<svg viewBox="0 0 64 64" role="img" aria-label="${kind}">${inner}</svg>`;

      const sun = wrap(`
        <g ${common}>
          <circle cx="32" cy="32" r="10"></circle>
          <path d="M32 6v8M32 50v8M6 32h8M50 32h8"></path>
          <path d="M13 13l6 6M45 45l6 6M51 13l-6 6M19 45l-6 6"></path>
        </g>
      `);

      const cloud = wrap(`
        <g ${common}>
          <path d="M20 44h26a10 10 0 0 0 0-20 14 14 0 0 0-27-3A11 11 0 0 0 20 44z"></path>
        </g>
      `);

      const partly = wrap(`
        <g ${common}>
          <circle cx="22" cy="22" r="7"></circle>
          <path d="M22 7v4M22 33v4M7 22h4M33 22h4"></path>
          <path d="M14 14l3 3M27 27l3 3M30 14l-3 3M17 27l-3 3"></path>
          <path d="M22 46h26a9 9 0 0 0 0-18 13 13 0 0 0-25-2A10 10 0 0 0 22 46z"></path>
        </g>
      `);

      const fog = wrap(`
        <g ${common}>
          <path d="M14 26h36"></path>
          <path d="M10 34h44"></path>
          <path d="M14 42h36"></path>
        </g>
      `);

      const rain = wrap(`
        <g ${common}>
          <path d="M18 40h28a9 9 0 0 0 0-18 13 13 0 0 0-25-2A10 10 0 0 0 18 40z"></path>
          <path d="M22 44l-3 8"></path>
          <path d="M32 44l-3 8"></path>
          <path d="M42 44l-3 8"></path>
        </g>
      `);

      const snow = wrap(`
        <g ${common}>
          <path d="M18 38h28a9 9 0 0 0 0-18 13 13 0 0 0-25-2A10 10 0 0 0 18 38z"></path>
          <circle cx="24" cy="48" r="2"></circle>
          <circle cx="32" cy="52" r="2"></circle>
          <circle cx="40" cy="48" r="2"></circle>
        </g>
      `);

      const thunder = wrap(`
        <g ${common}>
          <path d="M18 38h28a9 9 0 0 0 0-18 13 13 0 0 0-25-2A10 10 0 0 0 18 38z"></path>
          <path d="M30 38l-6 12h7l-3 10 12-18h-7l3-4z"></path>
        </g>
      `);

      const thermo = wrap(`
        <g ${common}>
          <path d="M30 14a6 6 0 0 1 12 0v20a10 10 0 1 1-12 0V14z"></path>
          <path d="M36 18v22"></path>
        </g>
      `);

      switch (kind) {
        case "sun": return sun;
        case "cloud": return cloud;
        case "partly": return partly;
        case "fog": return fog;
        case "rain": return rain;
        case "snow": return snow;
        case "thunder": return thunder;
        default: return thermo;
      }
    }

    function kindFromCode(code) {
      const c = Number(code ?? 0);
      if (c === 0) return "sun";
      if ([1, 2, 3].includes(c)) return "partly";
      if ([45, 48].includes(c)) return "fog";
      if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(c)) return "rain";
      if ([71, 73, 75, 77, 85, 86].includes(c)) return "snow";
      if ([95, 96, 99].includes(c)) return "thunder";
      return "thermo";
    }

    try {
      const r = await fetch("data/weather.json?ts=" + Date.now(), { cache: "no-store" });
      if (!r.ok) throw new Error("weather.json fetch failed");

      const j = await r.json();
      if (j?.temp_f == null) throw new Error("weather.json missing temp_f");

      tempEl.textContent = `${j.temp_f}°F`;

      const kind = kindFromCode(j.weather_code);
      iconEl.innerHTML = svgIcon(kind);
      iconEl.style.color = "#ffffff";

      if (descEl) descEl.textContent = "ROMEOVILLE";
    } catch (e) {
      console.warn(e);
      tempEl.textContent = "N/A";
      iconEl.innerHTML = svgIcon("thermo");
      iconEl.style.color = "#ffffff";
    }
  }

  loadWeather();
  setInterval(loadWeather, 10 * 60 * 1000);

  // ==============================
  // 5) Escape helper
  // ==============================
  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ==============================
  // 6) EVENTS (from romeoville-events-portrait-display)
  // ==============================
  const EVENTS_PER_PAGE = 4;
  const EVENTS_MAX = 32;
  const EVENTS_PAGE_SECONDS = 20;
  const EVENTS_MONTHS_AHEAD = 4;

  let eventsCache = [];
  let eventsPageIndex = 0;
  let eventsPagerTimer = null;

  function parseDateSafe(iso) {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function addMonths(date, months) {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
  }

  function buildEventsCache(raw) {
    const now = new Date();
    const maxDate = addMonths(now, EVENTS_MONTHS_AHEAD);

    return raw
      .map(ev => ({
        title: ev.title ?? "",
        start: parseDateSafe(ev.start),
        end: parseDateSafe(ev.end),
        location: ev.location ?? ""
      }))
      .filter(e => e.title && e.start)
      .filter(e => e.start >= now && e.start <= maxDate)
      .sort((a, b) => a.start - b.start)
      .slice(0, EVENTS_MAX);
  }

  function formatDateLine(d) {
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric"
    });
  }

  function formatTimeLine(start, end) {
    const fmt = d => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    if (!end) return fmt(start);
    if (Math.abs(end - start) < 60000) return fmt(start);
    return `${fmt(start)} – ${fmt(end)}`;
  }

  function renderEventsPage() {
    const list = document.getElementById("eventsList");
    if (!list) return;

    const total = eventsCache;
    if (!total.length) {
      list.innerHTML = "";
      return;
    }

    const pages = Math.ceil(total.length / EVENTS_PER_PAGE);
    if (eventsPageIndex >= pages) eventsPageIndex = 0;

    const startIdx = eventsPageIndex * EVENTS_PER_PAGE;
    const pageItems = total.slice(startIdx, startIdx + EVENTS_PER_PAGE);

    list.classList.remove("fadeIn");
    list.classList.add("fadeOut");

    setTimeout(() => {
      list.innerHTML = "";

      pageItems.forEach(ev => {
        const card = document.createElement("div");
        card.className = "event";
        card.innerHTML = `
          <div class="title">${escapeHtml(ev.title)}</div>
          <div class="meta">Date: ${escapeHtml(formatDateLine(ev.start))}</div>
          <div class="meta">Time: ${escapeHtml(formatTimeLine(ev.start, ev.end))}</div>
          ${ev.location ? `<div class="meta">Location: ${escapeHtml(ev.location)}</div>` : ``}
        `;
        list.appendChild(card);
      });

      list.classList.remove("fadeOut");
      list.classList.add("fadeIn");

      eventsPageIndex = (eventsPageIndex + 1) % pages;
    }, 350);
  }

  function startEventsPager() {
    if (eventsPagerTimer) clearInterval(eventsPagerTimer);
    eventsPagerTimer = setInterval(renderEventsPage, EVENTS_PAGE_SECONDS * 1000);
  }

  async function loadEvents() {
    try {
      const url =
        "https://kmchale1974.github.io/romeoville-events-portrait-display/events.json?ts=" +
        Date.now();

      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) throw new Error("Events fetch failed");

      const raw = await r.json();
      if (!Array.isArray(raw)) throw new Error("events.json not array");

      eventsCache = buildEventsCache(raw);
      eventsPageIndex = 0;

      renderEventsPage();
      startEventsPager();
    } catch (e) {
      console.warn(e);
    }
  }

  loadEvents();
  setInterval(loadEvents, 60 * 60 * 1000);
})();
