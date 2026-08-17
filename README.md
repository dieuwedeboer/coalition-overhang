# Two Votes, Two MPs

A single static page arguing tactical voting at the 2026 New Zealand election: party vote NZ First or ACT, electorate National, so National takes Zero List Seats and the Coalition is more likely to be returned.

Live (once DNS is pointed): https://vote.coalitiontracker.nz

GitHub Pages deploys from `main` via `.github/workflows/pages.yml`. Point a CNAME for `vote` at `dieuwedeboer.github.io`. The repo already has `CNAME` set to `vote.coalitiontracker.nz`.

Standalone HTML/CSS/JS. Not part of the [coalition tracker](https://coalitiontracker.nz) codebase — that domain is only borrowed for hosting.

## Local

Any static server from the repo root:

```sh
python3 -m http.server 8080
```

## Data

`data/site.json` is the whole model: the current Taxpayers’ Union–Curia poll, 2026-notional winners, and official 2023 candidate vote counts.

- Notionals: [Tally Room](https://www.tallyroom.com.au/62140)
- 2023 candidate votes: Wikipedia MMP boxes citing [Electoral Commission official results](https://www.electionresults.govt.nz/electionresults_2023/) (raw dump in `data/votes-2023.json`)
- Poll: edit `poll` in `data/site.json` when a new Curia lands, then rebuild the page

Set `pinned` in `data/site.json` to raise specific electorates later.

## Language

See `CONTEXT.md`. Decisions that would look odd without context are in `docs/adr/`.
