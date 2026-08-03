import { fetchAccountUsername } from "./lib/instagram.js";
import { computeWeekStats } from "./lib/weekly-stats.js";
import { upsertWeek } from "./lib/history-store.js";
import { mondayOf, addDays } from "./lib/dates.js";

/**
 * Calcule et enregistre les statistiques de la dernière semaine complète
 * (celle qui vient de se terminer), ou d'une semaine précise si sa date de
 * lundi est passée en argument (ex: node scripts/compute-week.js 2025-06-02).
 */
async function main() {
  const accessToken = requireEnv("INSTAGRAM_ACCESS_TOKEN");
  const businessAccountId = requireEnv("INSTAGRAM_BUSINESS_ACCOUNT_ID");

  const weekStartArg = process.argv[2];
  const weekStart = weekStartArg ? new Date(`${weekStartArg}T00:00:00Z`) : addDays(mondayOf(new Date()), -7);

  const ownUsername = await fetchAccountUsername({ accessToken, businessAccountId });
  const weekEntry = await computeWeekStats({ accessToken, businessAccountId, ownUsername, weekStart });

  upsertWeek(weekEntry);
  const commentsTotal = weekEntry.posts.reduce((sum, p) => sum + p.commentsTotal, 0);
  const commentsAnswered = weekEntry.posts.reduce((sum, p) => sum + p.commentsAnswered, 0);
  console.log(
    `Semaine ${weekEntry.weekStart} enregistrée : ${weekEntry.posts.length} post(s), ` +
      `${commentsAnswered}/${commentsTotal} commentaire(s) répondu(s).`
  );
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
