// ==============================
// 1) Scale the fixed 1080x1920 stage to the browser
// ==============================
function scaleStage(){
  const w = 1080, h = 1920;
  const sx = window.innerWidth / w;
  const sy = window.innerHeight / h;
  const s = Math.min(sx, sy);
  document.documentElement.style.setProperty('--scale', String(s));
}
window.addEventListener('resize', scaleStage);
scaleStage();

// ==============================
// 2) Midnight hard-refresh (as requested)
// ==============================
setInterval(() => {
  const n = new Date();
  if (n.getHours() === 0 && n.getMinutes() === 0 && n.getSeconds() < 2) location.reload();
}, 1000);

// ==============================
// 3) Date + time widgets
// ==============================
function formatDateWithOrdinal(d){
  const opts = { month:'long', day:'numeric', year:'numeric' };
  const base = d.toLocaleDateString(undefined, opts);

  const day = d.getDate();
  const suf = (day % 10 === 1 && day !== 11) ? 'st'
            : (day % 10 === 2 && day !== 12) ? 'nd'
            : (day % 10 === 3 && day !== 13) ? 'rd'
            : 'th';

  return base.replace(String(day), `${day}${suf}`);
}

function tickClock(){
  const now = new Date();
  const dateEl = document.getElementById('dateLine');
  const timeEl = document.getElementById('timeLine');
  if (dateEl) dateEl.textContent = formatDateWithOrdinal(now);
  if (timeEl) timeEl.textContent = now.toLocaleTimeString([], { hour:'numeric', minute:'2-digit' });
}
tickClock();
setInterval(tickClock, 1000);

// ==============================
// 4) Weather (Open-Meteo, no API key)
// ==============================
async function loadWeather(){
  const tempEl = document.getElementById('temp');
  const iconEl = document.getElementById('weatherIcon');
  const descEl = document.getElementById('weatherDesc');

  // If the elements aren't on the page yet, bail safely.
  if (!tempEl || !iconEl) return;

  // Romeoville approx
  const urlNew =
    "https://api.open-meteo.com/v1/forecast" +
    "?latitude=41.65&longitude=-88.09" +
    "&current=temperature_2m,weather_code" +
    "&temperature_unit=fahrenheit" +
    "&timezone=auto";

  const urlOld =
    "https://api.open-meteo.com/v1/forecast" +
    "?latitude=41.65&longitude=-88.09" +
    "&current_weather=true" +
    "&temperature_unit=fahrenheit" +
    "&timezone=auto";

  function iconFromCode(code){
    return (code === 0) ? "☀" :
      ([1,2,3].includes(code)) ? "⛅" :
      ([45,48].includes(code)) ? "🌫" :
      ([51,53,55,61,63,65,80,81,82].includes(code)) ? "🌧" :
      ([71,73,75,77,85,86].includes(code)) ? "❄" :
      ([95,96,99].includes(code)) ? "⛈" : "🌡";
  }

  try{
    // Try new API shape first
    let r = await fetch(urlNew, { cache:"no-store" });
    if (!r.ok) throw new Error("Weather (new) HTTP " + r.status);
    let j = await r.json();

    if (j?.current?.temperature_2m == null) throw new Error("Weather (new) missing current.temperature_2m");

    const t = Math.round(j.current.temperature_2m);
    tempEl.textContent = `${t}°F`;
    iconEl.textContent = iconFromCode(j.current.weather_code ?? 0);
    if (descEl) descEl.textContent = "ROMEOVILLE";
    return;
  }catch(errNew){
    console.warn("Open-Meteo new format failed:", errNew);
  }

  try{
    // Fall back to old API shape
    let r = await fetch(urlOld, { cache:"no-store" });
    if (!r.ok) throw new Error("Weather (old) HTTP " + r.status);
    let j = await r.json();

    if (j?.current_weather?.temperature == null) throw new Error("Weather (old) missing current_weather.temperature");

    const t = Math.round(j.current_weather.temperature);
    tempEl.textContent = `${t}°F`;
    // old format doesn't provide the same code set; keep existing icon or show thermometer
    iconEl.textContent = "🌡";
    if (descEl) descEl.textContent = "ROMEOVILLE";
  }catch(errOld){
    console.warn("Open-Meteo old format failed:", errOld);
    // Keep whatever is currently shown, but make it obvious it's unavailable
    tempEl.textContent = `N/A`;
  }
}
loadWeather();
setInterval(loadWeather, 10 * 60 * 1000); // every 10 minutes

// ==============================
// 5) HTML escaping helper
// ==============================
function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

// ==============================
// 6) EVENTS: Pull from the known-good repo and render like portrait-display
// - 4 per page
// - up to 32 total
// - only within next 4 months
// - auto-advance every 20s with fade
// ==============================
const EVENTS_PER_PAGE = 4;
const EVENTS_MAX = 32;
const EVENTS_PAGE_SECONDS = 20;
const EVENTS_MONTHS_AHEAD = 4;

let eventsCache = [];
let eventsPageIndex = 0;
let eventsPagerTimer = null;

function parseDateSafe(iso){
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function addMonths(date, months){
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function formatDateLine(startDate){
  // Example: "Fri, Jan 9"
  return startDate.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
}

function formatTimeLine(startDate, endDate){
  // Example: "5:00 PM – 11:59 PM"
  const fmt = (d) =>
    d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  // If end is missing, just show start time
  if (!endDate) return fmt(startDate);

  // If start/end are identical or very close, show just start
  if (Math.abs(endDate.getTime() - startDate.getTime()) < 60 * 1000) return fmt(startDate);

  return `${fmt(startDate)} – ${fmt(endDate)}`;
}

function normalizeEvent(ev){
  // Source JSON shape (from portrait-display):
  // { title, start, end, location }
  const start = parseDateSafe(ev.start);
  const end = parseDateSafe(ev.end);

  return {
    title: ev.title ?? "",
    start,
    end,
    location: ev.location ?? ""
  };
}

function withinWindow(start, now, maxDate){
  if (!start) return false;
  return start.getTime() >= now.getTime() && start.getTime() <= maxDate.getTime();
}

function buildEventsCache(raw){
  const now = new Date();
  const maxDate = addMonths(now, EVENTS_MONTHS_AHEAD);

  const normalized = raw
    .map(normalizeEvent)
    .filter(e => e.title && e.start)                         // must have title + start
    .filter(e => withinWindow(e.start, now, maxDate))        // next 4 months only
    .sort((a, b) => a.start.getTime() - b.start.getTime());  // soonest first

  return normalized.slice(0, EVENTS_MAX);
}

function renderEventsPage(){
  const list = document.getElementById("eventsList");
  if (!list) return;

  const total = eventsCache;
  if (total.length === 0){
    list.innerHTML = "";
    return;
  }

  const pages = Math.ceil(total.length / EVENTS_PER_PAGE);
  if (eventsPageIndex >= pages) eventsPageIndex = 0;

  const startIdx = eventsPageIndex * EVENTS_PER_PAGE;
  const pageItems = total.slice(startIdx, startIdx + EVENTS_PER_PAGE);

  // Fade out -> swap -> fade in
  list.classList.remove("fadeIn");
  list.classList.add("fadeOut");

  window.setTimeout(() => {
    list.innerHTML = "";

    pageItems.forEach(ev => {
      const dateLine = formatDateLine(ev.start);
      const timeLine = formatTimeLine(ev.start, ev.end);

      const card = document.createElement("div");
      card.className = "event";

      card.innerHTML = `
        <div class="title">${escapeHtml(ev.title)}</div>
        <div class="meta">Date: ${escapeHtml(dateLine)}</div>
        <div class="meta">Time: ${escapeHtml(timeLine)}</div>
        ${ev.location ? `<div class="meta">Location: ${escapeHtml(ev.location)}</div>` : ``}
      `;

      list.appendChild(card);
    });

    list.classList.remove("fadeOut");
    list.classList.add("fadeIn");

    eventsPageIndex = (eventsPageIndex + 1) % pages;
  }, 350);
}

function startEventsPager(){
  if (eventsPagerTimer) clearInterval(eventsPagerTimer);
  eventsPagerTimer = setInterval(renderEventsPage, EVENTS_PAGE_SECONDS * 1000);
}

async function loadEvents(){
  try{
    const url =
      "https://kmchale1974.github.io/romeoville-events-portrait-display/events.json?ts=" +
      Date.now();

    const r = await fetch(url, { cache:"no-store" });
    if(!r.ok) throw new Error("Events fetch failed: " + r.status);

    const raw = await r.json();
    if(!Array.isArray(raw)) throw new Error("events.json is not an array");

    eventsCache = buildEventsCache(raw);
    eventsPageIndex = 0;

    renderEventsPage();
    startEventsPager();
  }catch(e){
    console.warn(e);
  }
}

loadEvents();
setInterval(loadEvents, 60 * 60 * 1000); // refresh hourly

// ==============================
// 7) Slideshow (kept as-is; will work once data/slides.json has real images)
// ==============================
let slides = [];
let idx = 0;
let showingA = true;

async function loadSlides(){
  try{
    const r = await fetch("data/slides.json?ts=" + Date.now(), { cache:"no-store" });
    if(!r.ok) throw new Error("Slides fetch failed: " + r.status);
    const j = await r.json();
    if(!Array.isArray(j)) throw new Error("slides.json is not an array");
    slides = j;
  }catch(e){
    console.warn(e);
  }
}

function showNextSlide(){
  if(!slides.length) return;

  const nextSrc = slides[idx % slides.length];
  idx++;

  const a = document.getElementById('slideA');
  const b = document.getElementById('slideB');
  if (!a || !b) return;

  const incoming = showingA ? b : a;
  const outgoing = showingA ? a : b;

  incoming.src = nextSrc;
  incoming.classList.add('visible');
  outgoing.classList.remove('visible');

  showingA = !showingA;
}

(async () => {
  await loadSlides();
  showNextSlide();
  setInterval(showNextSlide, 15000);
  setInterval(loadSlides, 5 * 60 * 1000);
})();
