import { fetchPostsInRange, computePostStats } from "./instagram.js";
import { addDays, formatISODate } from "./dates.js";
import { lookupFollowerCount } from "./history-store.js";

/**
 * Calcule les statistiques (par post) d'une semaine (lundi → dimanche).
 * Les agrégats (taux de réponse, engagement, vues...) sont recalculés à la
 * volée côté dashboard à partir de la liste des posts — une seule source de
 * vérité, pas de risque que des totaux stockés se désynchronisent du détail.
 * Ne fait aucune écriture disque — l'appelant décide quoi faire du résultat.
 */
export async function computeWeekStats({ accessToken, businessAccountId, ownUsername, weekStart }) {
  const weekEnd = addDays(weekStart, 6);
  const weekStartISO = formatISODate(weekStart);
  const weekEndISO = formatISODate(weekEnd);
  const rangeEnd = new Date(`${weekEndISO}T23:59:59Z`);

  const posts = await fetchPostsInRange({ accessToken, businessAccountId, start: weekStart, end: rangeEnd });

  const postStats = [];
  for (const post of posts) {
    postStats.push(await computePostStats({ accessToken, post, ownUsername }));
  }

  return {
    weekStart: weekStartISO,
    weekEnd: weekEndISO,
    posts: postStats,
    followerCount: lookupFollowerCount(weekStartISO),
  };
}
