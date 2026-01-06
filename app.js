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
  document.getElementById('dateLine').textContent = formatDateWithOrdinal(now);
  document.getElementById('timeLine').textContent =
    now.toLocaleTimeString([], { hour:'numeric', minute:'2-digit' });
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
    document.getElementById('temp').textContent = `${t}°F`;

    const code = j.current.weather_code;
    const icon =
      (code === 0) ? "☀" :
      ([1,2,3].includes(code)) ? "⛅" :
      ([45,48].includes(code)) ? "🌫" :
      ([51,53,55,61,63,65,80,81,82].includes(code)) ? "🌧" :
      ([71,73,75,77,85,86].includes(code)) ? "❄" :
      ([95,96,99].includes(code)) ? "⛈" : "🌡";

    document.getElementById('weatherIcon').textContent = icon;
    document.getElementById('weatherDesc').textContent = "ROMEOVILLE";
  }catch(e){
    // keep last known values; just avoid crashing signage
    console.warn(e);
  }
}
loadWeather();
setInterval(loadWeather, 10 * 60 * 1000); // every 10 minutes

// ==============================
// 5) Events list (reads data/events.json)
// Expected shape (example):
// [
//   {"title":"Village Board Meeting","date":"Wed, Feb 18, 2026","time":"6:00 PM - 8:00 PM","location":"Village Board Room"},
//   ...
// ]
// ==============================
function renderEvents(events){
  const list = document.getElementById('eventsList');
  list.innerHTML = "";

  // choose how many show at once
  const visible = events.slice(0, 4);

  visible.forEach(ev => {
    const card = document.createElement('div');
    card.className = "event fadeIn";
    card.innerHTML = `
      <div class="title">${escapeHtml(ev.title ?? "")}</div>
      <div class="meta">Date: ${escapeHtml(ev.date ?? "—")}</div>
      <div class="meta">Time: ${escapeHtml(ev.time ?? "—")}</div>
      ${ev.location ? `<div class="meta">Location: ${escapeHtml(ev.location)}</div>` : ``}
    `;
    list.appendChild(card);
  });
}

async function loadEvents(){
  try{
    const url = "https://kmchale1974.github.io/romeoville-events-portrait-display/events.json?ts=" + Date.now();
    const r = await fetch(url, { cache:"no-store" });
    if(!r.ok) throw new Error("Events fetch failed: " + r.status);

    const events = await r.json();
    if(!Array.isArray(events)) throw new Error("events.json is not an array");

    renderEvents(events);
  }catch(e){
    console.warn(e);
  }
}
loadEvents();
setInterval(loadEvents, 60 * 60 * 1000); // hourly

function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

// ==============================
// 6) Slideshow (reads data/slides.json)
// slides.json example:
// ["slides/001.jpg","slides/002.jpg","slides/003.jpg"]
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

  const incoming = showingA ? b : a;
  const outgoing = showingA ? a : b;

  // preload by setting src, then fade
  incoming.src = nextSrc;
  incoming.classList.add('visible');
  outgoing.classList.remove('visible');

  showingA = !showingA;
}

(async () => {
  await loadSlides();
  showNextSlide();
  setInterval(showNextSlide, 15000);       // 15s per slide (adjust to match your playlist)
  setInterval(loadSlides, 5 * 60 * 1000);  // refresh slide list
})();
