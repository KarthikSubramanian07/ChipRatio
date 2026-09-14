# ChipRatio

**A poker chip calculator that talks like a poker player.** Pick cash game or tournament, set the players and the buy-in, and ChipRatio tells you exactly how many of each color everyone gets, what each chip is worth, and what the blinds are. Every number is one a person would choose on their own: a white chip is worth 10¢, never 28¢. Free forever. No ads. No signup.

[**Open ChipRatio →**](https://chipratio.pages.dev)

[![CI](https://github.com/KarthikSubramanian07/ChipRatio/actions/workflows/ci.yml/badge.svg)](https://github.com/KarthikSubramanian07/ChipRatio/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Runtime dependencies: 0](https://img.shields.io/badge/runtime%20deps-0-brightgreen)
![Works on phone, iPad, desktop](https://img.shields.io/badge/works%20on-phone%20%C2%B7%20iPad%20%C2%B7%20desktop-0b6b3a)
[![Buy Me A Coffee](https://img.shields.io/badge/buy%20me%20a-coffee-ffdd00.svg)](https://buymeacoffee.com/winnerkarthik)

`poker` `chip-calculator` `home-game` `cash-game` `tournament` `blind-structure` `typescript` `vite` `cloudflare-pages`

---

## Why this exists

Every home game starts the same way. Someone opens the chip case and asks "so how many of each do we give everyone, and what's a red worth?" Then come the guesses, the uneven stacks, and the mental arithmetic nobody enjoys.

Most calculators answer with raw division. Twenty dollars across 71 chips is 28¢ a chip, which is technically correct and completely useless at a real table. ChipRatio solves the problem a host actually has: a fair split, in numbers you can say out loud and make change with.

## What it does

- **Cash game or tournament, in plain words.** Cash game: chips are money, blinds stay put. Tournament: chips are points, blinds go up.
- **Chip values that are real money.** For a $20 game on a standard set: white 10¢, red 50¢, green $2.50, black $10, blinds 10¢/20¢. Never $1.25 or 28¢.
- **Counts you can deal fast.** Stacks favor counts you count out in fives (15, 10, 5) and a proper pyramid: plenty of small chips for blinds, fewer big ones.
- **Round tournament stacks.** 500, 1,000, 2,500. If your case cannot build the stack you asked for, it picks the nearest round one and says why.
- **Real blind ladders.** 5/10, 10/20, 15/30, 25/50 ... no 2/3 or 14/27.
- **What is left in the case**, and how many rebuys it covers.
- **Copy for the group chat.** One tap, readable in any messaging app.
- **Built for the table.** Phone layout with an answer bar pinned to the bottom of the screen, a side-by-side iPad layout, 44px touch targets, five themes, and your chip set remembered in your own browser.

## How the math works

The engine is a pure, dependency-free TypeScript module in `src/engine`, unit tested and exercised by an acceptance matrix across every preset, player count, and game type.

```
            ┌──────────────┐
 chip set ─▶│ calculate()  │─▶ Result: stack, chip values, blinds, leftovers, warnings
 config   ─▶│  index.ts    │
            └──────┬───────┘
          cash     │     tournament
      ┌────────────┴────────────┐
┌─────▼─────┐             ┌─────▼────────┐
│ cash.ts   │             │ tournament.ts│
│ try every │             │ try every    │
│ real price│             │ round stack  │
│ per chip  │             │ the case can │
│ (10¢, 25¢,│             │ build        │
│ $1 ...)   │             │              │
└─────┬─────┘             └─────┬────────┘
      └────────────┬────────────┘
             ┌─────▼──────┐   ┌────────────┐   ┌───────────┐
             │ allocate.ts│──▶│ quality.ts │   │ blinds.ts │
             │ exact stack│   │ score it   │   │ real      │
             │ search     │   │            │   │ ladders   │
             └────────────┘   └────────────┘   └───────────┘
                         nice.ts: what counts as a round number
```

**Cash games** work in integer cents, so there is no floating-point rounding anywhere. ChipRatio tries each real-money value for the smallest chip (1¢, 5¢, 10¢, 20¢, 25¢, 50¢, $1 ...), keeps the ratios printed on your chips, and throws out any choice that would price a color at an odd amount. It solves a stack for every survivor and keeps the one that hits your buy-in exactly with the best stack and a comfortable depth of around 100 big blinds.

**Tournaments** try every round starting stack the case can build (only the ones that land near a sensible chip count) and keep the best game.

**The stack search** is exact. Every player gets an identical stack, so each color is capped at `floor(count / players)`. The solver enumerates stacks that hit the target and scores each one (`quality.ts`):

- **Pyramid shape**: counts never rise as value rises.
- **Blind readiness**: enough small chips to post and make change.
- **Stack size**: close to your chosen chips per player.
- **Easy to count**: counts in fives beat counts like 7 or 13.
- **Change**: the stack can make change for one big blind.

The smallest chip absorbs the remainder, so the search only branches over the larger colors, and losing stacks skip the expensive change check. Given the same inputs it always returns the same answer.

## Tech

- TypeScript and Vite, no UI framework, **zero runtime dependencies**.
- Vitest unit tests, an acceptance matrix, and a jsdom smoke test of the full UI.
- Chips and layout drawn in CSS. No image assets, no web fonts.
- Static site on Cloudflare Pages. $0 infrastructure.

## Run it locally

```bash
npm install
npm run dev        # start the dev server
npm test           # run the full test suite
npm run feel       # print real splits across many sets to eyeball them
npm run check      # typecheck, lint, format check, and test in one go
npm run build      # production build into dist/
```

Node 20 or newer.

## Project layout

```
src/engine/    pure math, no DOM: types, nice numbers, allocate, quality, blinds, cash, tournament, format, summary
src/ui/        the calculator: state (localStorage), app (setup + results), chips, themes
src/styles/    one stylesheet, five themes, phone and tablet layouts
scripts/       feel-test harness for eyeballing real splits
public/        favicon, OG image, robots, sitemap, Cloudflare headers
```

## Contributing

Issues and pull requests are welcome. House style is short, plain, and human: no em dashes, no filler, comments that explain the _why_. If you touch the engine, keep it pure, add tests, and run `npm run feel` to check the answers still read naturally. `npm run check` should pass before you push.

## A note on scope

ChipRatio divides a chip case. It is a math utility, not a gambling service: it does not track pots, winnings, or hold any money. Every visual is original.

## License

[MIT](LICENSE). Free forever, and free to fork.

If ChipRatio saved your poker night, [buy me a coffee](https://buymeacoffee.com/winnerkarthik). Entirely optional, the tool stays free either way.
