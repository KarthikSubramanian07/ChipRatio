# About ChipRatio

ChipRatio is a free poker chip calculator built for the moment before a home game starts: the case is open, people are sitting down, and someone has to decide how many of each color everyone gets and what each chip is worth.

Most tools answer with raw division. Twenty dollars across seventy-one chips is twenty-eight cents a chip - technically correct and useless when you need to make change. ChipRatio solves the host’s real problem: identical stacks, prices that are real money, and blinds that match a table people already know.

## What it does

You enter the chips in your case, how many players are at the table, and the buy-in. For a cash game, ChipRatio prices each color in cents and dollars that make sense, deals every player the same stack, and sets blinds on a familiar ladder. For a tournament, it builds a round starting stack the case can actually support and a blind structure that climbs cleanly. It also shows what stays in the box for rebuys and gives you a short summary for a group chat.

## How the project is run

ChipRatio is an independent, MIT-licensed open-source project. The calculator runs entirely in your browser: no accounts, no backend that stores chip sets, no ad network. Source code lives on GitHub. Hosting is a static site on Cloudflare Pages. The product goal is narrow on purpose - divide a chip case fairly.

## What it is not

ChipRatio does not track pots, winnings, or real-money transfers. It does not offer odds, hand histories, or multi-table tournament administration.

- Home: https://chipratio.pages.dev/
- Contact: https://chipratio.pages.dev/contact/
- Privacy: https://chipratio.pages.dev/privacy/
- Source: https://github.com/KarthikSubramanian07/ChipRatio
