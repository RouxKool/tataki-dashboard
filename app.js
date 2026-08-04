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
let currentPeriodPosts = [];
let visibleRowCount = TABLE_PAGE_SIZE;
let sortKey = "date";
let sortDirection = "desc";

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
  visibleRowCount = currentPeriodPosts.length;
  renderPostsTableRows();
});

document.querySelectorAll("th[data-sort-key]").forEach((th) => {
  th.addEventListener("click", () => {
    const key = th.dataset.sortKey;
    sortDirection = sortKey === key && sortDirection === "desc" ? "asc" : "desc";
    sortKey = key;
    renderPostsTableRows();
  });
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
  prevBtn.disabled = index <= 0;
  nextBtn.disabled = index >= periods.length - 1;

  const deltaEl = document.getElementById("tile-reply-rate-delta");
  deltaEl.textContent = formatReplyRateDelta(period.replyRate, previous?.replyRate);
  deltaEl.className = "hero-metric-delta " + replyRateDeltaDirection(period.replyRate, previous?.replyRate);

  document.getElementById("tile-reply-rate").textContent = formatPercent(period.replyRate);
  document.getElementById("tile-answered").textContent = `${period.commentsAnswered} / ${period.commentsTotal}`;
  document.getElementById("tile-posts").textContent = String(period.postsCount);
  document.getElementById("tile-followers").textContent = formatFollowers(period.followerCount, previous?.followerCount);
  document.getElementById("tile-views").textContent = formatNumber(period.viewsTotal);
  document.getElementById("tile-engagement-total").textContent = formatNumber(period.engagementTotal);
  document.getElementById("tile-engagement-avg").textContent = formatNumber(period.engagementAvg);
  document.getElementById("tile-engagement-median").textContent = formatNumber(period.engagementMedian);

  currentPeriodPosts = period.posts;
  visibleRowCount = TABLE_PAGE_SIZE;
  renderPostsTableRows();
}

function renderPostsTableRows() {
  const tbody = document.getElementById("posts-tbody");
  const emptyMessage = document.getElementById("empty-message");
  tbody.innerHTML = "";
  updateSortHeaders();

  if (!currentPeriodPosts.length) {
    emptyMessage.hidden = false;
    showMoreBtn.hidden = true;
    return;
  }
  emptyMessage.hidden = true;

  const sorted = getSortedPosts(currentPeriodPosts);
  for (const post of sorted.slice(0, visibleRowCount)) {
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

  showMoreBtn.hidden = visibleRowCount >= sorted.length;
}

function getSortedPosts(posts) {
  return [...posts].sort((a, b) => {
    const va = sortValueFor(a, sortKey);
    const vb = sortValueFor(b, sortKey);
    const cmp = typeof va === "string" ? va.localeCompare(vb, "fr") : va - vb;
    return sortDirection === "asc" ? cmp : -cmp;
  });
}

function sortValueFor(post, key) {
  const rate = post.commentsTotal > 0 ? post.commentsAnswered / post.commentsTotal : -1;
  switch (key) {
    case "date":
      return new Date(post.timestamp).getTime();
    case "type":
      return mediaTypeLabel(post);
    case "caption":
      return post.captionPreview ?? "";
    case "likes":
      return post.likeCount ?? 0;
    case "comments":
      return post.commentsTotal ?? 0;
    case "answered":
      return post.commentsAnswered ?? 0;
    case "rate":
      return rate;
    case "shares":
      return post.shares ?? -1;
    case "views":
      return post.plays ?? -1;
    default:
      return 0;
  }
}

function updateSortHeaders() {
  document.querySelectorAll("th[data-sort-key]").forEach((th) => {
    const isActive = th.dataset.sortKey === sortKey;
    th.classList.toggle("sorted", isActive);
    const arrow = th.querySelector(".sort-arrow");
    if (arrow) arrow.remove();
    if (isActive) {
      const span = document.createElement("span");
      span.className = "sort-arrow";
      span.textContent = sortDirection === "asc" ? "▲" : "▼";
      th.appendChild(span);
    }
  });
}

function weekToPeriod(week) {
  return {
    label: `Semaine du ${formatDate(week.weekStart)} au ${formatDate(week.weekEnd)}`,
    dateLabel: formatDate(week.weekStart),
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
    .map((p, i) => ({ x: i, y: p.replyRate, dateLabel: p.dateLabel }))
    .filter((p) => p.y != null);

  const chartEl = document.getElementById("chart");
  if (points.length < 2) {
    chartEl.innerHTML = "<p class=\"empty-message\">Pas assez de données pour un graphique.</p>";
    return;
  }
  chartEl.innerHTML = buildLineChartSvg(points, periods.length);
  attachChartTooltip(points);
}

function attachChartTooltip(points) {
  const tooltip = document.getElementById("chart-tooltip");
  const container = document.getElementById("chart").closest(".chart-section");
  const hitCircles = container.querySelectorAll(".chart-point");

  hitCircles.forEach((circle, i) => {
    const point = points[i];
    circle.addEventListener("mouseenter", () => {
      const circleRect = circle.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      tooltip.textContent = `${formatPercent(point.y)} — ${point.dateLabel}`;
      tooltip.style.left = `${circleRect.left - containerRect.left + circleRect.width / 2}px`;
      tooltip.style.top = `${circleRect.top - containerRect.top}px`;
      tooltip.hidden = false;
    });
    circle.addEventListener("mouseleave", () => {
      tooltip.hidden = true;
    });
  });
}

function buildLineChartSvg(points, totalCount) {
  const width = 900;
  const height = 220;
  const padding = 30;

  const rootStyle = getComputedStyle(document.documentElement);
  const highlight = rootStyle.getPropertyValue("--highlight").trim();
  const border = rootStyle.getPropertyValue("--border").trim();
  const muted = rootStyle.getPropertyValue("--muted").trim();

  const xFor = (i) => padding + (i / Math.max(totalCount - 1, 1)) * (width - padding * 2);
  const yFor = (v) => height - padding - v * (height - padding * 2);

  const path = points.map((p) => `${xFor(p.x)},${yFor(p.y)}`).join(" ");
  const last = points.at(-1);
  const first = points[0];
  const areaPoints = `${xFor(first.x)},${yFor(0)} ${path} ${xFor(last.x)},${yFor(0)}`;
  const hitCircles = points
    .map((p) => `<circle class="chart-point" cx="${xFor(p.x)}" cy="${yFor(p.y)}" r="8" />`)
    .join("");

  return `
    <svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Évolution du taux de réponse, de 0 à 100%, sur ${totalCount} semaine(s)">
      <title>Évolution du taux de réponse sur ${totalCount} semaine(s)</title>
      <defs>
        <linearGradient id="chart-area-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${highlight}" stop-opacity="0.35" />
          <stop offset="100%" stop-color="${highlight}" stop-opacity="0" />
        </linearGradient>
      </defs>
      <line x1="${padding}" y1="${yFor(0)}" x2="${width - padding}" y2="${yFor(0)}" stroke="${border}" />
      <line x1="${padding}" y1="${yFor(1)}" x2="${width - padding}" y2="${yFor(1)}" stroke="${border}" />
      <text x="${padding}" y="${yFor(1) - 6}" fill="${muted}" font-size="11">100%</text>
      <text x="${padding}" y="${yFor(0) - 6}" fill="${muted}" font-size="11">0%</text>
      <polygon points="${areaPoints}" fill="url(#chart-area-gradient)" stroke="none" />
      <polyline points="${path}" fill="none" stroke="${highlight}" stroke-width="2" />
      <circle cx="${xFor(last.x)}" cy="${yFor(last.y)}" r="4" fill="${highlight}" style="pointer-events:none" />
      ${hitCircles}
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

function replyRateDeltaDirection(rate, previousRate) {
  if (rate == null || previousRate == null || rate === previousRate) return "";
  return rate > previousRate ? "up" : "down";
}

function formatReplyRateDelta(rate, previousRate) {
  if (rate == null || previousRate == null) return "";
  const deltaPoints = Math.round((rate - previousRate) * 100);
  if (deltaPoints === 0) return "= vs période précédente";
  const sign = deltaPoints > 0 ? "+" : "";
  return `${sign}${deltaPoints} pt vs période précédente`;
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
