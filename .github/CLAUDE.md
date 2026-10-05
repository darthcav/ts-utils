# GitHub Workflows

- `publish.yml` first runs a `verify` job without the npm OIDC token: it fails unless the tag equals
  `v` + the `package.json` version and points to a commit on `main`, then runs lint, typecheck, and
  tests. The `publish` job then installs with `--ignore-scripts`, without the npm cache, in the
  `npm` environment (add required reviewers to that environment so each publish needs approval).
- In workflows, reference actions by version tag (e.g. `actions/checkout@v7`), install with
  `npm ci --ignore-scripts`, and set `persist-credentials: false` on checkouts.
- `.github/workflows/sync-dev.yml` runs on every push to `main`: it merges `main` into `dev`
  server-side through the GitHub merges API so `dev` doesn't drift behind the release commit. It
  deliberately opens no PR, so `tests.yml` doesn't run for the sync (a PR that was merged right away
  made its `pull_request` CI run race the merge and fail); `main` was already tested on `dev`. On
  conflicts the workflow fails, and `main` has to be merged into `dev` locally.
