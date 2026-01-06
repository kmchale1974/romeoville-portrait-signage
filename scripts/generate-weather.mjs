import fs from "node:fs";
import path from "node:path";

const OUT_FILE = path.join("data", "weather.json");

// Romeoville approx
const LAT = 41.65;
const LON = -88.09;

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

async function main() {
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${LAT}&longitude=${LON}` +
    "&current=temperature_2m,weather_code" +
    "&temperature_unit=fahrenheit" +
    "&timezone=America/Chicago";

  const res = await fetch(url, { headers: { "User-Agent": "github-actions" } });
  if (!res.ok) throw new Error(`Weather fetch failed: ${res.status} ${res.statusText}`);

  const j = await res.json();

  const t = Math.round(j?.current?.temperature_2m);
  const code = Number(j?.current?.weather_code ?? 0);

  const out = {
    fetched_at: new Date().toISOString(),
    temp_f: Number.isFinite(t) ? t : null,
    weather_code: code
  };

  ensureDir(path.dirname(OUT_FILE));
  fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2), "utf8");
  console.log("Wrote:", OUT_FILE, out);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
