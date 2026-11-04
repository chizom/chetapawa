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
- All 1Click calls live in `server/utils/intents.ts`, built on the official SDK `@defuse-protocol/one-click-sdk-typescript`. Field names were taken from the OpenAPI spec and checked against the live API (dry quotes and one unfunded real quote) on 2026-11-03.
- Swaps use `EXACT_INPUT`, `depositType: ORIGIN_CHAIN`, `recipientType: DESTINATION_CHAIN` and 1% slippage. The recipient is always the creator's own payout address.
- Refunds: 1Click requires `refundTo` and checks it against the refund chain's address format. Real quotes refund to the fan's own address on the chain they pay from (`refundType: ORIGIN_CHAIN`), so the tip form asks the fan for it. Dry previews run before the fan has typed anything, so they use a placeholder NEAR Intents account. A dry quote creates no deposit address, so nothing can ever be sent there.
- Stellar requires `depositMode: MEMO` (confirmed on the live API). Other chains use `SIMPLE`. If 1Click rejects the deposit mode for any other chain, the wrapper retries once with the other mode.
- We request a 30 minute deadline (2 hours for slow chains like BTC). 1Click may return a later one, and the deadline it returns is the one shown to fans.
- Status mapping: `PENDING_DEPOSIT` and `INCOMPLETE_DEPOSIT` become `pending`; `KNOWN_DEPOSIT_TX` and `PROCESSING` become `processing`; `SUCCESS`, `REFUNDED` and `FAILED` map to `success`, `refunded` and `failed`. `expired` is our own status for an unfunded quote past its deadline.
- `ONE_CLICK_JWT` is optional. Without it, 1Click adds a 0.25% fee to every quote. The SDK sends it as a Bearer token, which the docs accept.
- 1Click's error messages are rewritten for fans. For example, minimum amounts are shown in token units instead of base units.
- Mock mode needs `MOCK_INTENTS=true`. When `NODE_ENV=production` it also needs `MOCK_INTENTS_ALLOW_PRODUCTION=true`, otherwise it is ignored with a logged error. When active, the server logs a loud banner and every page shows a yellow "MOCK" badge.
- Mock status moves pending, then processing, then success over about 20 seconds. Mock tips whose amount ends in "13" (like 2.13) end as `refunded`, so the failure UI can be tested.
- Creator handles: 3 to 24 characters `a-z 0-9 _`, a leading `@` is stripped, and route words like `create`, `overlay` and `api` are reserved.
- Payout address checks are length and character-class only, per chain (NEAR account, EVM `0x` + 40 hex, Solana base58, BTC, Tron, Stellar, XRP, TON and so on). They catch addresses pasted from the wrong chain but do not verify checksums. The UI warns clearly that the address must be on the chosen chain.
- The server never trusts the token symbol or chain sent by the browser. It looks up `destAssetId` in the 1Click token list and stores the symbol and chain from there.
- Manage tokens are `cgt_` plus 32 random bytes (base64url). Only the sha256 hash is stored, and checks use a constant-time compare. After creation the raw token is also saved in the creator's own browser `localStorage` so the dashboard can fill it in, but the creator must still confirm they saved it before continuing.
- Creating a page is rate limited to 5 per IP per 10 minutes, in memory. The IP comes from `x-forwarded-for`, which the hosting platform sets. The limiter resets on server restarts, which is acceptable for a demo.
- In mock mode a full-width yellow strip sits above the header on every page, so it never covers content. The OBS overlay uses a small corner pill instead.
- Coral (`#FF6B4A`) is used for fills with charcoal text. Primary text buttons use rust (`#B44226`) with white text so they pass WCAG AA contrast.
- `cz_tips` has four columns beyond the brief's data model: `amount_in_formatted` and `amount_out_formatted` (human units, so the overlay and dashboard never need token decimals), `quote_out_usd` (the quote's USD estimate) and `expires_at` (the deposit deadline 1Click returns). `schema.sql` adds them with `add column if not exists`, so re-running it upgrades older databases.
- Goal math: progress is the sum of `amount_out_usd` over successful tips tied to the goal. `amount_out_usd` comes from 1Click's status response. If 1Click does not report it, we store the quote's USD estimate instead, as the brief allows. When a success pushes a goal past its target, `completed_at` is stamped once so the overlay celebrates once.
- A tip is tied to the creator's goal that was active when the fan requested the deposit address.
- Tip statuses only move forward (pending, then processing, then a final state). Updates are conditional on the previous status, so two pollers can never overwrite each other. Each tip's live 1Click check is reused for 3 seconds.
- `expired` is set when a tip is still waiting for its deposit after the 1Click deadline. Expired tips are still re-checked for 48 hours, so a late deposit shows up as refunded (or processed) instead of disappearing.
- The fan's refund address is sent to 1Click but never stored in our database.
- The tip page remembers the fan's open tip in `localStorage` (`cgt_tip_<handle>`), so a reload never loses the deposit address. "Start a new tip" clears it.
- The receive estimate uses a dry quote, debounced by 600 ms. Quick-amount buttons ($1, $2, $5) use the token list's USD price and round to 3 significant figures.
- The QR code holds only the deposit address, which every wallet can scan. Amount and memo are shown with their own copy buttons. Memo chains (Stellar) show a red "memo required" warning.
- The optional "Already sent? Speed it up" box forwards a transaction hash to 1Click's `POST /v0/deposit/submit`.
- Rate limits per IP: previews 60 per minute, deposit addresses 10 per 10 minutes (and 60 per 10 minutes per creator), status checks 120 per minute, tx hash submits 10 per 10 minutes.
- Name and message are trimmed, control characters removed, and capped at 40 and 140 characters. They are rendered as text, never as HTML.
- Creator write routes take the raw manage token in the `x-manage-token` header. `POST /api/goals` names the creator by `handle`. `PATCH /api/goals/[id]` checks the token against the goal's owner, so one creator's token can never change another creator's goal.
- After 10 bad manage tokens from one IP in 10 minutes, that IP gets 429 for the rest of the window. Correct tokens are not counted. Tokens are 256 random bits, so this is about noise, not guessing.
- The dashboard reads its data from `GET /api/creators/[handle]/dashboard` (manage token required) rather than straight from Supabase, so the page never needs extra database permissions.
- Starting a goal ends the previous active one first. If two requests race, the unique index rejects one insert and the route retries once.
- Goal targets are US dollars, $1 to $1,000,000, rounded to cents. Ended goals cannot be edited; start a new one instead.
- Editing a target can complete a goal (new target at or below what is raised) or reopen a completed one (new target above what is raised), so the bar always matches the numbers.
- "End goal" uses an inline "Yes, end it" confirmation instead of a browser dialog.
- The dashboard refreshes every 8 seconds while the tab is visible, and pauses while the goal form is open. A saved goal shows immediately, and a refresh that started before a save is ignored, so stale data never overwrites a change.
- "Remember on this device" keeps the manage token in `localStorage` under `cgt_manage_<handle>`. "Lock" removes it. A stored token that stops working is removed automatically.
- While a tip is processing, "Send another tip" is disabled so the fan cannot lose the status tracker mid-swap. While waiting for the deposit, "Cancel and start over" asks for confirmation first, in case funds are already on the way.
