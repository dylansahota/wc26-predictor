# WC26 Predictor — Claude Onboarding

A score-prediction game for 4 friends (Dyl, Damien, Tunde, Gowth) during the 2026 FIFA World Cup. Players predict match scores; 1 point for an exact correct scoreline.

---

## Stack

- **Next.js 16.2.6** — App Router, TypeScript, Turbopack
- **Supabase** — Postgres DB + supabaseAdmin (service role key, server-side only)
- **Auth** — custom PIN-based: bcryptjs hash stored in `players` table, jose HS256 JWT in httpOnly cookie `wc26_session` (30-day expiry)
- **Vercel Hobby** — 10s function timeout, 1 free cron/day
- **football-data.org API** — free tier, 10 req/min, competition code `WC`, season `2026`
- **Styling** — all inline styles, no Tailwind. Dark theme: `#0f1117` bg, `#4ade80` accent (green), `#181c24` cards
- **Font** — Manrope (Google Fonts, loaded in `app/layout.tsx`)

---

## Repo & Deployment

- **GitHub**: `https://github.com/dylansahota/wc26-predictor.git` (private, personal account)
- **Vercel project**: `worldcup26-predictor` under scope `pl-predictor`
- **Live URL**: `https://worldcup26-predictor-seven.vercel.app`
- The `-seven` alias must be manually re-pointed after every deploy:
  ```bash
  vercel --prod
  vercel alias set <new-deployment-url> worldcup26-predictor-seven.vercel.app --scope pl-predictor
  ```
- **Cron**: `vercel.json` runs `GET /api/results` daily at `0 8 * * *` (8am UTC / 4am ET) with `Authorization: Bearer CRON_SECRET`

---

## Environment Variables

All set in `.env.local` locally and in Vercel dashboard:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
JWT_SECRET=
FOOTBALL_DATA_API_KEY=
CRON_SECRET=
```

`supabaseAdmin` (service role) is server-side only — never use it in client components. The anon key is used for the public `supabase` client.

---

## Database Tables

### `players`
| column | type | notes |
|--------|------|-------|
| id | int | PK |
| name | text | display name, used for auth (`session.name === 'Dyl'` gates admin) |
| pin_hash | text | bcrypt hash |
| colour | text | hex, used for leaderboard chart lines |

Players: Dyl (`#f97316`), Damien, Tunde, Gowth. Seeded via `scripts/seed-players.ts`.

### `matches`
| column | type | notes |
|--------|------|-------|
| id | int | PK |
| fd_id | int | football-data.org match ID |
| home_team / away_team | text | team names as returned by football-data.org API |
| home_flag / away_flag | text | emoji flags |
| kickoff_utc | timestamptz | raw UTC kickoff |
| et_date | date | **game-day date in UTC-6** (see quirk below) |
| home_score / away_score | int\|null | null until match finishes |
| status | text | `'scheduled'` or `'finished'` |
| stage | text | e.g. `'GROUP_STAGE'` |
| group_name | text | e.g. `'GROUP_A'` — populated by admin sync |
| venue | text | stadium name — seeded by `scripts/seed-venues.ts` |

Seeded via `scripts/seed-fixtures.ts` which calls the football-data.org competition matches endpoint.

### `predictions`
| column | type | notes |
|--------|------|-------|
| id | int | PK |
| player_id | int | FK → players |
| match_id | int | FK → matches |
| home_score / away_score | int | player's predicted score |
| points | int\|null | null = not yet scored, 0 = wrong, 1 = correct |

`points = null` is the sentinel for "not scored yet" — important for idempotent syncing (see Sync section).

### `daily_scores`
| column | type | notes |
|--------|------|-------|
| id | int | PK |
| player_id | int | FK → players |
| et_date | date | matches the `et_date` from `matches` table |
| points | int | total points for that player on that day |

The leaderboard reads entirely from this table. It is rebuilt from scratch by the recalc endpoint — never trust incremental updates if things look wrong.

---

## Key Quirk: Game-Day Date Boundary (`et_date`)

**Problem**: WC2026 games run 7pm–5am BST. The 5am BST game (= 4am UTC) would cross midnight ET and appear on the wrong day if we used `America/New_York` (UTC-4 summer).

**Fix**: `et_date` uses **`Etc/GMT+6` (fixed UTC-6, no DST)** as the day boundary. 4am UTC − 6h = 10pm UTC-6 the previous day, keeping all 4 games together.

All code that computes "today's game date" uses:
```typescript
new Date().toLocaleDateString('en-US', {
  timeZone: 'Etc/GMT+6', year: 'numeric', month: '2-digit', day: '2-digit',
})
```

The DB column is type `date`. If you ever re-seed or migrate `et_date`, use:
```sql
UPDATE matches SET et_date = (kickoff_utc::timestamptz - INTERVAL '6 hours')::date;
```

**Kickoff times are displayed in BST** (`Europe/London`) in the UI, even though storage is UTC.

---

## Auth Flow

1. User enters name + PIN on `/` (login page)
2. `POST /api/auth` verifies PIN against bcrypt hash, creates HS256 JWT, sets `wc26_session` httpOnly cookie (30 days)
3. `middleware.ts` protects `/predict`, `/leaderboard`, `/history`, `/admin`, `/groups` — redirects to `/` if no valid JWT
4. `GET /api/auth/session` returns `{id, name}` from the JWT — used by all pages to get the current player

**Admin gate**: `session.name === 'Dyl'` — hardcoded in the sync route and the admin page. Admin tab only visible to Dyl in NavBar.

---

## Pages & API Routes

### Pages
| path | notes |
|------|-------|
| `/` | Login |
| `/predict` | Today's (or next upcoming) matches, prediction inputs |
| `/groups` | Group stage standings calculated from DB |
| `/leaderboard` | Sorted standings + Chart.js cumulative line chart |
| `/history` | All past-deadline days with everyone's picks |
| `/admin` | Dyl only — sync scores + recalculate leaderboard |

### API Routes
| route | method | notes |
|-------|--------|-------|
| `/api/auth` | POST / DELETE | Login / logout |
| `/api/auth/session` | GET | Returns current player from JWT |
| `/api/matches` | GET | Returns active game-day matches + predictions + team form |
| `/api/predictions` | POST | Upserts predictions, enforces deadline |
| `/api/groups` | GET | Calculates standings from DB (not football-data.org standings endpoint — that returns `group: null`) |
| `/api/leaderboard` | GET | Reads `daily_scores`, builds cumulative series |
| `/api/history` | GET | All past-deadline dates with predictions |
| `/api/teams` | GET | `?team=Mexico` — returns all finished results for a team (used by tap-to-see-form modal) |
| `/api/results` | GET | Cron job — scores yesterday's matches |
| `/api/admin/sync` | POST | Manual sync — scores all unfinished/stuck matches |
| `/api/admin/recalc` | POST | Rebuilds `daily_scores` from scratch for all finished dates |

**All API routes must have `export const dynamic = 'force-dynamic'`** — otherwise Vercel tries to statically render them at build time and the build fails.

---

## Predict Page Behaviour

- **Deadline** = 1 hour before the first kickoff of the day
- **Before deadline**: inputs visible, submit/update button shown
- **After deadline**: inputs hidden, everyone's picks revealed, others' predictions shown in a 2×2 grid
- **Auto-advance**: if today's deadline has passed (or no matches today), the page automatically shows the *next* upcoming game day's fixtures — no dead screen between days
- **"✓ saved X–Y" indicator** reads from `savedPredictions` state (snapshot at last successful submit), not the live input state — so it stays static while the user edits
- **Team modal**: tapping a team flag or name slides up a panel with all that team's finished results

---

## Groups Page

**Important**: The football-data.org `/competitions/WC/standings` endpoint returns `"group": null` for all teams — it's broken for WC2026. The Groups page calculates standings entirely from our own DB:
- Queries all `GROUP_STAGE` finished matches
- Builds W/D/L/GD/Pts per team in JavaScript
- Groups by `group_name` field on the match (e.g. `GROUP_A`)
- `group_name` is populated by the admin sync from `fdMatch.group`

---

## Score Sync Flow

### Manual (Admin → "Sync all scores")
`POST /api/admin/sync`:
1. Fetches all matches where `status = 'scheduled'` OR `home_score IS NULL` (catches matches stuck mid-sync)
2. Single API call to `GET /competitions/WC/matches?season=2026`
3. For each scheduled/stuck match: updates `group_name`, `venue`, team names if changed
4. For each FINISHED match: writes scores + sets `status = 'finished'`
5. Sets `predictions.points` (1 = correct, 0 = wrong) for every prediction
6. Calls `recalcDailyScores(etDate)` — rebuilds `daily_scores` from scratch for that date

### Automatic (Cron at 8am UTC)
`GET /api/results`: same logic but scoped to yesterday's `et_date` only.

### Recalculate Leaderboard (Admin → "Recalculate scores")
`POST /api/admin/recalc`: loops all dates with finished matches and calls `recalcDailyScores()` for each.

### `recalcDailyScores(etDate)` — exported from `admin/sync/route.ts`
Rebuilds `daily_scores` for a given date entirely from non-null `predictions.points`. Safe to call multiple times — always produces the correct result. **Never increments** — always overwrites.

---

## Football-Data.org API Quirks

- **Venue**: returns `null` for all WC2026 matches. Venues are hard-coded in `scripts/seed-venues.ts` and seeded directly into the DB.
- **Standings endpoint** (`/competitions/WC/standings`): returns `group: null` — do not use. Calculate from matches instead.
- **Match objects** (`/competitions/WC/matches?season=2026`): DO have `group` field (e.g. `"GROUP_A"`) — this is how `group_name` gets populated.
- **Team names** are as the API returns them, e.g. `"United States"` not `"USA"`, `"Ivory Coast"` not `"Côte d'Ivoire"`, `"Turkey"` not `"Türkiye"`, `"Cape Verde Islands"` not `"Cabo Verde"`, `"Iran"` not `"IR Iran"`, `"Bosnia-Herzegovina"` (hyphen not space).
- Rate limit: 10 req/min on free tier. Always use the single competition-level endpoint, never per-match loops.

---

## Venue Data

Venues were seeded via `scripts/seed-venues.ts` using a hard-coded map of `(home_team, away_team) → stadium`. The `VENUE_INFO` map in `app/(pages)/predict/page.tsx` maps stadium name → `{city, country}` for display.

16 host stadiums: Estadio Azteca, Estadio Akron, Estadio BBVA (Mexico); BC Place, BMO Field (Canada); MetLife, AT&T, SoFi, Levi's, Hard Rock, Arrowhead, Lumen Field, Lincoln Financial Field, Gillette, NRG, Mercedes-Benz (USA).

---

## Scripts

| script | purpose |
|--------|---------|
| `scripts/seed-players.ts` | Inserts the 4 players with bcrypt-hashed PINs |
| `scripts/seed-fixtures.ts` | Fetches all WC2026 matches from football-data.org and upserts into `matches` |
| `scripts/seed-venues.ts` | One-off: writes hard-coded venue names into all 48 group stage matches |

Run with: `npx ts-node --skip-project scripts/<name>.ts`

---

## Middleware Note

`middleware.ts` uses `jose` to verify the JWT. It was briefly renamed to `proxy.ts` (per Next.js 16 deprecation warning) but this caused a Turbopack build error — reverted back to `middleware.ts`. The deprecation warning is harmless; ignore it.

---

## New Laptop Setup

```bash
git clone https://github.com/dylansahota/wc26-predictor.git
cd wc26-predictor
npm install
# Create .env.local with all 6 env vars (get values from Vercel dashboard or password manager)
npm run dev
```

To deploy:
```bash
vercel --prod
vercel alias set <deployment-url> worldcup26-predictor-seven.vercel.app --scope pl-predictor
```
