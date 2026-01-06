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
  // Romeoville approx
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    "?latitude=41.65&longitude=-88.09" +
    "&current=temperature_2m,weather_code" +
    "&temperature_unit=fahrenheit" +
    "&timezone=auto";

  try{
    const r = await fetch(url, { cache:"no-store" });
    if(!r.ok) throw new Error("Weather fetch failed: " + r.status);
    const j = await r.json();

    const t = Math.round(j.current.temperature_2m);
    const tempEl = document.getElementById('temp');
    if (tempEl) tempEl.textContent = `${t}°F`;

    const code = j.current.weather_code;
    const icon =
      (code === 0) ? "☀" :
      ([1,2,3].includes(code)) ? "⛅" :
      ([45,48].includes(code)) ? "🌫" :
      ([51,53,55,61,63,65,80,81,82].includes(code)) ? "🌧" :
      ([71,73,75,77,85,86].includes(code)) ? "❄" :
      ([95,96,99].includes(code)) ? "⛈" : "🌡";

    const iconEl = document.getElementById('weatherIcon');
    if (iconEl) iconEl.textContent = icon;

    const descEl = document.getElementById('weatherDesc');
    if (descEl) descEl.textContent = "ROMEOVILLE";
  }catch(e){
    console.warn(e);
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
// 6) EVENTS: Pull from the known-good repo, paginate 4/page up to 32 total
// ==============================
const EVENTS_PER_PAGE = 4;
const EVENTS_MAX = 32;
const EVENTS_PAGE_SECONDS = 20;

let eventsCache = [];
let eventsPageIndex = 0;
let eventsPagerTimer = null;

function normalizeEvent(ev){
  // Support a couple possible shapes without breaking
  return {
    title: ev.title ?? ev.name ?? "",
    date: ev.date ?? ev.displayDate ?? "",
    time: ev.time ?? ev.displayTime ?? "",
    location: ev.location ?? ev.venue ?? "",
    link: ev.link ?? ""
  };
}

function renderEventsPage(){
  const list = document.getElementById("eventsList");
  if (!list) return;

  const total = eventsCache.slice(0, EVENTS_MAX);
  if (total.length === 0){
    list.innerHTML = "";
    return;
  }

  const pages = Math.ceil(total.length / EVENTS_PER_PAGE);
  if (eventsPageIndex >= pages) eventsPageIndex = 0;

  const start = eventsPageIndex * EVENTS_PER_PAGE;
  const pageItems = total.slice(start, start + EVENTS_PER_PAGE).map(normalizeEvent);

  // Fade out -> swap -> fade in
  list.classList.remove("fadeIn");
  list.classList.add("fadeOut");

  window.setTimeout(() => {
    list.innerHTML = "";

    pageItems.forEach(ev => {
      const card = document.createElement("div");
      card.className = "event";

      // If you ever want titles clickable, we can enable links — keeping plain for signage stability.
      card.innerHTML = `
        <div class="title">${escapeHtml(ev.title)}</div>
        ${ev.date ? `<div class="meta">Date: ${escapeHtml(ev.date)}</div>` : ``}
        ${ev.time ? `<div class="meta">Time: ${escapeHtml(ev.time)}</div>` : ``}
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

    const events = await r.json();
    if(!Array.isArray(events)) throw new Error("events.json is not an array");

    eventsCache = events.slice(0, EVENTS_MAX);
    eventsPageIndex = 0;

    renderEventsPage();
    startEventsPager();
  }catch(e){
    console.warn(e);
  }
}

loadEvents();
setInterval(loadEvents, 60 * 60 * 1000); // hourly refresh from source

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
