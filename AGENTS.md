# Project instructions

- React + TypeScript + Vite static frontend; deployment branch is `master`.
- Keep `/YuGiOhProbabilityCalculator/` as the Vite base path for GitHub Pages.
- Prioritize readable requirements, accessibility, and clarity over visual complexity.
- This app is the visual reference for the Retroformats suite. The shared CSS and mark in `public/retroformats/` must match the canonical files in the sibling portal workspace's `design-system/`. Keep app-specific aliases in `src/styles/global.css` and layout in `src/styles/App.module.css`; preserve readable focus, error, and selected states.
- Keep this app dark-only. The light-theme extension was explicitly deferred on 2026-10-17.
- Read the Retroformats handoff in `README.md` before changing suite styling. Work from this repository's current `master`; the portal's `.local/worktrees/` copies were implementation sandboxes.
- Keep probability logic independent of React. Use exact combinatorial counts and count each physical hand once across role assignments and OR branches.
- Document the distinction between allocating each flexible copy to one role and counting it toward all selected roles.
- Preserve incomplete numeric edits. Invalid input must never display stale probabilities.
- `docs/` is intentionally ignored. Use it for local notes, reasoning, and memory; do not force-add it.
- Verification: `npm test`, `npm run build`, and `npm run test:e2e` for meaningful behavior changes. CI runs them before deployment.
- Never commit credentials, build artifacts, browser screenshots, or dependency directories.
- UI languages are EN/IT/DE/ES/FR through typed dictionaries and React context in `src/i18n/`; never translate by mutating rendered DOM text.
- Language precedence is valid `ui_lang` > valid `retroformats-ui-language` storage > first supported browser preference > English. Manual changes replace the URL query while preserving other parameters/hash; suite and share links carry the selected language. Catch unavailable storage.
- Keep language outside calculator state, worker keys and JSON/hash v1 schemas. Preserve entered names, original stored/default/example labels, incomplete numeric strings and exact counts. Localize UI descriptions, validation, notifications and worker failure codes without changing the combinatorial engine.
- Keep all five dictionary keys and placeholders complete. Run the localization unit and browser coverage alongside the existing English tests when changing interface text or language behavior.
