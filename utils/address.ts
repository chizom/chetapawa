// Basic address sanity checks per chain: length and character class only.
// This is NOT full validation (no checksums). It catches the common mistake of
// pasting an address from the wrong chain. Shared by browser and server.

const EVM_CHAINS = new Set([
  'eth', 'base', 'arb', 'op', 'pol', 'bsc', 'avax', 'gnosis', 'bera', 'monad',
  'scroll', 'xlayer', 'plasma', 'hlevm', 'hood', 'adi'
])

const B58 = '1-9A-HJ-NP-Za-km-z'

interface Rule {
  re: RegExp
  example: string
}

const RULES: Record<string, Rule> = {
  // Named accounts (alice.near, a.b.tg) or 64-char implicit accounts.
  near: { re: /^(?=.{2,64}$)(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/, example: 'yourname.near' },
  sol: { re: new RegExp(`^[${B58}]{32,44}$`), example: 'a Solana address (32 to 44 characters)' },
  btc: { re: /^(bc1[a-z0-9]{25,87}|[13][1-9A-HJ-NP-Za-km-z]{25,34})$/, example: 'bc1... or 1... or 3...' },
  ltc: { re: /^(ltc1[a-z0-9]{25,87}|[LM3][1-9A-HJ-NP-Za-km-z]{25,34})$/, example: 'ltc1... or L... or M...' },
  doge: { re: new RegExp(`^D[${B58}]{25,34}$`), example: 'D...' },
  tron: { re: new RegExp(`^T[${B58}]{33}$`), example: 'T... (34 characters)' },
  xrp: { re: new RegExp(`^r[${B58}]{24,34}$`), example: 'r...' },
  stellar: { re: /^G[A-Z2-7]{55}$/, example: 'G... (56 characters)' },
  ton: { re: /^([A-Za-z0-9_-]{48}|-?\d:[0-9a-fA-F]{64})$/, example: 'a TON address (48 characters)' },
  sui: { re: /^0x[0-9a-fA-F]{64}$/, example: '0x followed by 64 hex characters' },
  aptos: { re: /^0x[0-9a-fA-F]{1,64}$/, example: '0x followed by up to 64 hex characters' },
  movement: { re: /^0x[0-9a-fA-F]{1,64}$/, example: '0x followed by up to 64 hex characters' },
  starknet: { re: /^0x[0-9a-fA-F]{1,64}$/, example: '0x followed by up to 64 hex characters' }
}

const EVM_RULE: Rule = { re: /^0x[0-9a-fA-F]{40}$/, example: '0x followed by 40 hex characters' }
const GENERIC_RULE: Rule = { re: /^[A-Za-z0-9:._-]{8,128}$/, example: 'an address on this chain' }

function ruleFor(chain: string): Rule {
  if (EVM_CHAINS.has(chain)) return EVM_RULE
  return RULES[chain] ?? GENERIC_RULE
}

/** Returns null when the address looks plausible, or a short human message when it does not. */
export function checkAddress(chain: string, address: string): string | null {
  const a = address.trim()
  if (!a) return 'Enter an address.'
  if (a.length > 128) return 'That address is too long.'
  const rule = ruleFor(chain)
  if (!rule.re.test(a)) return `That does not look like an address on this chain. Expected ${rule.example}.`
  return null
}

export function addressExample(chain: string): string {
  return ruleFor(chain).example
}

// Well-known burn or placeholder addresses, used only by the mock mode "Use an example address" button.
// Nothing is ever sent in mock mode. Each sample must pass checkAddress for its chain.
const SAMPLES: Record<string, string> = {
  near: 'demo-creator.near',
  sol: '11111111111111111111111111111111',
  btc: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
  tron: 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb',
  xrp: 'rrrrrrrrrrrrrrrrrrrrrhoLvTp',
  stellar: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7',
  doge: 'DDogepartyxxxxxxxxxxxxxxxxxxw1dfzr',
  ltc: 'ltc1qg42tkwuuxefutzxezdkdel39gfstuap288mfea',
  sui: '0x' + '0'.repeat(63) + '1',
  aptos: '0x1',
  movement: '0x1',
  starknet: '0x1'
}
const EVM_SAMPLE = '0x000000000000000000000000000000000000dEaD'

/** A valid-looking sample address for mock mode, or null when we have none for this chain. */
export function sampleAddress(chain: string): string | null {
  const s = EVM_CHAINS.has(chain) ? EVM_SAMPLE : SAMPLES[chain]
  return s && checkAddress(chain, s) === null ? s : null
}
