# Project instructions

- React + TypeScript + Vite static frontend; deployment branch is `master`.
- Keep `/YuGiOhProbabilityCalculator/` as the Vite base path for GitHub Pages.
- Prioritize readable requirements, accessibility, and clarity over visual complexity.
- Use the dark navy and orange visual language shared with YuGiOh Proxy Generator. Keep theme colors centralized in `src/styles/global.css`, including dark native controls and readable focus, error, and selected states.
- Keep probability logic independent of React. Use exact combinatorial counts and count each physical hand once across role assignments and OR branches.
- Document the distinction between allocating each flexible copy to one role and counting it toward all selected roles.
- Preserve incomplete numeric edits. Invalid input must never display stale probabilities.
- `docs/` is intentionally ignored. Use it for local notes, reasoning, and memory; do not force-add it.
- Verification: `npm test`, `npm run build`, and `npm run test:e2e` for meaningful behavior changes. CI runs them before deployment.
- Never commit credentials, build artifacts, browser screenshots, or dependency directories.
