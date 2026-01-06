import fs from "node:fs";
import path from "node:path";
import { XMLParser } from "fast-xml-parser";

const FEED_URL =
  process.env.ROMEOVILLE_RSS_URL ||
  "https://www.romeoville.org/RSSFeed.aspx?ModID=58&CID=All-calendar.xml";

const OUT_FILE = path.join("data", "events.json");

// ---------- helpers ----------
function stripHtml(s = "") {
  return String(s)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function cleanLine(s = "") {
  return String(s).replace(/\s+/g, " ").trim();
}

function parseRomeovilleDescription(descRaw = "") {
  // Romeoville RSS descriptions often contain:
  // Event date: August 6, 2025
  // Event dates: August 4, 2025 - August 10, 2025
  // Event Time: 6:00 PM - 8:00 PM
  // Location: Village Board Room
  const text = stripHtml(descRaw);

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const joined = lines.join("\n");

  const dateRangeMatch =
    joined.match(/Event dates?:\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})(\s*-\s*([A-Za-z]+\s+\d{1,2},\s+\d{4}))?/i) ||
    null;

  const dateStart = dateRangeMatch?.[1] ? cleanLine(dateRangeMatch[1]) : "";
  const dateEnd = dateRangeMatch?.[3] ? cleanLine(dateRangeMatch[3]) : "";

  const timeMatch = joined.match(/Event Time:\s*(.+)/i);
  const time = timeMatch?.[1] ? cleanLine(timeMatch[1]) : "";

  const locMatch = joined.match(/Location:\s*(.+)/i);
  const location = locMatch?.[1] ? cleanLine(locMatch[1]) : "";

  return { dateStart, dateEnd, time, location };
}

function tryParseDate(s) {
  // We only need “good enough” parsing for filtering past events.
  // Date strings are like "August 6, 2025"
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toDisplayDate(dateStart, dateEnd) {
  if (!dateStart) return "";
  if (!dateEnd) return dateStart;
  return `${dateStart} - ${dateEnd}`;
}

function isPastEvent(dateStart, dateEnd) {
  // If a range exists, treat event as active until dateEnd 23:59:59 local.
  const now = new Date();

  const start = tryParseDate(dateStart);
  const end = tryParseDate(dateEnd || dateStart);

  if (!start || !end) return false;

  const endOfDay = new Date(end);
  endOfDay.setHours(23, 59, 59, 999);

  return endOfDay.getTime() < now.getTime();
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

// ---------- main ----------
async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": "github-actions" } });
  if (!res.ok) throw new Error(`Failed to fetch feed: ${res.status} ${res.statusText}`);
  return await res.text();
}

async function main() {
  console.log("Fetching RSS:", FEED_URL);
  const xml = await fetchText(FEED_URL);

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    // keep CDATA text readable
    cdataPropName: "__cdata",
  });

  const doc = parser.parse(xml);

  // RSS shape: rss.channel.item[]
  const items = doc?.rss?.channel?.item
    ? Array.isArray(doc.rss.channel.item)
      ? doc.rss.channel.item
      : [doc.rss.channel.item]
    : [];

  console.log("Items:", items.length);

  const events = items
    .map((it) => {
      const title = cleanLine(it.title ?? "");
      const link = cleanLine(it.link ?? "");

      // description may be in it.description or it["content:encoded"] depending on RSS
      const descRaw =
        typeof it.description === "string"
          ? it.description
          : it.description?.__cdata || it.description || "";

      const { dateStart, dateEnd, time, location } = parseRomeovilleDescription(descRaw);

      return {
        title,
        date: toDisplayDate(dateStart, dateEnd),
        time: time || "",
        location: location || "",
        link
      };
    })
    .filter((e) => e.title) // keep valid
    .filter((e) => {
      // Filter out past events using extracted dates if present
      const [start, end] = (() => {
        // "X - Y" case
        if (e.date.includes(" - ")) {
          const parts = e.date.split(" - ").map((p) => p.trim());
          return [parts[0], parts[1]];
        }
        return [e.date, ""];
      })();

      if (!start) return true; // if no date extracted, keep it
      return !isPastEvent(start, end);
    });

  // Optional: stable sort by parsed start date when possible
  events.sort((a, b) => {
    const aStart = a.date.split(" - ")[0];
    const bStart = b.date.split(" - ")[0];
    const da = tryParseDate(aStart);
    const db = tryParseDate(bStart);
    if (!da && !db) return a.title.localeCompare(b.title);
    if (!da) return 1;
    if (!db) return -1;
    return da.getTime() - db.getTime();
  });

  ensureDir(path.dirname(OUT_FILE));
  fs.writeFileSync(OUT_FILE, JSON.stringify(events, null, 2), "utf8");
  console.log("Wrote:", OUT_FILE, "events:", events.length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
