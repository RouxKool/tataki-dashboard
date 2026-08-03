import { fetchPostInsights } from "./lib/instagram.js";
import { readHistory, upsertWeek } from "./lib/history-store.js";

/**
 * Recalcule uniquement l'engagement (total_interactions/shares/plays) des
 * posts qui l'ont manqué (ex: à cause d'un bug déjà corrigé), sans refaire
 * l'appel bien plus coûteux aux commentaires. Beaucoup plus rapide qu'un
 * vrai backfill quand seule cette partie doit être reprise.
 */
async function main() {
  const accessToken = requireEnv("INSTAGRAM_ACCESS_TOKEN");
  const history = readHistory();

  let repaired = 0;
  for (const week of history) {
    let changed = false;
    for (const post of week.posts) {
      if (post.totalInteractions != null) continue;
      const insights = await fetchPostInsights({
        accessToken,
        postId: post.id,
        isReel: post.mediaProductType === "REELS",
      });
      post.shares = insights.shares;
      post.totalInteractions = insights.totalInteractions;
      post.plays = insights.plays;
      changed = true;
      repaired++;
    }
    if (changed) {
      upsertWeek(week);
      console.log(`Semaine ${week.weekStart} : engagement réparé.`);
    }
  }

  console.log(`Terminé — ${repaired} post(s) réparé(s).`);
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
