import { readFileSync, writeFileSync } from "node:fs";

const RAW_PATH = new URL("../data/followers-raw.tsv", import.meta.url);
const OUT_PATH = new URL("../data/followers-history.json", import.meta.url);

const lines = readFileSync(RAW_PATH, "utf8").split("\n").map((l) => l.trim()).filter(Boolean);

const entries = lines.map((line) => {
  const [dateStr, countStr] = line.split("\t");
  const [day, month, yearRaw] = dateStr.split(/[./]/);
  const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
  const isoDate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  const count = Number(countStr.replace(/'/g, ""));
  return { date: isoDate, followerCount: count };
});

entries.sort((a, b) => a.date.localeCompare(b.date));

writeFileSync(OUT_PATH, JSON.stringify(entries, null, 2) + "\n", "utf8");
console.log(`${entries.length} entrées écrites dans data/followers-history.json`);
console.log(`Première : ${entries[0].date} (${entries[0].followerCount})`);
console.log(`Dernière : ${entries.at(-1).date} (${entries.at(-1).followerCount})`);
