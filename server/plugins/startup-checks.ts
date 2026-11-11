// Loud startup logs so nobody mistakes mock mode or local storage for the real setup.
export default defineNitroPlugin(() => {
  const bar = '!'.repeat(72)
  if (isMockMode()) {
    console.warn(`\n${bar}\n!!  MOCK mode is ON. Tokens, quotes, deposit addresses and statuses are FAKE.\n!!  No real swaps happen. Do not send real funds to any address shown.\n!!  Set MOCK_INTENTS=false to use the real NEAR Intents 1Click API.\n${bar}\n`)
  } else {
    console.info('[intents] Real mode: quotes and deposit addresses come from the NEAR Intents 1Click API.')
  }
  if (isLocalStore()) {
    console.warn(`[db] Supabase keys not set. Using the local store at ${LOCAL_DB_FILE}. Realtime is off, the overlay polls instead.`)
    if (process.env.NODE_ENV === 'production') {
      console.warn('[db] Local store in production: data is lost if the host wipes its disk. Set the Supabase keys for a real deployment.')
    }
  }
})
