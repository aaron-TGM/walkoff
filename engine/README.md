# Walkoff moment engine

An always-on worker that watches every game in the V1 leagues, detects the
moments fans care about, and saves them to Supabase. It also has Claude tag
each brand's new products a minute or so after they're uploaded. It runs
separately from the website: Vercel functions time out, and this needs to
keep polling all night.

```
ESPN scoreboards ─► normalize ─► moment rules ─► Supabase
 (per league)       (GameState)   (rules.ts)      teams, games, moments,
                                                  engine_heartbeats ─► walkoff.io/status
```

## Catalog tagging

When a brand uploads products, the upload page saves them with keyword
tags. Every minute the engine looks for products and color names only the
keyword rules have read, and runs Claude's pass on them (`tagger.ts`,
`lib/affinity/catalog-tagging.ts`): the teams a product is made for, its
colors, uses, seasons and interests, and what names like "Dune" look like.
Then it refreshes the brand's fan map, so picks use Claude's tags.

- One brand at a time, the newest upload first. Products are saved 200 at a
  time, so a restart keeps what's done. A typical catalog takes a few
  minutes.
- Claude's tags stick. A later upload keeps them, unless a product's title,
  type, category, tags or description changed: then it's tagged again.
- Products Claude couldn't tag keep their keyword tags and get another try
  an hour later. If Claude rejects the API key or the model, tagging pauses
  for an hour and logs an error.
- It's on when `ANTHROPIC_API_KEY` is set. Each run logs its token count and
  an estimated cost. `scripts/tag-catalog.ts` is still there for a dry run,
  redoing a catalog (`--all`) or trying a file.

## What it detects

| Phase  | Moment            | When it fires |
|--------|-------------------|---------------|
| Before | `rivalry_preview` | A listed rivalry game starts within 48 hours (`moments/rivalries.ts`, 132 pairs) |
| Before | `big_game_alert`  | A postseason or championship game starts within 24 hours |
| Before | `season_opener`   | A team with an 0-0 record plays within 24 hours |
| During | `close_game`      | Late in the game and within one score |
| During | `comeback_live`   | A team that trailed big is back within one score in the second half |
| During | `clutch_moment`   | Bases loaded or the tying run in scoring position late (MLB), final drive (football), last shot (basketball) |
| After  | `team_win`        | Any other regular-season or playoff win. Intensity follows how often the sport plays: NFL 0.7, college football and Premier League 0.65, NBA, NHL and college basketball 0.4, MLB 0.3 |
| After  | `walkoff_win`     | MLB walk-off, NHL overtime or shootout, football winning score in OT or the last 10 seconds |
| After  | `buzzer_beater`   | Basketball go-ahead score with 3 seconds or less left |
| After  | `late_winner`     | Soccer winner at 85'+, football go-ahead in the last 2:00, basketball in the last minute |
| After  | `comeback_win`    | Winner overcame a big deficit (MLB 4, football 14, NBA 15, NCAAB 12, NHL 2, soccer 1) |
| After  | `rivalry_win`     | Winner beat a listed rival |
| After  | `heartbreak_loss` | Loser lost on a walk-off or late winner, blew a big lead, or lost by one score |
| Season | `playoff_advance` | Won a playoff series or single-elimination playoff game |
| Season | `title_won`       | World Series, NBA Finals, Stanley Cup, Super Bowl or national championship |

Thresholds per league live in `moments/sports.ts`. Every moment has an
`intensity` from 0 to 1 (postseason adds 0.1), so brands can choose how big a
moment has to be before they send anything.

Each moment is saved once: `dedupe_key` is unique per moment type, game and
team.

## How it polls

- Every 15 seconds while any game in a league is live, every minute when a
  game is about to start or a final is settling, otherwise every 5 minutes.
- Football reads the current week's scoreboard; other leagues read today's
  date in US Eastern time (plus yesterday until 6am, and the next two days
  every 30 minutes for previews).
- For football and basketball finals it also reads the play-by-play, to tell
  a walk-off or buzzer beater from an early lead that held.
- On restart it reloads the last 36 hours of games from Supabase, so it
  neither misses a final it was watching nor repeats moments it already
  saved. Finals it has never seen and that ended long ago are skipped as
  stale.
- If a feed fails it backs off (15s, 30s, 60s, up to 5 minutes) and records
  the error in `engine_heartbeats`, which walkoff.io/status shows.

## Run it locally

```bash
npm run engine:once      # poll every league once, log moments, exit
npm run engine:dev       # keep running, reload on changes
npm run engine:test      # unit tests on real games in engine/__fixtures__
```

Without Supabase credentials it runs in dry-run mode: moments are logged,
not saved.

| Variable                    | Default        | Notes |
|-----------------------------|----------------|-------|
| `SUPABASE_URL`              |                | Falls back to `NEXT_PUBLIC_SUPABASE_URL` |
| `SUPABASE_SERVICE_ROLE_KEY` |                | Needed to save anything |
| `DRY_RUN`                   | `0`            | `1` logs moments instead of saving them |
| `LEAGUES`                   | all            | Comma list, e.g. `nfl,nba,epl` |
| `ONCE`                      | `0`            | `1` polls each league once and exits |
| `LIVE_POLL_SECONDS`         | `15`           | |
| `SOON_POLL_SECONDS`         | `60`           | |
| `IDLE_POLL_SECONDS`         | `300`          | |
| `PORT`                      | `8080`         | Serves `/healthz` |
| `LOG_LEVEL`                 | `info`         | `debug` for more |
| `ANTHROPIC_API_KEY`         |                | Turns on catalog tagging |
| `TAG_CATALOGS`              | `1`            | `0` turns catalog tagging off |
| `WALKOFF_TAG_MODEL`         | `DEFAULT_MODEL`| In `lib/affinity/claude-tagger.ts` |
| `WALKOFF_TAG_EFFORT`        | `medium`       | `low` to `max` |

## Set up Supabase

Run `supabase/003_moment_engine.sql` in the Supabase SQL editor (after
`002_early_access.sql`). It creates `teams`, `games`, `moments` and
`engine_heartbeats`, with row level security on and no public access.

## Deploy to Google Cloud Run

One always-on instance with CPU always allocated. Exactly one instance, so
two pollers never race each other.

```bash
PROJECT=your-gcp-project
REGION=us-central1
gcloud config set project $PROJECT
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com secretmanager.googleapis.com

# One time: image repository, and the Supabase and Anthropic keys as secrets.
gcloud artifacts repositories create walkoff --repository-format=docker --location=$REGION
printf '%s' "YOUR_SERVICE_ROLE_KEY" | gcloud secrets create supabase-service-role-key --data-file=-
printf '%s' "YOUR_ANTHROPIC_API_KEY" | gcloud secrets create anthropic-api-key --data-file=-
PROJECT_NUMBER=$(gcloud projects describe $PROJECT --format='value(projectNumber)')
for SECRET in supabase-service-role-key anthropic-api-key; do
  gcloud secrets add-iam-policy-binding $SECRET \
    --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
    --role=roles/secretmanager.secretAccessor
done

# Build (from the repo root) and deploy. Repeat both to ship an update.
gcloud builds submit --config engine/cloudbuild.yaml .
gcloud run deploy walkoff-engine \
  --image $REGION-docker.pkg.dev/$PROJECT/walkoff/engine:latest \
  --region $REGION \
  --no-cpu-throttling --min-instances 1 --max-instances 1 \
  --cpu 1 --memory 512Mi \
  --no-allow-unauthenticated \
  --set-env-vars SUPABASE_URL=https://YOUR-PROJECT.supabase.co \
  --set-secrets SUPABASE_SERVICE_ROLE_KEY=supabase-service-role-key:latest,ANTHROPIC_API_KEY=anthropic-api-key:latest
```

Already running without the Anthropic key? Create the `anthropic-api-key`
secret and its binding as above, then build and deploy with the new
`--set-secrets` line. The log line "Moment engine starting" says
`"tagging":true` once it's on.

`cloudbuild.yaml` assumes `us-central1`; change it there too if you use
another region. One always-on instance at this size typically costs tens of
dollars a month; check the Cloud Run pricing calculator for your region.

Logs are JSON lines with `severity`, so Cloud Logging filters work, e.g.
`jsonPayload.moment="walkoff_win"`.

## Not yet

- `playoff_clinch` (needs standings), `player_milestone`, `big_signing` and
  `great_escape` are in the site's trigger library but not detected yet.
- Hockey late winners need hockey play-by-play.
- Brands act on moments through the MCP server (docs/mcp.md): it matches
  each moment to the brand's fan territories and products and drafts the
  campaign in the marketer's own Klaviyo.
