# Opening Hand

A static Yu-Gi-Oh! probability calculator focused on readable requirements and exact draw probabilities.

**[Use the calculator](https://matpag.github.io/YuGiOhProbabilityCalculator/)** · **[GitHub repository](https://github.com/matpag/YuGiOhProbabilityCalculator)**

## Features

- Individual cards or aggregate groups, with remaining deck cards counted automatically.
- At least, exactly, at most, and between requirements, joined with AND.
- Alternative openings joined with OR, counting overlapping hands once.
- Flexible cards that fill one chosen role per copy, or explicitly count toward all selected roles.
- Named scenarios and independent comparisons against the same deck.
- Browser-local persistence, shareable links, and JSON import/export.
- Responsive layout, keyboard controls, and clear input validation.

## Development

Requires Node.js 22.12 or newer (CI uses Node 24).

```sh
npm ci
npm run dev
```

Vite serves the app at `/YuGiOhProbabilityCalculator/`. To verify the production build:

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

`npm run preview` serves the production build locally. `docs/` is ignored by Git and is available for local development notes and memory.

## Probability model

Every row represents distinct physical copies. Fixed groups are mutually exclusive. Flexible rows contain their own copies; their selected roles reference fixed groups without duplicating those copies in the deck.

The engine enumerates group-count distributions and weights each by the product of binomial coefficients. Successful weights are summed and divided by `C(deck size, cards drawn)`. Combinatorial counts use `BigInt`; only the final displayed probability is converted to a floating-point number. A physical hand is counted once even if multiple role assignments or OR options succeed.

In allocation mode, every flexible copy fills exactly one selected role. All lower and upper bounds apply after allocation; an unmentioned role remains an eligible destination. In membership mode, copies contribute to all selected roles simultaneously. All cards are assumed uniformly shuffled and relevant effects are assumed available. The app measures draws, not card-effect sequencing or opponent interaction.

Calculations run in a worker. A fixed operation budget reports overly complex scenarios instead of returning a partial answer. Supported inputs are deck sizes 1–100 and draw sizes 1–20, with up to 24 groups, 12 scenarios, 8 alternative openings per scenario, and 12 requirements per opening. Small-deck exhaustive enumeration is used as an independent test oracle.

## GitHub Pages

`.github/workflows/pages.yml` tests and builds every push to **master**, then deploys `dist/` to GitHub Pages. Pull requests targeting master run the same checks without deploying. Manual workflow runs are also supported.

The repository's Pages publishing source must be **GitHub Actions** (Settings → Pages → Build and deployment). Its default branch should be **master**. Vite's base path is `/YuGiOhProbabilityCalculator/`, so assets and worker URLs resolve on the project site.

Independent fan project. Yu-Gi-Oh! is a trademark of Konami.
