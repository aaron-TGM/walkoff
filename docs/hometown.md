# Hometown moments

When someone from a town wins, the town celebrates. A brand with customers
there can celebrate with it: a deal for everyone in and around the town,
in the champion's colors, that never names the athlete.

The example: Super Bowl LX, February 8, 2026. Seattle won 29 to 13, and Sam
Darnold, who grew up in San Clemente, California, led Seattle in passing. A
brand with customers around San Clemente gets "San Clemente, what a night."
for the people within 5 miles of 92673.

**Status:** built, and off for brands. Counsel signs off on the copy rules
below before launch. Until then, Walkoff operators see hometown moments in
Claude, to test: `HOMETOWN=1` on the engine makes them, and only operators
see them until `WALKOFF_HOMETOWN=1` on the website.

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
3. **The towns.** The hometown job (`engine/hometown.ts`, on with
   `HOMETOWN=1`) records each player's part and makes one moment per town:

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
5. **Wins Walkoff doesn't follow.** An operator records them with
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

A town inside the champion's own core territory is left out when the
brand's queue already has the team's title, so nobody there gets two
sends. Team queries never include hometown moments: a Seattle brand gets
the title, not San Clemente's moment.

## The campaign

`build_campaign` with a hometown moment gives:

- **The audience:** one Klaviyo circle, "within 5 miles of 92673", saved
  once as "Walkoff · San Clemente, CA (5 mi)" and reused for every later
  moment there. Only Klaviyo subscribers inside it get the email.
- **Products:** the brand's own named for the town first ("San Clemente
  Pier Hoodie"), then the champion's colors. For a golfer or anyone else
  without a team, their sport's scene (golf, tennis, motorsports, surf).
- **A contender's send** goes out the morning of the final round, in the
  town's time: "All eyes on Holywood today."
- **Copy:** "San Clemente, what a night." "Navy and green all over San
  Clemente today." The send time is the town's, never late at night.
- **Name:** "Walkoff · San Clemente, CA · Hometown Champion · Feb 8". No
  athlete or team, in the campaign or the segment.

## Copy rules, for counsel

Without an athlete's written agreement on file, in date:

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

## Launch

One small change, after counsel signs off:

1. `WALKOFF_HOMETOWN=1` on the website (Vercel), and `HOMETOWN=1` on the
   engine (Cloud Run) if it isn't on already for testing.
2. The hometown types join the site's moment lists (`lib/triggers.ts`) and
   the help center, with the copy rules.
3. The town-only copy rule joins Claude's instructions for everyone
   (`lib/mcp/server.ts`).
4. The privacy policy mentions athlete data: public facts about public
   figures, no birth dates. The founder words it.

## Limits

- ESPN's API is unofficial. Rosters add about 650 requests a day, a title
  one more summary, and golf about 800 leaderboard reads a day across the
  four tours, plus a bio for each golfer the first time they play.
- A roster is read when the title is recorded, so a player signed in the
  days after a title can count as on the roster.
- Customer counts by postal area undercount a brand whose customers bunch
  in one town. Klaviyo's count for the circle is the real one.
- Golfers' birthplaces come from ESPN's bios, and some are places Walkoff
  doesn't know (Scarborough, New York, is a hamlet with no postal name of
  its own): those make no moment until an operator sets the home.
- Tennis, racing and surfing come next. Until then, `create_moment`.
