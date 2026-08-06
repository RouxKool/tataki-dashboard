# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static dashboard tracking how well Tataki's team responds to Instagram comments, week by
week (reply rate = % of community comments that got a reply from the account), plus
supporting engagement/reach/follower metrics. Audience: community managers and their managers,
checked solo/ad-hoc — not in a meeting. See `PRODUCT.md` for full product context and
`README.md` for end-user setup steps (GitHub secrets, Pages, workflow triggers); this file is
about working in the code itself.

There is no test suite, linter, or build step in this repo — it's plain ES modules (Node
scripts + a static frontend), no npm install required to run either side.

## Commands

Frontend (static site — must be served, not opened via `file://`, so `fetch("data/history.json")` works):
```bash
npx serve .
```

Data pipeline scripts (need `INSTAGRAM_ACCESS_TOKEN` / `INSTAGRAM_BUSINESS_ACCOUNT_ID`, e.g. via a local `.env`):
```bash
node --env-file=.env scripts/compute-week.js              # last completed week (Mon-Sun)
node --env-file=.env scripts/compute-week.js --current     # current, unfinished week
node --env-file=.env scripts/compute-week.js 2025-06-02    # a specific week (Monday date)
node --env-file=.env scripts/backfill.js 2025-01-06        # backfill from a start date; resumable, skips weeks already in data/history.json
node --env-file=.env scripts/record-follower-snapshot.js   # snapshot today's follower count for the current week
node --env-file=.env scripts/repair-insights.js            # re-fetch only missing engagement/views (skips the expensive comments fetch)
```

These same scripts run unattended via GitHub Actions (`.github/workflows/*.yml`): a Monday
cron finalizes the just-ended week, a daily cron refreshes the current week, plus two
manually-triggered workflows for backfill and insight repair.

## Architecture

**Two independent phases, no server at request time.** GitHub Actions runs the Node scripts
on a schedule, which call the Instagram Graph API and commit the results straight into
`data/history.json` / `data/followers-history.json` (versioned in the repo). GitHub Pages then
serves `index.html`/`app.js`/`style.css`, which only ever reads that pre-computed JSON — the
dashboard never talks to Instagram itself, so it opens instantly with no wait and no secrets
exposed client-side.

**Single source of truth: raw posts, not totals.** `data/history.json` stores one entry per
week with a `posts` array of per-post stats (likes, comments, replies, shares, `totalInteractions`,
`plays`) — there is no pre-aggregated "totals" field. Every aggregate shown on screen (reply
rate, engagement avg/median, views per Reel, week-over-week deltas) is recomputed on the fly in
`app.js`'s `aggregatePosts()`, for both the weekly view and the month roll-up (which just pools
several weeks' `posts` arrays together). When adding a new metric, extend `computePostStats`
(`scripts/lib/instagram.js`) at the post level and `aggregatePosts` in `app.js` — don't add a
separately-stored total, or it will drift from the per-post detail table.

**Data pipeline call chain**: `scripts/lib/instagram.js` (raw Graph API client) →
`scripts/lib/weekly-stats.js`'s `computeWeekStats` (fetches one week's posts + comments +
insights, returns the raw per-post array) → `scripts/lib/history-store.js` (`upsertWeek` /
`readHistory`, the only code that touches the JSON files) → the CLI scripts in `scripts/`,
which are just thin wrappers around those three.

**In-progress week + fair comparisons.** A week is flagged `inProgress: true` (in
`weekly-stats.js`) when computed before its own end date. The frontend shows an "en cours"
badge for it and — this is the part that's easy to break — compares it against the previous
period using a *day-matched slice* rather than the full previous period: `getComparableStats`
in `app.js` truncates the previous period's posts to the same elapsed time since period start
(e.g. Wednesday vs. Wednesday), so an unfinished week isn't unfairly compared to a complete
one. Completed periods still compare to the full previous period. Any new week-over-week
comparison must go through `getComparableStats`, not compare raw totals directly.

**Instagram Graph API gotchas** (already solved once, don't re-break them):
- Insights (`total_interactions`, `shares`, `plays`/`views`) need the `instagram_manage_insights`
  permission on the token; when missing, calls fail and the field is stored as `null` rather
  than aborting the whole computation — treat any insights field as nullable everywhere.
- Each insight metric is fetched in its **own** request (`fetchSingleInsightMetric`), not
  combined in one comma-separated `metric=` call — Graph API can reject the *entire* combined
  request if a single requested metric doesn't apply to that media type.
- The Reels view-count metric was renamed by Instagram from `plays` to `views` at the API
  level; the field is still called `plays` throughout this codebase and in `data/history.json`
  for continuity — don't rename it back to `views` without a data migration.
- Same Instagram Business account/token as sibling repos `insta-recherche` and
  `tataki-commentaires` — rotating the token means updating it in all three repos' GitHub
  secrets, not just this one.

**Follower history** is bootstrapped once from a manually supplied stock (`scripts/import-followers.js`,
one-off, not part of the regular pipeline) and extended automatically from there by the
crons — there's no way to backfill follower counts earlier than whatever was first recorded.
