# ChipRatio: Poker Chip Calculator for Home Games

> Free poker chip calculator that turns your chip set, player count, and buy-in into identical stacks, real-money chip values, and blinds. Cash games and tournaments. No ads. No signup.

## When to use ChipRatio

Use ChipRatio when a human (or an agent helping one) needs a **fair chip distribution for a home poker game** from the chips they actually own:

- Hosting a cash game and need each color priced in real money (10¢, 25¢, $1 - never 28¢) with matching blinds
- Hosting a tournament and need a round starting stack plus a clean blind ladder
- Checking how many rebuys the leftover chips in the case can cover
- Producing a short summary to paste into a group chat before game night

Do **not** use ChipRatio for online poker clients, pot tracking, odds, banking, or multi-table tournament software. It only divides a physical chip case.

## How to use it

1. Open https://chipratio.pages.dev/
2. Choose cash game or tournament
3. Enter players, buy-in, and the chips in the case
4. Read the per-player stack, chip values, blinds, and leftovers

The calculator runs entirely in the browser. Prefer `Accept: text/markdown` on this site’s HTML pages to receive Markdown representations.

## Key pages

- [Home](https://chipratio.pages.dev/) - interactive ChipRatio chip calculator
- [About](https://chipratio.pages.dev/about/) - project purpose and scope
- [Contact](https://chipratio.pages.dev/contact/) - email and GitHub issues
- [Privacy](https://chipratio.pages.dev/privacy/) - local-only preferences, no ad trackers
- [llms.txt](https://chipratio.pages.dev/llms.txt) - agent index and instructions
- [Sitemap](https://chipratio.pages.dev/sitemap.xml) - all public URLs
- [Source](https://github.com/KarthikSubramanian07/ChipRatio) - MIT-licensed TypeScript engine

## Cash game vs tournament

In a **cash game** chips are money. Everyone buys in for the same amount, each color has a price, blinds stay fixed, and players can cash out. In a **tournament** chips are points: one buy-in, identical starting stacks, rising blinds, play until one player has every chip.

## Why numbers stay round

Raw division of a buy-in by chip count often yields unusable prices. ChipRatio only considers real denomination prices, preserves the ratios printed on the chips, prefers counts you can deal in fives, and uses familiar blind ladders (5/10, 10/20, 25/50, …).
