import fs from "node:fs";
import path from "node:path";

const SLIDES_DIR = "slides";
const OUT_FILE = path.join("data", "slides.json");

// Allowed slide extensions
const EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function naturalSort(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function main() {
  if (!fs.existsSync(SLIDES_DIR)) {
    console.warn(`No /${SLIDES_DIR} folder found. Creating empty slides.json.`);
    ensureDir(path.dirname(OUT_FILE));
    fs.writeFileSync(OUT_FILE, JSON.stringify([], null, 2), "utf8");
    return;
  }

  const files = fs
    .readdirSync(SLIDES_DIR, { withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => d.name)
    .filter((name) => EXT.has(path.extname(name).toLowerCase()))
    .sort(naturalSort);

  // Store as web paths (relative to repo root)
  const slides = files.map((f) => `${SLIDES_DIR}/${f}`);

  ensureDir(path.dirname(OUT_FILE));
  fs.writeFileSync(OUT_FILE, JSON.stringify(slides, null, 2), "utf8");
  console.log("Wrote:", OUT_FILE, "slides:", slides.length);
}

main();
