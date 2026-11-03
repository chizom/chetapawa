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
