# web/ — placeholder (owned by the Web/Frontend workstream)

Nothing here yet. The static site (Astro, deployed to Cloudflare Pages at siuuustats.pages.dev) will live here.

It must consume data only through the static API described in `../CONTRACTS.md` §6 (`npm run build:api` → `dist/api/v1/*.json`), never by reading `data/*.csv` directly. Show the `attribution` block from each response on any page that uses it.
