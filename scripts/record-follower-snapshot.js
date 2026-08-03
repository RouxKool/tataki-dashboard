import { fetchAccountFollowerCount } from "./lib/instagram.js";
import { upsertFollowerSnapshot } from "./lib/history-store.js";
import { mondayOf, formatISODate } from "./lib/dates.js";

async function main() {
  const accessToken = requireEnv("INSTAGRAM_ACCESS_TOKEN");
  const businessAccountId = requireEnv("INSTAGRAM_BUSINESS_ACCOUNT_ID");

  const followerCount = await fetchAccountFollowerCount({ accessToken, businessAccountId });
  const weekStartISO = formatISODate(mondayOf(new Date()));

  upsertFollowerSnapshot(weekStartISO, followerCount);
  console.log(`Instantané abonnés enregistré pour la semaine du ${weekStartISO} : ${followerCount}`);
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Variable d'environnement manquante : ${name}`);
  return value;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
