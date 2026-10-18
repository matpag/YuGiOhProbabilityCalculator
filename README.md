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
- Complete English, Italian, German, Spanish and French interface, including help, validation and calculation messages.
- Dark navy theme with orange accents, following the visual style of [YuGiOh Proxy Generator](https://matpag.github.io/YuGiOhProxyGenerator/).

## Development

The visual foundation is shared with the Retroformats suite and served locally from `public/retroformats/`. Keep these assets identical to the canonical `design-system/` files in the Retroformats portal. The calculator stays dark-only; probability logic and saved calculation formats are independent of the suite header.

### Retroformats handoff (2026-10-17)

Continue work in this repository on `master`. The visual alignment is committed here and published on GitHub Pages; the portal's `.local/worktrees/` directories were temporary implementation copies. The canonical kit and cross-app verification report live in the sibling `YuGiOh Retroformatsdotcom/design-system/` and `YuGiOh Retroformatsdotcom/docs/visual-alignment-verification.md`.

The suite header links to the portal and its four shortlinks. Keep the shared CSS/SVG byte-identical; put calculator-specific changes in `src/styles/global.css` and `src/styles/App.module.css`. No light theme was added. The completed checks included 18 unit tests, 12 calculator browser tests and the suite's 13 browser tests / 101 consistency checks. Use the commands below for future relevant changes.

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

## Interface languages

The language selector uses native language names. The initial choice follows a supported `ui_lang` query parameter, then the `retroformats-ui-language` browser preference, then the first supported browser language, and finally English. Blocked browser storage does not prevent using the calculator. A manual change updates `ui_lang` without reloading or discarding other query parameters and anchors. Suite links and shared calculations carry the selected language.

Versioned dictionaries live in `src/i18n/locales/`; a typed React context supplies translations, accessible labels and localized number formatting. Validation and scenario descriptions accept a pure translator. Workers return language-independent failure codes, so errors and existing notifications change language with the rest of the interface. Language is outside the calculator state and worker calculation key. Incomplete numeric edits, existing results, card/group names, scenario names, original example labels and JSON/`#v1` payloads are preserved verbatim. The combinatorial engine remains unchanged.

`npm test` checks dictionary keys/placeholders, language precedence, URL propagation, validation, state integrity and exact counts. `npm run test:e2e` includes the original English flows plus all five languages, dialog/ARIA content, preserved results and edits, storage failures, shared links and worker errors. Use `PLAYWRIGHT_CHANNEL=msedge` when running against an installed Microsoft Edge browser.

## Probability model

Every row represents distinct physical copies. Fixed groups are mutually exclusive. Flexible rows contain their own copies; their selected roles reference fixed groups without duplicating those copies in the deck.

The engine enumerates group-count distributions and weights each by the product of binomial coefficients. Successful weights are summed and divided by `C(deck size, cards drawn)`. Combinatorial counts use `BigInt`; only the final displayed probability is converted to a floating-point number. A physical hand is counted once even if multiple role assignments or OR options succeed.

In allocation mode, every flexible copy fills exactly one selected role. All lower and upper bounds apply after allocation; an unmentioned role remains an eligible destination. In membership mode, copies contribute to all selected roles simultaneously. All cards are assumed uniformly shuffled and relevant effects are assumed available. The app measures draws, not card-effect sequencing or opponent interaction.

Calculations run in a worker. A fixed operation budget reports overly complex scenarios instead of returning a partial answer. Supported inputs are deck sizes 1–100 and draw sizes 1–20, with up to 24 groups, 12 scenarios, 8 alternative openings per scenario, and 12 requirements per opening. Small-deck exhaustive enumeration is used as an independent test oracle.

## GitHub Pages

`.github/workflows/pages.yml` tests and builds every push to **master**, then deploys `dist/` to GitHub Pages. Pull requests targeting master run the same checks without deploying. Manual workflow runs are also supported.

The repository's Pages publishing source must be **GitHub Actions** (Settings → Pages → Build and deployment). Its default branch should be **master**. Vite's base path is `/YuGiOhProbabilityCalculator/`, so assets and worker URLs resolve on the project site.

Independent fan project. Yu-Gi-Oh! is a trademark of Konami.
