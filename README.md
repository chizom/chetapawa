# Chetapawa

Work in progress. The full README is written in the final build step.

## Decisions

- Database tables use a `cz_` prefix: `cz_creators`, `cz_goals`, `cz_tips`.
- Built on Nuxt 3 (3.21.x) as the brief requires, even though Nuxt 4 is the current major version.
- Server secrets (`SUPABASE_SERVICE_ROLE_KEY`, `ONE_CLICK_JWT`) are read from `process.env` at runtime in `server/utils/env.ts`, not through `nuxt.config.ts`, so they are never baked into build output. Verified with a canary value and a grep of `.output`.
- `cz_creators.manage_token_hash` is hidden from the browser with column-level grants, not a view. Browser code must select named columns from `cz_creators`. `select *` is denied for the anon role.
- One active goal per creator is enforced in the database with a partial unique index.
- `cz_goal_progress` is a `security_invoker` view (needs Postgres 15+, which Supabase uses). It returns `raised_usd` (sum of `amount_out_usd`) and `raised_out` (sum of `amount_out` in the receive asset's raw units) for successful tips, so the app can pick either for goal math.
- `cz_tips.goal_id` uses `on delete set null`, so deleting a goal keeps its tip history.
- Coral (`#FF6B4A`) is used for fills with charcoal text. Primary text buttons use rust (`#B44226`) with white text so they pass WCAG AA contrast.
