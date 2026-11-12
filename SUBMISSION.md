# Submission

Deadline: **Nov 14, 2026, 23:59 UTC.** One submission per project, and it cannot be edited afterwards (changes go through https://nearhackathon.com/request-changes). Re-read https://nearhackathon.com/HACKATHON.md right before submitting, since rules may change.

## Final check order (do these in order, submit last)

- [ ] README accurate: every claim matches the code. Real mode status is stated plainly. Demo and site links filled in.
- [ ] App runs from a clean clone with no keys: `git clone`, `npm install`, `npm run dev`, then walk through TESTING.md section A.
- [ ] Secrets scan clean (TESTING.md section D). `.env` is not tracked. Only `.env.example` is committed.
- [ ] Repo is public on GitHub and LICENSE (MIT) is present.
- [ ] Deployed URL works on a phone (optional, a hosted demo is a plus). If there is no hosted demo, the X post **must have a video**: the rules say screenshots are not enough when judges cannot open the demo.
- [ ] Demo video recorded (60 to 90 seconds).
- [ ] X post published (you post it yourself).
- [ ] Submission form filled and sent once.

## Demo video plan (60 to 90 seconds)

1. Problem in one line: fans hold tokens on other chains, creators want one token in their own wallet.
2. Create a page (handle, payout address, receive token). Show the manage token step.
3. Set a goal on the dashboard. Show the OBS overlay next to it.
4. From the fan side, pick a token on another chain, show the estimate, get the deposit address and QR.
5. Show the status moving to Delivered, the overlay alert and the goal bar moving.
6. One line on NEAR's role: the NEAR Intents 1Click API quotes, swaps, bridges and settles to the creator's own address. We never hold funds.

If the video uses mock mode, keep the yellow MOCK bar visible and say so. If you run a real swap, show the transaction link.

## X post (paste)

Pick the version that matches what the video shows.

**If the video shows mock mode:**

```
We built Chetapawa at NEAR HACKATHON #NEARHackathon

Fans tip in any token on any chain. Creators get the token they chose in their own wallet plus a live overlay.

Powered by @NEARProtocol Intents (1Click API). No custody.

Mock-mode demo. Repo: <repo link>
```

**If the video shows a real funded swap:**

```
We built Chetapawa at NEAR HACKATHON #NEARHackathon

Fans tip in any token on any chain. Creators get the token they chose in their own wallet, and a stream overlay cheers.

Powered by @NEARProtocol Intents (1Click API). No custody.

Repo: <repo link>
```

X counts each link as 23 characters. Both versions fit in 280 with the repo link. Optional extra tags from the rules: @NearLegion @NearBuilders. Attach the demo video (or screenshots only if there is also a hosted demo).

## "What did you build?" description (paste, 20 to 2000 characters)

```
Chetapawa is a tip page for creators and streamers that accepts almost any token on any chain and pays the creator in the one token they chose, straight to their own wallet.

Problem: a creator who wants crypto tips has to pick one chain and token, but fans hold something else somewhere else. Most give up, or the tip jar holds the money in a custodial account.

How it works: a creator makes a page in a minute with a handle, a payout address and the token they want. No account or email. A fan picks any supported token, types an amount and gets a one-time deposit address with a QR code. The page shows live status until the tip is delivered. The creator gets a dashboard with funding goals and an OBS browser-source overlay that plays alerts and fills a goal bar in real time.

NEAR's role: every payment runs through the NEAR Intents 1Click API. We use GET /v0/tokens for the token list, dry quotes for live estimates and to check that a payout address can be paid, real quotes to create one-time deposit addresses whose recipient is always the creator's own address and whose refund address is the fan's own, GET /v0/status to track each tip, and POST /v0/deposit/submit to speed up detection. NEAR Intents does the swap, the bridge and the settlement. The app never holds funds and runs no contract or wallet of its own.

Implementation: Nuxt 3 and TypeScript, server routes validated with zod, Supabase for storage and realtime, with a local file store and a mock mode so the repo runs with npm install and npm run dev and no keys. Real mode is wired and tested with live dry quotes. See the README for exactly what was verified.
```

Character count: 1638. Recount after any edit. If you run a funded swap, change the last sentence to say so.

## Form fields

| Field | Value |
| --- | --- |
| Project name | Chetapawa |
| Team lead | _(your name)_ |
| Email address | _(your email)_ |
| Team size | Solo builder |
| Tracks | Real-World Money, Open Innovation |
| NEAR wallet address | _(your own mainnet NEAR account, lowercase. Prize is sent here.)_ |
| Repository link | _(public GitHub URL)_ |
| Demo post link | _(your X post URL)_ |
| What did you build? | The description above |
| Website | **Leave empty.** See note below. |
| Consent checkbox | Tick it only if you agree to the contact notice. |

Note on Website: the form shows a Website field, but HACKATHON.md says the `website` field in the submission API is a spam trap and any non-empty value rejects the submission. Leave it empty. Put the live site link in the README and the X post instead.

Note on other projects: the rules allow one person in at most 2 independent projects, and each README must name the other one. If you entered another project, add it to the README.
