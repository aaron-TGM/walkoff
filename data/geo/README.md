# Geo reference data

Used by `lib/affinity` to turn a brand's customer counts into an affinity
map, and by `lib/places` to find athletes' hometowns and draw a circle
around a town. All the files are generated; rebuild them with:

```bash
npx tsx scripts/build-geo.ts      # postal-areas.json (downloads ~280 MB into .cache/)
npx tsx scripts/build-teams.ts    # team-homes.json (reads the ESPN team feeds)
npx tsx scripts/build-places.ts   # zip5.json and places-*.json (same cache, plus ~45 MB)
```

## postal-areas.json

One row per postal area: `[code, lat, lng, population, region, ref]`, where
`ref` is the full postal code nearest the area's center (Klaviyo's "within N
miles of" segment condition needs a real code). Walkoff never works below
this level.

| Country | Area | Count | Centroid | Population |
|---------|------|-------|----------|------------|
| US | 3-digit ZIP prefix | 890 | Population-weighted ZCTA centroids, 2023 Gazetteer | 2010 ZCTA population moved forward with Vintage 2025 county estimates |
| CA | Forward sortation area | 1,665 | Mean of postal codes, GeoNames | Postal-code count scaled to the 2021 Census total (Statistics Canada files aren't reachable from our build environment) |
| GB | Postcode district | 2,978 | Mean of postcodes, GeoNames | ONS Census 2021 postcode headcounts (England and Wales); Scotland and Northern Ireland from postcode counts |

## team-homes.json

Where each V1 team plays, the shape of its fan base, and its colors. Homes
come from the ESPN feeds (stadium ZIP, or the city of the team's home games),
corrected in `scripts/lib/team-overrides.ts` where the feed is stale. The
same file holds the fan-base shape: relative size in shared markets,
national reach, regional followings, and second homes where a team that
moved kept its fans (the Chargers in San Diego). Colors come from the feeds
too, with Premier League clubs corrected where the feed lists kit colors.
Review it each season, especially Premier League promotion and relegation.

## zip5.json

Every US ZIP code tabulation area with people in it: `zip, lat, lng,
population, name, region`. Population is worked out the same way as in
postal-areas.json, so a 3-digit area's people are the sum of its ZIPs'.
`name` and `region` are the ZIP's postal name and state from GeoNames, which
is how a ZIP finds its town: 92672's center is out on Camp Pendleton, but
its postal name is San Clemente. `lib/places` uses the file to count the
people in a circle around a town and the share of a 3-digit area inside it.
Server-only, like the places files: nothing a browser loads may import them.

## places-us.json, places-ca.json, places-gb.json

Towns and cities an athlete can be from, with the postal code nearest each
one's center (`ref`), the center Klaviyo draws a "within N miles of" circle
around. Rows are tab-separated text inside one JSON string; `names` is the
name people use, then any others, split by `|`.

| File | Rows | Sources |
|------|------|---------|
| places-us.json | 43,145 | Census places (cities, towns, villages, unincorporated communities and Puerto Rico's zonas urbanas); towns and townships in the 12 states where those are the local government (CT, MA, ME, NH, NJ, NY, PA, RI, VT, MI, MN, WI) when no place has the name; GeoNames postal names Census doesn't use, like Capistrano Beach and Sherman Oaks |
| places-ca.json | 3,305 | GeoNames places of 500 people or more |
| places-gb.json | 5,919 | GeoNames places of 500 people or more, nation as the region |

A Census place's center is its internal point, except for the few with
more water than land whose point lands out on the water: San Francisco's
is by the Farallon Islands, 30 miles from its people. Those take GeoNames'
point for the town when the ZIP nearest it carries the town's name and the
ZIP nearest Census's doesn't (10 places, San Francisco and Corpus Christi
among them).

US rows carry the land area in square miles (for a postal name, its ZIPs'
land) and a `rank`: 1 for a place with its own government, a city-county or
a zona urbana, which wins a name it shares with an unincorporated community
in the same state. Canadian and UK rows carry the population instead, and a
`section` flag for neighborhoods of a bigger city (Richmond Heights in
Saskatoon), which are found by name but never as the town at a point.

## Attribution

- U.S. Census Bureau: 2023 Gazetteer Files (ZCTAs, places and county
  subdivisions), 2010 ZCTA to County Relationship File, Vintage 2025 county
  population estimates. Public domain.
- GeoNames (geonames.org) postal code data and populated places
  (cities500), licensed under
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- Office for National Statistics, Census 2021 postcode headcounts. Contains
  public sector information licensed under the
  [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/).
