// Friendly names for 1Click blockchain codes. Unknown codes fall back to upper case.
// Shared by browser and server.

const CHAIN_NAMES: Record<string, string> = {
  near: 'NEAR',
  eth: 'Ethereum',
  base: 'Base',
  arb: 'Arbitrum',
  op: 'Optimism',
  pol: 'Polygon',
  bsc: 'BNB Chain',
  avax: 'Avalanche',
  gnosis: 'Gnosis',
  bera: 'Berachain',
  sol: 'Solana',
  btc: 'Bitcoin',
  ltc: 'Litecoin',
  doge: 'Dogecoin',
  bch: 'Bitcoin Cash',
  zec: 'Zcash',
  dash: 'Dash',
  xrp: 'XRP Ledger',
  ton: 'TON',
  tron: 'Tron',
  sui: 'Sui',
  aptos: 'Aptos',
  stellar: 'Stellar',
  cardano: 'Cardano',
  starknet: 'Starknet',
  monad: 'Monad',
  scroll: 'Scroll',
  xlayer: 'X Layer',
  movement: 'Movement',
  plasma: 'Plasma'
}

export function chainName(code: string): string {
  return CHAIN_NAMES[code] ?? code.toUpperCase()
}

/** Popular chains first in pickers, the rest alphabetical by name. */
const CHAIN_ORDER = ['near', 'eth', 'base', 'arb', 'sol', 'btc', 'op', 'pol', 'bsc', 'tron', 'ton', 'xrp', 'stellar']

export function sortChains(codes: string[]): string[] {
  return [...new Set(codes)].sort((a, b) => {
    const ia = CHAIN_ORDER.indexOf(a)
    const ib = CHAIN_ORDER.indexOf(b)
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    return chainName(a).localeCompare(chainName(b))
  })
}
