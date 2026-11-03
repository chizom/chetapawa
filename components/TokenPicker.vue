<template>
  <div class="token-picker">
    <div class="field">
      <label :for="`${idPrefix}-chain`">{{ chainLabel }}</label>
      <select :id="`${idPrefix}-chain`" class="select" :value="chain" :disabled="disabled || !tokens.length" @change="onChain">
        <option v-for="c in chains" :key="c" :value="c">{{ chainName(c) }}</option>
      </select>
    </div>
    <div class="field">
      <label :for="`${idPrefix}-token`">{{ tokenLabel }}</label>
      <select :id="`${idPrefix}-token`" class="select" :value="modelValue" :disabled="disabled || !chainTokens.length" @change="onToken">
        <option v-for="t in chainTokens" :key="t.assetId" :value="t.assetId">
          {{ t.symbol }}{{ duplicateSymbols.has(t.symbol) ? ` (${shortId(t)})` : '' }}
        </option>
      </select>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue'
import type { TokenInfo } from '~~/types/api'
import { chainName, sortChains } from '~~/utils/chains'

export default defineComponent({
  name: 'TokenPicker',
  props: {
    tokens: { type: Array as PropType<TokenInfo[]>, required: true },
    /** Selected assetId. */
    modelValue: { type: String, default: '' },
    idPrefix: { type: String, required: true },
    chainLabel: { type: String, default: 'Chain' },
    tokenLabel: { type: String, default: 'Token' },
    disabled: { type: Boolean, default: false }
  },
  emits: ['update:modelValue'],
  data() {
    return { chain: '' }
  },
  computed: {
    chains(): string[] {
      return sortChains(this.tokens.map((t) => t.chain))
    },
    chainTokens(): TokenInfo[] {
      const list = this.tokens.filter((t) => t.chain === this.chain)
      // Stablecoins and native tokens first, then alphabetical.
      const rank = (s: string) => (['USDC', 'USDT'].includes(s) ? 0 : ['ETH', 'NEAR', 'wNEAR', 'SOL', 'BTC'].includes(s) ? 1 : 2)
      return list.sort((a, b) => rank(a.symbol) - rank(b.symbol) || a.symbol.localeCompare(b.symbol))
    },
    duplicateSymbols(): Set<string> {
      const seen = new Set<string>()
      const dup = new Set<string>()
      for (const t of this.chainTokens) (seen.has(t.symbol) ? dup : seen).add(t.symbol)
      return dup
    }
  },
  watch: {
    modelValue: { immediate: true, handler: 'syncChain' },
    tokens: 'syncChain'
  },
  methods: {
    chainName,
    shortId(t: TokenInfo): string {
      const id = t.contractAddress || t.assetId
      return id.length > 14 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id
    },
    syncChain() {
      const selected = this.tokens.find((t) => t.assetId === this.modelValue)
      if (selected) this.chain = selected.chain
      else if (!this.chain && this.chains.length) this.chain = this.chains[0] as string
    },
    onChain(e: Event) {
      this.chain = (e.target as HTMLSelectElement).value
      const first = this.chainTokens[0]
      this.$emit('update:modelValue', first ? first.assetId : '')
    },
    onToken(e: Event) {
      this.$emit('update:modelValue', (e.target as HTMLSelectElement).value)
    }
  }
})
</script>

<style scoped>
.token-picker { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.token-picker .field { margin-bottom: 0; }
</style>
