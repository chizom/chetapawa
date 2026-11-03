// Loud startup log so nobody mistakes mock mode for real payments.
export default defineNitroPlugin(() => {
  if (isMockMode()) {
    const bar = '!'.repeat(72)
    console.warn(`\n${bar}\n!!  MOCK_INTENTS is ON. Tokens, quotes, deposit addresses and statuses are FAKE.\n!!  No real swaps happen. Do not send real funds to any address shown.\n${bar}\n`)
  }
})
