import { fetchAccountUsername } from "./lib/instagram.js";
import { computeWeekStats } from "./lib/weekly-stats.js";
import { readHistory, upsertWeek } from "./lib/history-store.js";
import { mondayOf, addDays, formatISODate } from "./lib/dates.js";

const START_DATE = process.argv[2] ?? "2025-01-06"; // premier lundi du stock d'abonnés

/**
 * Recalcule l'historique semaine par semaine depuis START_DATE jusqu'à la
 * dernière semaine complète. Reprend automatiquement là où il s'était
 * arrêté (les semaines déjà présentes dans data/history.json sont
 * sautées) — utile si l'API Instagram limite le nombre d'appels et qu'il
 * faut relancer le script plus tard.
 */
async function main() {
  const accessToken = requireEnv("INSTAGRAM_ACCESS_TOKEN");
  const businessAccountId = requireEnv("INSTAGRAM_BUSINESS_ACCOUNT_ID");

  const ownUsername = await fetchAccountUsername({ accessToken, businessAccountId });

  const alreadyDone = new Set(readHistory().map((w) => w.weekStart));
  const lastCompletedMonday = addDays(mondayOf(new Date()), -7);

  const weeksToProcess = [];
  for (let cursor = new Date(`${START_DATE}T00:00:00Z`); cursor <= lastCompletedMonday; cursor = addDays(cursor, 7)) {
    const iso = formatISODate(cursor);
    if (!alreadyDone.has(iso)) weeksToProcess.push(new Date(cursor));
  }

  console.log(`${weeksToProcess.length} semaine(s) à calculer (${alreadyDone.size} déjà faites).`);

  for (const [index, weekStart] of weeksToProcess.entries()) {
    const label = formatISODate(weekStart);
    try {
      const weekEntry = await computeWeekStats({ accessToken, businessAccountId, ownUsername, weekStart });
      upsertWeek(weekEntry);
      const commentsTotal = weekEntry.posts.reduce((sum, p) => sum + p.commentsTotal, 0);
      const commentsAnswered = weekEntry.posts.reduce((sum, p) => sum + p.commentsAnswered, 0);
      console.log(
        `[${index + 1}/${weeksToProcess.length}] ${label} : ${weekEntry.posts.length} post(s), ` +
          `${commentsAnswered}/${commentsTotal} commentaire(s) répondu(s).`
      );
    } catch (error) {
      console.error(`Échec sur la semaine ${label} : ${error.message}`);
      console.error("Arrêt du script — relance-le plus tard, il reprendra à cette semaine (les précédentes sont sauvegardées).");
      process.exit(1);
    }
  }

  console.log("Rattrapage terminé.");
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
