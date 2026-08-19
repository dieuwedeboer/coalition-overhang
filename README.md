# Two Votes, Two MPs

https://vote.coalitiontracker.nz

A page that converts Coalition voters to the Split at the 2026 New Zealand general election: party vote NZ First or ACT, electorate vote National.

On current polling National already fills its share of the 120 with electorates. Extra National party votes elect nobody. The same party vote to NZ First or ACT still can. Hold those seats and National takes zero list MPs — an overhang — and the Coalition is more likely to be returned.

The page explains the two MMP votes, projects the House from the latest Taxpayers’ Union–Curia poll plus overhangs, and lists every general electorate with 2023 candidate vote counts: seats at risk, seats winnable, then the rest by how close National is.

## Local

```sh
python3 -m http.server 8080
```

## Data

`data/site.json` holds the current poll, 2026-notional winners, and official 2023 candidate votes.

- Notionals: [Tally Room](https://www.tallyroom.com.au/62140)
- 2023 candidate votes: Wikipedia MMP boxes citing [Electoral Commission official results](https://www.electionresults.govt.nz/electionresults_2023/)
- Poll: edit `poll` in `data/site.json` when a new Curia lands

Language is in `CONTEXT.md`. Decisions that would look odd without context are in `docs/adr/`.
