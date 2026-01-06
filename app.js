// ====== Scale 1080x1920 to the browser window ======
function scaleStage(){
  const w = 1080, h = 1920;
  const sx = window.innerWidth / w;
  const sy = window.innerHeight / h;
  const s = Math.min(sx, sy);
  document.documentElement.style.setProperty('--scale', s.toString());
}
window.addEventListener('resize', scaleStage);
scaleStage();

// ====== Date + time (local to the player) ======
function formatDate(d){
  const opts = { month:'long', day:'numeric', year:'numeric' };
  const base = d.toLocaleDateString(undefined, opts);
  // Add ordinal suffix (17th)
  const day = d.getDate();
  const suf = (day % 10 === 1 && day !== 11) ? 'st'
            : (day % 10 === 2 && day !== 12) ? 'nd'
            : (day % 10 === 3 && day !== 13) ? 'rd' : 'th';
  return base.replace(String(day), `${day}${suf}`);
}
function tickClock(){
  const now = new Date();
  document.getElementById('dateLine').textContent = formatDate(now);
  document.getElementById('timeLine').textContent =
    now.toLocaleTimeString([], { hour:'numeric', minute:'2-digit' });
}
tickClock();
setInterval(tickClock, 1000);

// ====== Weather (no-key option using Open-Meteo) ======
async function loadWeather(){
  // Romeoville approx: 41.65, -88.09
  const url = "https://api.open-meteo.com/v1/forecast?latitude=41.65&longitude=-88.09&current=temperature_2m,weather_code&temperature_unit=fahrenheit&timezone=auto";
  const r = await fetch(url, { cache: "no-store" });
  const j = await r.json();
  const t = Math.round(j.current.temperature_2m);
  document.getElementById('temp').textContent = `${t}°F`;
  // Simple icon mapping (good enough for signage)
  const code = j.current.weather_code;
  document.getElementById('weatherIcon').textContent =
    (code === 0) ? "☀" :
    ([1,2,3].includes(code)) ? "⛅" :
    ([45,48].includes(code)) ? "🌫" :
    ([51,53,55,61,63,65,80,81,82].includes(code)) ? "🌧" :
    ([71,73,75,77,85,86].includes(code)) ? "❄" :
    ([95,96,99].includes(code)) ? "⛈" : "🌡";
}
loadWeather();
setInterval(loadWeather, 10 * 60 * 1000); // every 10 minutes

// ====== Events list ======
async function loadEvents(){
  const r = await fetch("data/events.json?ts=" + Date.now(), { cache:"no-store" });
  const events = await r.json();

  const list = document.getElementById('eventsList');
  list.innerHTML = "";

  // show 4 like your screenshot (you can paginate like your other project)
  events.slice(0, 4).forEach(ev => {
    const el = document.createElement('div');
    el.className = "event";
    el.innerHTML = `
      <div class="title">${ev.title}</div>
      <div class="meta">Date: ${ev.date}</div>
      <div class="meta">Time: ${ev.time || "—"}</div>
      ${ev.location ? `<div class="meta">Location: ${ev.location}</div>` : ``}
    `;
    list.appendChild(el);
  });
}
loadEvents();
setInterval(loadEvents, 60 * 60 * 1000); // hourly

// ====== Slideshow ======
let slides = [];
let idx = 0;
let showingA = true;

async function loadSlides(){
  const r = await fetch("data/slides.json?ts=" + Date.now(), { cache:"no-store" });
  slides = await r.json(); // ["slides/001.png", ...]
}
function showNextSlide(){
  if (!slides.length) return;
  const next = slides[idx % slides.length];
  idx++;

  const a = document.getElementById('slideA');
  const b = document.getElementById('slideB');

  const incoming = showingA ? b : a;
  const outgoing = showingA ? a : b;

  incoming.src = next;
  incoming.classList.add('visible');
  outgoing.classList.remove('visible');

  showingA = !showingA;
}
(async () => {
  await loadSlides();
  showNextSlide();
  setInterval(showNextSlide, 15000);     // match your playlist timing
  setInterval(loadSlides, 5 * 60 * 1000); // refresh slide list
})();
