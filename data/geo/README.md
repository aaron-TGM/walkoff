# Geo reference data

Used by `lib/affinity` to turn a brand's customer counts into an affinity
map. Both files are generated; rebuild them with:

```bash
npx tsx scripts/build-geo.ts     # postal-areas.json (downloads ~280 MB into .cache/)
npx tsx scripts/build-teams.ts   # team-homes.json (reads the ESPN team feeds)
```

## postal-areas.json

One row per postal area: `[code, lat, lng, population, region]`. Walkoff
never works below this level.

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

## Attribution

- U.S. Census Bureau: 2023 Gazetteer Files, 2010 ZCTA to County Relationship
  File, Vintage 2025 county population estimates. Public domain.
- GeoNames (geonames.org) postal code data, licensed under
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- Office for National Statistics, Census 2021 postcode headcounts. Contains
  public sector information licensed under the
  [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/).
