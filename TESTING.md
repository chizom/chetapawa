# Testing

Manual test steps. Test the tip page at 375px wide (browser dev tools, phone size) as well as desktop.

## A. Mock mode, no keys (anyone can run this)

Start from a clean clone with no `.env` file:

```bash
npm install
npm run dev
```

Expected: the server log shows the "MOCK mode is ON" banner and "Supabase keys not set. Using the local store". Every page has a yellow MOCK bar.

1. **Create a page.** Go to `/create`. Enter handle `demo_one`, display name `Demo One`. Keep NEAR and USDC. Click **Use an example address**, then **Create my page**.
   - Expect: "Your page is live", a tip link and a manage token starting with `cgt_`.
   - Try the same handle again in a new tab: expect "That handle is taken."
2. **Dashboard.** Tick "I saved my manage token" and click **Go to dashboard**.
   - Expect: the token is filled in and the dashboard opens. No tips yet.
   - Click **Lock**, then enter a wrong token: expect "That manage token is not valid for this page."
3. **Goal.** Unlock again. Create a goal "New mic" with target `10`.
   - Expect: the goal bar at 0%. Open `/demo_one`: the same goal shows there.
4. **Overlay.** Open the overlay link from the dashboard in another tab (in OBS, add it as a Browser Source).
   - Expect: a transparent page with the goal bar and a small MOCK pill.
5. **Tip.** On `/demo_one`, pick SOL on Solana, tap **$5**, click **Use an example address**, add a name and message, click **Get deposit address**.
   - Expect: a deposit address starting with `mock_`, a QR code, a countdown and copy buttons.
   - Within about 20 seconds: Waiting, then Processing, then "Delivered. Thank you!".
   - The overlay plays an alert with the name and message, and the goal bar moves to about 50%.
   - The dashboard lists the tip as success.
6. **Goal complete.** Send another $5 tip. Expect the overlay to play the goal celebration once.
7. **Refund path.** Send a tip with amount `2.13` (any amount ending in 13). Expect it to end as "Your tip was refunded".
8. **Reload safety.** Start a tip and reload the page while it is waiting. Expect the same deposit address to come back.
9. **Cancel.** While waiting, click **Cancel and start over**. Expect a confirmation first.
10. **Errors.** Visit `/nobody_here`: expect "No tip page here". Enter amount `abc`: expect "Enter a positive number like 1.5". Enter a refund address from another chain: expect a clear address error.
11. **Demo overlay.** Open `/overlay/demo_one?demo=1`. Expect fake alerts labeled "Demo alerts", and nothing written to the data file.
12. **Persistence.** Stop and restart `npm run dev`. Expect the page, goal and tips to still be there (`.data/local-db.json`).

## B. Real mode, no money

```bash
MOCK_INTENTS=false npm run dev
```

1. `/create`: the token list is the live 1Click list (more than 200 tokens).
2. Create a page with a NEAR account that does not exist (for example `no-such-account-xyz123.near`). Expect: "NEAR Intents cannot pay this account."
3. Create a page with an existing NEAR account you own. Expect success.
4. On its tip page, type an amount. Expect a live estimate from a dry quote. No deposit address is created.

## C. Real mode, one small funded swap (optional, real money)

There is no Intents testnet. Only do this with an amount you can afford to lose (a few dollars).

1. Use a real creator page from B.3 with the creator's own payout address.
2. From a wallet you control on another chain, start a tip of a few dollars. Enter your own refund address on that chain.
3. Send exactly the amount shown to the deposit address before the countdown ends.
4. Expect: Processing within a minute or two, then Delivered, with deposit and delivery transaction links.
5. Check the creator's wallet received the token. Check the goal bar and the overlay updated.
6. Record the date, route, amounts and both transaction hashes, and add them to the README under "Verified real swap".

## D. Before publishing

- `npm run build` succeeds.
- Secrets scan: `git ls-files | xargs grep -nE "eyJ[A-Za-z0-9_-]{20,}|sb_secret_[A-Za-z0-9_]{8,}|sk_live|service_role\"?\s*[:=]\s*\"?ey"` finds nothing, and `.env` is not tracked (`git ls-files .env` prints nothing).
- After a build, the service role key value does not appear in `.output` (`grep -rlF "<your key>" .output` prints nothing).
