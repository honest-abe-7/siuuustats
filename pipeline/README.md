# pipeline/ — placeholder (owned by the Pipeline/Automation workstream)

Nothing here yet. Planned: GitHub Actions workflows (free tier) that run `npm run check` on every PR, refresh `data/raw` snapshots on a schedule, open PRs with new matches, and deploy `dist/` to Cloudflare Pages.

The pipeline must only write to `data/` through the ingest scripts or PRs that pass `npm run check`. See `../CONTRACTS.md` §7–8.
