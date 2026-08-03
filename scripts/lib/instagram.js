const GRAPH_API_VERSION = "v22.0";
const MEDIA_FIELDS =
  "id,permalink,timestamp,caption,like_count,comments_count,media_type,media_product_type";
const COMMENT_FIELDS = "id,username,timestamp,replies.limit(50){id,username,timestamp}";
const CAPTION_PREVIEW_LENGTH = 100;

export async function fetchAccountUsername({ accessToken, businessAccountId }) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/${businessAccountId}`);
  url.searchParams.set("fields", "username");
  url.searchParams.set("access_token", accessToken);
  const body = await graphFetch(url);
  return body.username;
}

export async function fetchAccountFollowerCount({ accessToken, businessAccountId }) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/${businessAccountId}`);
  url.searchParams.set("fields", "followers_count");
  url.searchParams.set("access_token", accessToken);
  const body = await graphFetch(url);
  return body.followers_count ?? null;
}

/**
 * Les posts sont renvoyés du plus récent au plus ancien par l'API : on arrête
 * la pagination dès qu'un post est antérieur à `start`, inutile d'aller plus loin.
 */
export async function fetchPostsInRange({ accessToken, businessAccountId, start, end }) {
  const posts = [];
  let apiUrl = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/${businessAccountId}/media`);
  apiUrl.searchParams.set("fields", MEDIA_FIELDS);
  apiUrl.searchParams.set("limit", "50");
  apiUrl.searchParams.set("access_token", accessToken);

  while (apiUrl) {
    const body = await graphFetch(apiUrl);
    let reachedOlderThanStart = false;

    for (const item of body.data ?? []) {
      const timestamp = new Date(item.timestamp);
      if (timestamp < start) {
        reachedOlderThanStart = true;
        break;
      }
      if (timestamp <= end) {
        posts.push(item);
      }
    }

    if (reachedOlderThanStart) break;
    const next = body.paging?.next;
    apiUrl = next ? new URL(next) : null;
  }

  return posts;
}

/**
 * Récupère tous les commentaires de premier niveau d'un post (+ leurs
 * réponses, jusqu'à 50 par commentaire), toutes pages confondues.
 */
export async function fetchTopLevelComments({ accessToken, postId }) {
  const comments = [];
  let apiUrl = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/${postId}/comments`);
  apiUrl.searchParams.set("fields", COMMENT_FIELDS);
  apiUrl.searchParams.set("limit", "50");
  apiUrl.searchParams.set("access_token", accessToken);

  while (apiUrl) {
    const body = await graphFetch(apiUrl);
    for (const item of body.data ?? []) {
      comments.push({
        id: item.id,
        username: item.username,
        timestamp: item.timestamp,
        replies: item.replies?.data ?? [],
      });
    }
    const next = body.paging?.next;
    apiUrl = next ? new URL(next) : null;
  }

  return comments;
}

/**
 * Engagement (total_interactions = likes + commentaires + partages +
 * enregistrements, métrique officielle Instagram) et vues (Reels
 * uniquement). Chaque métrique est demandée séparément : si une seule
 * métrique n'est pas valide pour ce type de post (ex: "shares" refusé sur
 * une photo simple), la Graph API rejette parfois toute la requête
 * groupée — en séparant les appels, une métrique en échec ne fait pas
 * disparaître les autres. Nécessite la permission
 * instagram_manage_insights sur le token ; si elle manque, tout reste à
 * `null` sans faire échouer le reste du calcul (même logique que le
 * "reach" dans insta-recherche).
 */
export async function fetchPostInsights({ accessToken, postId, isReel }) {
  const totalInteractions = await fetchSingleInsightMetric({ accessToken, postId, metric: "total_interactions" });
  const shares = await fetchSingleInsightMetric({ accessToken, postId, metric: "shares" });
  const plays = isReel ? await fetchSingleInsightMetric({ accessToken, postId, metric: "plays" }) : null;

  return { totalInteractions, shares, plays };
}

async function fetchSingleInsightMetric({ accessToken, postId, metric }) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/${postId}/insights`);
  url.searchParams.set("metric", metric);
  url.searchParams.set("access_token", accessToken);

  try {
    const body = await graphFetch(url);
    return body.data?.[0]?.values?.[0]?.value ?? null;
  } catch (error) {
    console.log(`Insight "${metric}" indisponible pour le post ${postId} : ${error.message}`);
    return null;
  }
}

/**
 * Pour un post donné : combien de commentaires reçus de la communauté
 * (on exclut les commentaires laissés par le compte lui-même), et combien
 * d'entre eux ont reçu au moins une réponse du compte.
 */
export async function computeReplyStats({ accessToken, postId, ownUsername }) {
  const comments = await fetchTopLevelComments({ accessToken, postId });
  const communityComments = comments.filter((c) => c.username !== ownUsername);
  const answered = communityComments.filter((c) => c.replies.some((r) => r.username === ownUsername));

  return { commentsTotal: communityComments.length, commentsAnswered: answered.length };
}

/** Calcule toutes les statistiques d'un post (réponses + engagement + vues). */
export async function computePostStats({ accessToken, post, ownUsername }) {
  const isReel = post.media_product_type === "REELS";
  const [replyStats, insights] = await Promise.all([
    computeReplyStats({ accessToken, postId: post.id, ownUsername }),
    fetchPostInsights({ accessToken, postId: post.id, isReel }),
  ]);

  return {
    id: post.id,
    permalink: post.permalink,
    timestamp: post.timestamp,
    mediaType: post.media_type,
    mediaProductType: post.media_product_type ?? null,
    captionPreview: previewCaption(post.caption),
    likeCount: post.like_count ?? 0,
    ...replyStats,
    shares: insights.shares,
    totalInteractions: insights.totalInteractions,
    plays: insights.plays,
  };
}

function previewCaption(caption) {
  if (!caption) return "";
  const flattened = caption.replace(/\s+/g, " ").trim();
  return flattened.length > CAPTION_PREVIEW_LENGTH
    ? `${flattened.slice(0, CAPTION_PREVIEW_LENGTH)}…`
    : flattened;
}

async function graphFetch(apiUrl) {
  const response = await fetch(apiUrl);
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.error?.message ?? `Erreur API Instagram (${response.status})`);
  }
  return body;
}
