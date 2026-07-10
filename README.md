# ChipRatio

**A poker chip calculator that actually does the math.** Tell it what is in your case, how many people are playing, and what you want the buy-in to be. It hands every player an identical, exact chip stack, tells you what is left in the box for rebuys, and builds a blind structure to match. One screen. No ads. No signup. Free forever.

[**Open ChipRatio →**](https://chipratio.pages.dev)

[![CI](https://github.com/KarthikSubramanian07/ChipRatio/actions/workflows/ci.yml/badge.svg)](https://github.com/KarthikSubramanian07/ChipRatio/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Runtime dependencies: 0](https://img.shields.io/badge/runtime%20deps-0-brightgreen)

---

## Why this exists

Every home game starts the same way. Someone opens the chip case, stares at it, and says "so how many of each do we give everyone?" Then come the guesses, the uneven stacks, the player who somehow has all the whites, and the round of mental arithmetic that nobody enjoys.

The calculators already out there are mostly ad-choked pages or blog posts with a fixed recipe that ignores the set you actually own. ChipRatio takes your real chips and solves the real problem: a fair, exact, playable split, every time.

## What it does

- **Exact equal stacks.** Every player gets the same stack, and it sums to your buy-in exactly. If that is impossible with your chips, ChipRatio snaps to the nearest value it _can_ build fairly and says so out loud.
- **Real pyramids.** Plenty of the smallest chip to post and change blinds, fewer of each larger one, a couple of big chips to keep the pile small. The shape a good stack is supposed to have.
- **Leftover count.** What stays in the box after dealing, ready for rebuys, late arrivals, and color-ups.
- **A blind structure.** Small and big blind chosen to open around 100 big blinds deep, plus an escalating schedule for tournament play.
- **Smart Suggest.** No buy-in in mind? It picks a good one for your set and player count and tells you why.
- **Optional cash view.** Enter a real buy-in and see what each chip is worth. Pure arithmetic. ChipRatio never touches money.
- **Five themes, your set remembered.** Felt, Midnight, Ivory, Rose, and Neon. Your chip set lives in your own browser, not on a server.

## The interesting part: the allocation engine

The whole product is one pure, dependency-free TypeScript module (`src/engine`) with the UI bolted on afterward. It is fully unit tested before a single pixel was drawn.

Because every player gets an identical stack, the most anyone can receive of a denomination is `floor(count / players)`. Inside those caps ChipRatio finds the integer stack that hits the buy-in exactly and scores best as a pyramid.

The search is **exact, not a guess**. It enumerates every stack that sums to the target and keeps the best one. The trick that keeps it fast: the smallest chip is a free "remainder absorber," so once the counts of the larger chips are fixed, the smallest count is forced. That collapses the search to the handful of larger denominations, which real poker sets barely have.

Each candidate is scored on four things, with documented weights in `src/engine/quality.ts`:

- **Pyramid shape**: reward counts that never rise as value rises.
- **Blind readiness**: punish stacks too thin on small chips to post and change blinds.
- **Stack size**: nudge the total chip count toward a comfortable 30 to 50.
- **Change**: penalize a stack that cannot make change for one big blind.

Given the same inputs it always returns the same result. It is a calculator, so reproducibility is the point.

## Tech

- TypeScript and Vite, no UI framework, **zero runtime dependencies**.
- Engine: a pure module with [Vitest](https://vitest.dev) unit tests and an executable acceptance matrix.
- Chips and layout are drawn in CSS, original work, no image assets.
- Ships as a static site on Cloudflare Pages. $0 infrastructure.

## Run it locally

```bash
npm install
npm run dev        # start the dev server
npm test           # run the full test suite
npm run feel       # print real allocations across many sets to eyeball fairness
npm run check      # typecheck, lint, format check, and test in one go
npm run build      # production build into dist/
```

Node 20 or newer.

## Project layout

```
src/engine/    pure allocation math, no DOM (types, allocate, quality, blinds, suggest, money, summary)
src/ui/        the single-screen app (state, editor, results, themes, chip visuals)
scripts/       feel-test harness for eyeballing distributions
public/        favicon, OG image, robots, sitemap, Cloudflare headers
```

## Contributing

Issues and pull requests are welcome. The house style is short, plain, and human: no em dashes, no filler, comments that explain the _why_. If you touch the engine, keep it pure and add tests. `npm run check` should pass before you push.

## A note on scope

ChipRatio distributes chips and chip values. It is a math utility, not a gambling service. It does not track pots, winnings, or real money beyond the optional display conversion. Poker and its chip denominations are traditional and public, and every visual here is original.

## License

[MIT](LICENSE). Free forever, and free to fork.
