# Walkoff moment engine

An always-on worker that watches every game in the V1 leagues, detects the
moments fans care about, and saves them to Supabase. It also has Claude tag
each brand's new products a minute or so after they're imported or
uploaded, keeps every team's roster with where each athlete is from, and
can make a moment for each town a champion's players are from.
It runs separately from the website: Vercel functions time out, and this
needs to keep polling all night.

```
ESPN scoreboards ─► normalize ─► moment rules ─► Supabase
 (per league)       (GameState)   (rules.ts)      teams, games, moments,
                                                  engine_heartbeats ─► walkoff.io/status
```

## Catalog tagging

When a brand's products come in, from its store in Claude
(`import_catalog`) or the upload page, they're saved with keyword tags. Every minute the engine looks for products and color names only the
keyword rules have read, and runs Claude's pass on them (`tagger.ts`,
`lib/affinity/catalog-tagging.ts`): the teams a product is made for, its
colors, uses, seasons and interests, and what names like "Dune" look like.
Then it refreshes the brand's fan map, so picks use Claude's tags.

- One brand at a time, the newest import or upload first. Products are saved 200 at a
  time, so a restart keeps what's done. A typical catalog takes a few
  minutes.
- Claude's tags stick. A later import or upload keeps them, unless a product's title,
  type, category, tags or description changed: then it's tagged again.
- Products Claude couldn't tag keep their keyword tags and get another try
  an hour later. If Claude rejects the API key or the model, tagging pauses
  for an hour and logs an error.
- It's on when `ANTHROPIC_API_KEY` is set. Each run logs its token count and
  an estimated cost. `scripts/tag-catalog.ts` is still there for a dry run,
  redoing a catalog (`--all`) or trying a file.

## Athletes and hometowns

For hometown moments, the engine keeps who plays for each team and where
they're from (`athletes/sync.ts`, `lib/athletes`, `lib/places`).

- Every team Walkoff has a home for (644 across the V1 leagues) gets its
  ESPN roster read once a day, two teams a minute. Players a team no longer
  lists come off it. ESPN's birthplace for each player is matched to a town
  when it's new or its text changed.
- Wikidata adds high schools and birthplaces, with coordinates, for the
  athletes it links to an ESPN id: one request of up to 200 a minute at
  most, and each athlete again after 30 days. When Wikidata says it's busy,
  the lookups wait 15 minutes, then longer each time, up to 4 hours.
- The hometowns in `data/athletes/curated.json` are saved once their
  athlete has been on a roster, and come back out when they leave the file.
- Progress is saved per team (`roster_syncs`), so a restart picks up where
  it stopped. A team whose roster fails waits an hour per failure in a row.
  An empty roster from ESPN counts as a failure, so nobody comes off a team
  by mistake.
- Until `supabase/009_athletes.sql` has run, it waits an hour and checks
  again.
- Its heartbeat is the `athletes` row in `engine_heartbeats`, where `games`
  is the number of teams whose roster is under a day old.
- It's on whenever the engine saves to Supabase. `ATHLETES=0` turns it off,
  and `WIKIDATA=0` turns off only the Wikidata lookups.

## Hometown moments

When a team wins a title, every town its players are from gets a moment of
its own (`hometown.ts`, `lib/hometown`). A brand with customers near the
town can celebrate it, without naming the player. Off unless `HOMETOWN=1`:
hometown campaigns wait for counsel to sign off on their copy rules
(docs/hometown.md).

- The poller puts the champion's players on the title moment
  (`detail.heroes`, `moments/heroes.ts`): its leaders in the deciding game
  (ESPN's game leaders, a hockey game's three stars and winning goalie,
  baseball's winning pitcher and home runs) and everyone with a line in the
  box score. Football and basketball read the game summary anyway; for a
  baseball or hockey title it's one more read. A summary that fails never
  holds the title up.
- Every 5 minutes the job looks at the last 72 hours' titles. The first
  time it sees one, it reads the champion's roster again if it's more than
  36 hours old, then records each player's part as an athlete result:
  leader (0.95), played (0.85), roster (0.75) or reserve (0.70).
- Then one moment per town the players are from, from their homes sure
  enough for a moment (`momentHomes`): `hometown_title`, keyed by the game
  and the town, with the town's most prominent player as its athlete and
  everyone from there in `detail.athletes`. A town keeps the moment it got
  first; a home fixed later just adds the new town's. A big city (over
  750,000 people in the circle) gets one only when an operator or the
  curated file set the home.
- Super Bowl LX's roster makes about 75 towns. Brands see only those near
  their customers, a few an event (docs/hometown.md).
- Until `supabase/009_athletes.sql` has run, it waits an hour and checks
  again. Its heartbeat is the `hometown` row in `engine_heartbeats`, where
  `games` is the moments the last tick made.

## Golf

Golfers play for no team, so their towns are where golf reaches brands
(`golf/`, `lib/tours.ts`). One poller per tour: the PGA Tour, LPGA, DP
World Tour and LIV.

- Each tour's current leaderboard, every 5 minutes while an event is under
  way and every 10 otherwise. The field is saved as athletes, and five bios
  a poll say where golfers were born (ESPN's golfer ids are the same on
  every tour). The winner's and leaders' bios are read right away.
- A win counts only when the feed says the event is final, and only within
  60 hours of its last day: after round 3 the feed calls the round
  complete too, and a suspended final round reads as finished for players
  who are done.

  | Win | Intensity |
  |-----|-----------|
  | A major (by name: `golf/majors.ts`) | 0.95 |
  | An elevated PGA Tour event | 0.85 |
  | PGA Tour, LPGA | 0.80 |
  | DP World Tour | 0.75 |
  | LIV | 0.70 |
  | In a playoff | 0.05 more |

- After the next-to-last round, whoever leads, ties too, is a contender
  once their final-round tee times are in the feed: 0.7 at a major, 0.55
  elsewhere (under the default trigger's 0.6). The moment closes when they
  tee off. Each change in an event's status is logged: the feed is
  undocumented, and if it reads differently between rounds, no contender
  moment is made.
- Results are keyed by the event's name and last day, so an event two
  tours share counts once. With `HOMETOWN=1` the towns get `hometown_win`
  and `hometown_contender` moments, the same way as titles.
- Heartbeats are the `golf:pga`, `golf:lpga`, `golf:eur` and `golf:liv`
  rows. `GOLF=0` turns golf off.

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
  a walk-off or buzzer beater from an early lead that held. A title's box
  score comes from the same summary (one more read for baseball and
  hockey).
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
| `ATHLETES`                  | `1`            | `0` turns the athlete sync off |
| `WIKIDATA`                  | `1`            | `0` turns its Wikidata lookups off |
| `HOMETOWN`                  | `0`            | `1` turns hometown moments on |
| `GOLF`                      | `1`            | `0` turns the golf pollers off |

## Set up Supabase

Run `supabase/003_moment_engine.sql` in the Supabase SQL editor (after
`002_early_access.sql`). It creates `teams`, `games`, `moments` and
`engine_heartbeats`, with row level security on and no public access. For
the athlete sync, also run `supabase/009_athletes.sql`; until then the sync
waits and the rest of the engine runs as before.

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
secret and its binding as above, then build and add the key to the running
service. `--update-secrets` keeps the service's other settings and secrets:

```bash
gcloud builds submit --config engine/cloudbuild.yaml .
gcloud run deploy walkoff-engine \
  --image $REGION-docker.pkg.dev/$PROJECT/walkoff/engine:latest \
  --region $REGION \
  --update-secrets ANTHROPIC_API_KEY=anthropic-api-key:latest
```

The log line "Moment engine starting" says `"tagging":true` once it's on.
On its first start it tags every brand's products that only have keyword
tags, so the first runs cost the most. To turn tagging off without a
deploy: `gcloud run services update walkoff-engine --region $REGION
--update-env-vars TAG_CATALOGS=0`.

`cloudbuild.yaml` assumes `us-central1`; change it there too if you use
another region. One always-on instance at this size typically costs tens of
dollars a month; check the Cloud Run pricing calculator for your region.

Logs are JSON lines with `severity`, so Cloud Logging filters work, e.g.
`jsonPayload.moment="walkoff_win"`.

## Not yet

- `playoff_clinch` (needs standings), `player_milestone`, `big_signing` and
  `great_escape` are in the site's trigger library but not detected yet.
- Hometown moments for tennis, racing and surfing, and for a player's
  walk-off or buzzer beater. Until then an operator can record a win with
  `create_moment` (docs/hometown.md).
- Hockey late winners need hockey play-by-play.
- Brands act on moments through the MCP server (docs/mcp.md): it matches
  each moment to the brand's fan territories and products and drafts the
  campaign in the marketer's own Klaviyo.
