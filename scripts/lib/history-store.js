import { readFileSync, writeFileSync, existsSync } from "node:fs";

const HISTORY_PATH = new URL("../../data/history.json", import.meta.url);
const FOLLOWERS_PATH = new URL("../../data/followers-history.json", import.meta.url);

export function readHistory() {
  if (!existsSync(HISTORY_PATH)) return [];
  return JSON.parse(readFileSync(HISTORY_PATH, "utf8"));
}

export function upsertWeek(weekEntry) {
  const history = readHistory();
  const index = history.findIndex((w) => w.weekStart === weekEntry.weekStart);
  if (index >= 0) {
    history[index] = weekEntry;
  } else {
    history.push(weekEntry);
  }
  history.sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2) + "\n", "utf8");
}

export function readFollowerHistory() {
  if (!existsSync(FOLLOWERS_PATH)) return [];
  return JSON.parse(readFileSync(FOLLOWERS_PATH, "utf8"));
}

export function lookupFollowerCount(weekStartISO) {
  const entry = readFollowerHistory().find((f) => f.date === weekStartISO);
  return entry ? entry.followerCount : null;
}

export function upsertFollowerSnapshot(dateISO, followerCount) {
  const history = readFollowerHistory();
  const index = history.findIndex((f) => f.date === dateISO);
  if (index >= 0) {
    history[index] = { date: dateISO, followerCount };
  } else {
    history.push({ date: dateISO, followerCount });
  }
  history.sort((a, b) => a.date.localeCompare(b.date));
  writeFileSync(FOLLOWERS_PATH, JSON.stringify(history, null, 2) + "\n", "utf8");
}
