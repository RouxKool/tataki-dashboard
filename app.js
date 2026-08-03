const modeWeekBtn = document.getElementById("mode-week");
const modeMonthBtn = document.getElementById("mode-month");
const timeline = document.getElementById("timeline");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");
const periodLabel = document.getElementById("period-label");
const loadingStatus = document.getElementById("loading-status");
const showMoreBtn = document.getElementById("show-more-btn");

const TABLE_PAGE_SIZE = 5;

let weeklyPeriods = [];
let monthlyPeriods = [];
let mode = "week";
let sortedPostsForTable = [];
let visibleRowCount = TABLE_PAGE_SIZE;

init();

async function init() {
  try {
    const response = await fetch("data/history.json");
    if (!response.ok) throw new Error(`Impossible de charger data/history.json (${response.status})`);
    const history = await response.json();

    if (!history.length) {
      loadingStatus.textContent = "Aucune donnée disponible pour l'instant.";
      return;
    }

    weeklyPeriods = history.map(weekToPeriod);
    monthlyPeriods = buildMonthlyPeriods(history);

    loadingStatus.hidden = true;
    renderChart(weeklyPeriods);
    setMode("week", { resetToLatest: true });
  } catch (error) {
    loadingStatus.textContent = `Erreur : ${error.message}`;
  }
}

modeWeekBtn.addEventListener("click", () => setMode("week", { resetToLatest: true }));
modeMonthBtn.addEventListener("click", () => setMode("month", { resetToLatest: true }));
timeline.addEventListener("input", () => renderSelectedPeriod());
prevBtn.addEventListener("click", () => moveTimeline(-1));
nextBtn.addEventListener("click", () => moveTimeline(1));
showMoreBtn.addEventListener("click", () => {
  visibleRowCount = sortedPostsForTable.length;
  renderPostsTableRows();
});

function setMode(newMode, { resetToLatest } = {}) {
  mode = newMode;
  modeWeekBtn.classList.toggle("active", mode === "week");
  modeMonthBtn.classList.toggle("active", mode === "month");

  const periods = currentPeriods();
  timeline.min = "0";
  timeline.max = String(Math.max(periods.length - 1, 0));
  timeline.value = resetToLatest ? String(periods.length - 1) : timeline.value;
  renderSelectedPeriod();
}

function currentPeriods() {
  return mode === "week" ? weeklyPeriods : monthlyPeriods;
}

function moveTimeline(delta) {
  const next = Math.min(Math.max(Number(timeline.value) + delta, 0), Number(timeline.max));
  timeline.value = String(next);
  renderSelectedPeriod();
}

function renderSelectedPeriod() {
  const periods = currentPeriods();
  const index = Number(timeline.value);
  const period = periods[index];
  if (!period) return;

  const previous = periods[index - 1] ?? null;
  periodLabel.textContent = period.label;

  document.getElementById("tile-reply-rate").textContent = formatPercent(period.replyRate);
  document.getElementById("tile-answered").textContent = `${period.commentsAnswered} / ${period.commentsTotal}`;
  document.getElementById("tile-posts").textContent = String(period.postsCount);
  document.getElementById("tile-followers").textContent = formatFollowers(period.followerCount, previous?.followerCount);
  document.getElementById("tile-views").textContent = formatNumber(period.viewsTotal);
  document.getElementById("tile-engagement-total").textContent = formatNumber(period.engagementTotal);
  document.getElementById("tile-engagement-avg").textContent = formatNumber(period.engagementAvg);
  document.getElementById("tile-engagement-median").textContent = formatNumber(period.engagementMedian);

  sortedPostsForTable = [...period.posts].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  visibleRowCount = TABLE_PAGE_SIZE;
  renderPostsTableRows();
}

function renderPostsTableRows() {
  const tbody = document.getElementById("posts-tbody");
  const emptyMessage = document.getElementById("empty-message");
  tbody.innerHTML = "";

  if (!sortedPostsForTable.length) {
    emptyMessage.hidden = false;
    showMoreBtn.hidden = true;
    return;
  }
  emptyMessage.hidden = true;

  for (const post of sortedPostsForTable.slice(0, visibleRowCount)) {
    const tr = document.createElement("tr");
    const rate = post.commentsTotal > 0 ? post.commentsAnswered / post.commentsTotal : null;
    tr.innerHTML = `
      <td>${formatDate(post.timestamp)}</td>
      <td>${mediaTypeLabel(post)}</td>
      <td class="caption-cell"><a href="${post.permalink}" target="_blank" rel="noopener">${escapeHtml(post.captionPreview) || "Voir le post"}</a></td>
      <td>${formatNumber(post.likeCount)}</td>
      <td>${post.commentsTotal}</td>
      <td>${post.commentsAnswered}</td>
      <td>${formatPercent(rate)}</td>
      <td>${formatNumber(post.shares)}</td>
      <td>${post.mediaProductType === "REELS" ? formatNumber(post.plays) : "—"}</td>
    `;
    tbody.appendChild(tr);
  }

  showMoreBtn.hidden = visibleRowCount >= sortedPostsForTable.length;
}

function weekToPeriod(week) {
  return {
    label: `Semaine du ${formatDate(week.weekStart)} au ${formatDate(week.weekEnd)}`,
    followerCount: week.followerCount,
    posts: week.posts,
    ...aggregatePosts(week.posts),
  };
}

function buildMonthlyPeriods(history) {
  const byMonth = new Map();
  for (const week of history) {
    const monthKey = week.weekStart.slice(0, 7); // YYYY-MM
    if (!byMonth.has(monthKey)) byMonth.set(monthKey, []);
    byMonth.get(monthKey).push(week);
  }

  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, weeks]) => {
      const lastWithFollowers = [...weeks].reverse().find((w) => w.followerCount != null);
      const posts = weeks.flatMap((w) => w.posts);

      return {
        label: formatMonthLabel(monthKey),
        followerCount: lastWithFollowers?.followerCount ?? null,
        posts,
        ...aggregatePosts(posts),
      };
    });
}

/** Recalcule tous les agrégats d'une période à partir de sa liste de posts. */
function aggregatePosts(posts) {
  const commentsTotal = posts.reduce((sum, p) => sum + p.commentsTotal, 0);
  const commentsAnswered = posts.reduce((sum, p) => sum + p.commentsAnswered, 0);
  const engagementValues = posts.map((p) => p.totalInteractions).filter((v) => v != null);
  const viewsTotal = posts.reduce((sum, p) => sum + (p.plays ?? 0), 0);

  return {
    postsCount: posts.length,
    commentsTotal,
    commentsAnswered,
    replyRate: commentsTotal > 0 ? commentsAnswered / commentsTotal : null,
    engagementTotal: engagementValues.length ? engagementValues.reduce((a, b) => a + b, 0) : null,
    engagementAvg: engagementValues.length ? mean(engagementValues) : null,
    engagementMedian: engagementValues.length ? median(engagementValues) : null,
    viewsTotal,
  };
}

function mean(values) {
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

function renderChart(periods) {
  const points = periods
    .map((p, i) => ({ x: i, y: p.replyRate }))
    .filter((p) => p.y != null);

  document.getElementById("chart").innerHTML = points.length >= 2 ? buildLineChartSvg(points, periods.length) : "<p class=\"empty-message\">Pas assez de données pour un graphique.</p>";
}

function buildLineChartSvg(points, totalCount) {
  const width = 900;
  const height = 220;
  const padding = 30;

  const xFor = (i) => padding + (i / Math.max(totalCount - 1, 1)) * (width - padding * 2);
  const yFor = (v) => height - padding - v * (height - padding * 2);

  const path = points.map((p) => `${xFor(p.x)},${yFor(p.y)}`).join(" ");
  const last = points.at(-1);

  return `
    <svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <line x1="${padding}" y1="${yFor(0)}" x2="${width - padding}" y2="${yFor(0)}" stroke="#2c2c2f" />
      <line x1="${padding}" y1="${yFor(1)}" x2="${width - padding}" y2="${yFor(1)}" stroke="#2c2c2f" />
      <text x="${padding}" y="${yFor(1) - 6}" fill="#a0a0a5" font-size="11">100%</text>
      <text x="${padding}" y="${yFor(0) - 6}" fill="#a0a0a5" font-size="11">0%</text>
      <polyline points="${path}" fill="none" stroke="#e8483a" stroke-width="2" />
      <circle cx="${xFor(last.x)}" cy="${yFor(last.y)}" r="4" fill="#e8483a" />
    </svg>
  `;
}

function mediaTypeLabel(post) {
  if (post.mediaProductType === "REELS") return "Reel";
  if (post.mediaType === "CAROUSEL_ALBUM") return "Carrousel";
  if (post.mediaType === "VIDEO") return "Vidéo";
  return "Photo";
}

function formatPercent(ratio) {
  if (ratio == null) return "—";
  return `${Math.round(ratio * 100)}%`;
}

function formatNumber(value) {
  if (value == null) return "—";
  return value.toLocaleString("fr-CH");
}

function formatFollowers(count, previousCount) {
  if (count == null) return "—";
  const formatted = count.toLocaleString("fr-CH");
  if (previousCount == null) return formatted;
  const delta = count - previousCount;
  const sign = delta > 0 ? "+" : "";
  return `${formatted} (${sign}${delta.toLocaleString("fr-CH")})`;
}

function formatDate(isoDateOrTimestamp) {
  const date = new Date(isoDateOrTimestamp);
  return date.toLocaleDateString("fr-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatMonthLabel(monthKey) {
  const [year, month] = monthKey.split("-");
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
  const label = date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}
