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
// 2) Midnight hard-refresh
// ==============================
setInterval(() => {
  const n = new Date();
  if (n.getHours() === 0 && n.getMinutes() === 0 && n.getSeconds() < 2) {
    location.reload();
  }
}, 1000);

// ==============================
// 3) Date + time
// ==============================
function formatDateWithOrdinal(d){
  const opts = { month:'long', day:'numeric', year:'numeric' };
  const base = d.toLocaleDateString(undefined, opts);

  const day = d.getDate();
  const suf =
    (day % 10 === 1 && day !== 11) ? 'st' :
    (day % 10 === 2 && day !== 12) ? 'nd' :
    (day % 10 === 3 && day !== 13) ? 'rd' : 'th';

  return base.replace(String(day), `${day}${suf}`);
}

function tickClock(){
  const now = new Date();

  const dateEl = document.getElementById('dateLine');
  const timeEl = document.getElementById('timeLine');

  if (dateEl) dateEl.textContent = formatDateWithOrdinal(now);
  if (timeEl) {
    timeEl.textContent = now.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit'
    });
  }
}
tickClock();
setInterval(tickClock, 1000);

// ==============================
// 4) Weather (from data/weather.json)
// ==============================
async function loadWeather(){
  const tempEl = document.getElementById('temp');
  const iconEl = document.getElementById('weatherIcon');
  const descEl = document.getElementById('weatherDesc');
  if (!tempEl || !iconEl) return;

  function iconFromCode(code){
    return (code === 0) ? "☀" :
      ([1,2,3].includes(code)) ? "⛅" :
      ([45,48].includes(code)) ? "🌫" :
      ([51,53,55,61,63,65,80,81,82].includes(code)) ? "🌧" :
      ([71,73,75,77,85,86].includes(code)) ? "❄" :
      ([95,96,99].includes(code)) ? "⛈" : "🌡";
  }

  try{
    const r = await fetch("data/weather.json?ts=" + Date.now(), { cache:"no-store" });
    if (!r.ok) throw new Error("weather.json fetch failed");

    const j = await r.json();
    if (j?.temp_f == null) throw new Error("weather.json missing temp_f");

    tempEl.textContent = `${j.temp_f}°F`;
    iconEl.textContent = iconFromCode(Number(j.weather_code ?? 0));
    if (descEl) descEl.textContent = "ROMEOVILLE";
  }catch(e){
    console.warn(e);
    tempEl.textContent = "N/A";
  }
}

loadWeather();
setInterval(loadWeather, 10 * 60 * 1000);

// ==============================
// 5) Escape helper
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
// 6) EVENTS (from portrait-display repo)
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

function buildEventsCache(raw){
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
    .sort((a,b) => a.start - b.start)
    .slice(0, EVENTS_MAX);
}

function formatDateLine(d){
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
}

function formatTimeLine(start, end){
  const fmt = d => d.toLocaleTimeString([], { hour:"numeric", minute:"2-digit" });
  if (!end) return fmt(start);
  if (Math.abs(end - start) < 60000) return fmt(start);
  return `${fmt(start)} – ${fmt(end)}`;
}

function renderEventsPage(){
  const list = document.getElementById("eventsList");
  if (!list) return;

  const total = eventsCache;
  if (!total.length){
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
    if (!r.ok) throw new Error("Events fetch failed");

    const raw = await r.json();
    if (!Array.isArray(raw)) throw new Error("events.json not array");

    eventsCache = buildEventsCache(raw);
    eventsPageIndex = 0;

    renderEventsPage();
    startEventsPager();
  }catch(e){
    console.warn(e);
  }
}

loadEvents();
setInterval(loadEvents, 60 * 60 * 1000);
