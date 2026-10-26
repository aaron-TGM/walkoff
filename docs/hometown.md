# Hometown moments

When someone from a town wins, the town celebrates. A brand with customers
there can celebrate with it: a deal for everyone in and around the town,
in the champion's colors, that never names the athlete.

The example: Super Bowl LX, February 8, 2026. Seattle won 29 to 13, and Sam
Darnold, who grew up in San Clemente, California, led Seattle in passing. A
brand with customers around San Clemente gets "San Clemente, what a night."
for the people within 5 miles of 92673.

**Status:** live. Counsel signed off on the copy rules below in October
2026, and hometown moments are on for every brand. Two switches turn them
off: `HOMETOWN=0` on the engine stops making them, and
`WALKOFF_HOMETOWN=0` on the website keeps them from brands (operators still
see them, to test).

## How a moment is made

1. **Rosters.** The engine reads every team's roster daily, with where
   each player is from: ESPN's birthplace, Wikidata's high school and
   birthplace, Walkoff's own research (`data/athletes/curated.json`) and
   operators' fixes (`set_athlete_home`). A high school beats a
   birthplace; the curated file and operators beat both. See
   `lib/athletes/homes.ts`.
2. **The title.** When a team wins a title, the poller puts its players on
   the title moment: the game's leaders, and everyone with a line in the
   box score (`engine/moments/heroes.ts`).
3. **The towns.** The hometown job (`engine/hometown.ts`) records each
   player's part and makes one moment per town:

   | Part | Who | Intensity |
   |------|-----|-----------|
   | Leader | led the team in the game | 0.95 |
   | Played | had a line in the box score | 0.85 |
   | Roster | on the roster | 0.75 |
   | Reserve | injured reserve, practice squad, suspended | 0.70 |

   Big cities (more than 750,000 people in the town's circle) get a moment
   only when a person set the home: a birthplace is too thin a link to a
   city of millions.
4. **Golf.** The engine follows the PGA Tour, LPGA, DP World Tour and LIV
   (`engine/golf`). A winner's town gets `hometown_win` once the event is
   final: 0.95 for a major, 0.85 for an elevated PGA Tour event, 0.80 on the
   PGA Tour or LPGA, 0.75 on the DP World Tour, 0.70 on LIV, and 0.05 more
   for a playoff. Whoever leads into the final round gets
   `hometown_contender` once their tee times are out: 0.7 at a major, 0.55
   elsewhere, open until they tee off.
5. **Playoff game-winners.** When a playoff game ends on a walk-off, a
   buzzer-beater or an overtime winner, whoever decided it gets
   `hometown_game_winner` for their town: the batter of the walk-off, the
   scorer of the overtime goal, the shooter of the buzzer-beater, and in
   football the players the scoring play names (`engine/moments/deciders.ts`).
   0.9, or 0.95 in the World Series, NBA Finals or Stanley Cup Final. A
   walk-off on an error or a wild pitch has no decider. In a title game the
   decider is one of the champion's leaders instead, so the town gets the
   title once. Example: Ryan Poehling's overtime goal for the Ducks in the
   2026 first round makes "Lakeville, what a finish." for Lakeville,
   Minnesota, where he was born. Needs `supabase/010_player_moments.sql`.
6. **Tennis.** The engine follows the ATP and the WTA, singles only
   (`engine/tennis`). A winner's town gets `hometown_win` once the final is
   over: 0.95 for a Grand Slam, 0.90 for the year-end Finals, 0.85 for a
   1000-level event, 0.75 for any other tour event. Both finalists' towns
   get `hometown_contender` before the final: 0.7 at a Slam, 0.55
   elsewhere, open until it starts.
7. **Racing.** NASCAR's Cup Series, Formula 1 and IndyCar (`engine/racing`).
   A race winner's town gets `hometown_win`: 0.95 for the Daytona 500 and
   the Indy 500, 0.85 in Formula 1, 0.80 in the Cup Series, 0.75 in
   IndyCar. Example: Tyler Reddick's 2026 Daytona 500 makes one for
   Corning, California.
8. **Wins Walkoff doesn't follow.** An operator records them with
   `create_moment` (a surfing win, a medal), and the towns' moments are made
   right away.

## Who sees it

Each town has a circle: the smallest of 3, 5, 8, 10, 15, 20 or 25 miles
that holds 75,000 people and covers the town, centered on its own postal
code (`lib/places/circle.ts`). Walkoff estimates a brand's customers inside
it from where its customers are, by postal area.

A brand gets a town's moment when:

- it has 50 or more customers estimated in the circle, or 15 or more that
  are 2.5 times the town's share of people (a brand whose customers bunch in
  the town is undercounted by postal area, and the lift catches it);
- the moment passes its triggers (the default takes hometown moments at
  0.6 and up; a trigger can name towns, and takes moments within 10 miles
  of them, and set its own customer bar);
- it's one of the event's top 5 towns for the brand: the towns of those who
  did the most first, then the most customers. The rest are listed by name.

A town inside the winner's own core territory is left out when the brand's
queue already has the team's moment for that game (its title, its
walk-off), so nobody there gets two sends. Team queries never include hometown moments: a Seattle brand gets
the title, not San Clemente's moment.

## The campaign

`build_campaign` with a hometown moment gives:

- **The audience:** one Klaviyo circle, "within 5 miles of 92673", saved
  once as "Walkoff · San Clemente, CA (5 mi)" and reused for every later
  moment there. Only Klaviyo subscribers inside it get the email.
- **Products:** the brand's own named for the town first ("San Clemente
  Pier Hoodie"), then the champion's colors. For a golfer or anyone else
  without a team, their sport's scene (golf, tennis, motorsports, surf).
  The colors in the copy come from the products picked for them, not from
  one picked for the town's name.
- **A contender's send** goes out the morning of the final round, in the
  town's time: "All eyes on Holywood today."
- **Copy:** "San Clemente, what a night." "Navy and green all over San
  Clemente today." A game-winner's: "Lakeville, what a finish." The send
  time is the town's, never late at night.
- **Name:** "Walkoff · San Clemente, CA · Hometown Champion · Feb 8". No
  athlete or team, in the campaign or the segment.

## Copy rules

Counsel signed off on these in October 2026. Without an athlete's written
agreement on file, in date:

1. Celebrate the town, never the athlete: no name, nickname, initials,
   number, position, school or photo, and nothing like "local kid", "one of
   our own", "hometown hero" or "born and raised".
2. Never name the team, league or event (no Super Bowl, World Series,
   Masters or Wimbledon), unless the brand is licensed for team marks. No
   logos, trophies or footage.
3. Don't say or imply that an athlete or team endorses the brand.
4. The town's name and the colors are the whole signal. Send only to the
   town's circle, never the whole list.

With an agreement in date (`record_athlete_rights`: dates and where the
signed agreement is), the brand may name that athlete within the
agreement. Walkoff warns to get the athlete's OK for each use, and to use
photos only if the agreement covers them. Other athletes from the town
still go unnamed.

Tests hold the generated copy to these rules: `assertNeverNamesAthlete` and
`assertNeverNames` in `lib/testing/names.ts`.

## For operators

- `set_athlete_home` fixes where an athlete is from. Titles from the last
  72 hours get the new town's moment within a few minutes; the old town's
  stays until you retract it.
- `retract_moment` takes a wrong moment out of every queue, and lists the
  brands that already drafted or sent it.
- `create_moment` records a win Walkoff doesn't follow.
- `local_athletes` shows any brand which athletes are from near its
  customers.
- `exclude_athlete` is for an athlete, or someone for them, who asks
  Walkoff to stop using them, as the privacy policy promises
  (`/privacy#athletes`). It deletes where they're from, and nothing saves
  it again: not the roster sync, Wikidata, a bio or an operator. No
  hometown moment or big signing is made about them. It keeps their roster
  details, so Walkoff knows them when a roster lists them again, and lists
  the moments about them from the last week: retract those. If they're in
  `data/athletes/curated.json`, take them out too. `undo: true` takes it
  back when they ask, and their roster, bio and Wikidata are read again.
  Needs `supabase/011_athlete_opt_outs.sql`.

## Switches

| Where | Switch | Default | Off |
|-------|--------|---------|-----|
| Engine (Cloud Run) | `HOMETOWN` | on | `0`: no new hometown moments |
| Website (Vercel) | `WALKOFF_HOMETOWN` | on | `0`: brands don't see them; operators still do |

The site's moment lists and the help center's tables follow
`WALKOFF_HOMETOWN` too (`brandTriggers` in `lib/triggers.ts`).

## Limits

- ESPN's API is unofficial. Rosters add about 650 requests a day, a title
  one more summary, and golf, tennis and racing about 1,800 reads a day
  across their nine tours and series, plus a bio for each athlete the first
  time they play.
- A roster is read when the title is recorded, so a player signed in the
  days after a title can count as on the roster.
- A playoff game-winner needs one more read of the game's summary in
  baseball and hockey: a few a year.
- Customer counts by postal area undercount a brand whose customers bunch
  in one town. Klaviyo's count for the circle is the real one.
- Golfers', tennis players' and drivers' birthplaces come from ESPN's bios.
  Some are places Walkoff doesn't know (Scarborough, New York, is a hamlet
  with no postal name of its own), some only a town's name ("Worcester",
  which could be in England or Massachusetts), and some are missing: those
  make no moment until an operator sets the home.
- Surfing has no feed, so its wins come in through `create_moment`.
