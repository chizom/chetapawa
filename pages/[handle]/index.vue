<template>
  <div class="container narrow">
    <!-- Not found -->
    <section v-if="loadError" class="card center" aria-labelledby="nf-title">
      <h1 id="nf-title">{{ loadError.status === 404 ? 'No tip page here' : 'Could not load this page' }}</h1>
      <p class="muted">
        <template v-if="loadError.status === 404">There is no creator at <span class="mono">/{{ handle }}</span> yet.</template>
        <template v-else>Please refresh in a moment.</template>
      </p>
      <NuxtLink v-if="loadError.status === 404" to="/create" class="btn btn-primary">Claim this handle</NuxtLink>
    </section>

    <template v-else-if="creator">
      <!-- Creator header -->
      <header class="creator">
        <div class="avatar" aria-hidden="true">{{ initial }}</div>
        <div class="who">
          <h1>{{ creator.displayName }}</h1>
          <p class="muted handle">@{{ creator.handle }}</p>
        </div>
      </header>
      <p v-if="creator.bio" class="bio">{{ creator.bio }}</p>
      <p class="receives muted">
        Receives <strong>{{ creator.destAssetSymbol }}</strong> on {{ chainName(creator.destChain) }}.
        Tips go straight to their wallet.
      </p>

      <div v-if="goal" class="card goal-card">
        <GoalBar :goal="goal" />
      </div>

      <p v-if="!flags.mock" class="notice notice-warn demo" role="note">
        <strong>Hackathon demo. Use small amounts.</strong> There is no testnet for NEAR Intents, so tips are real.
      </p>

      <!-- Step 2: deposit and status -->
      <section v-if="tip" class="card" aria-labelledby="deposit-title">
        <h2 id="deposit-title" class="sr-only">Your tip</h2>
        <TipStepper :status="tip.status" />

        <!-- Waiting for deposit -->
        <div v-if="tip.status === 'pending' && !isExpired" class="deposit">
          <p class="instruction">
            Send exactly <strong>{{ tip.amountIn }} {{ tip.originSymbol }}</strong> on
            <strong>{{ chainName(tip.originChain) }}</strong> to this address.
          </p>

          <div class="qr-row">
            <QrCode :value="tip.depositAddress" :size="196" :label="`QR code for deposit address ${tip.depositAddress}`" />
          </div>

          <dl class="kv">
            <div>
              <dt>Amount</dt>
              <dd>
                <span class="mono">{{ tip.amountIn }}</span> {{ tip.originSymbol }}
                <CopyButton :value="tip.amountIn" label="Copy" aria-label="Copy amount" />
              </dd>
            </div>
            <div>
              <dt>Deposit address</dt>
              <dd>
                <span class="mono addr">{{ tip.depositAddress }}</span>
                <CopyButton :value="tip.depositAddress" label="Copy" aria-label="Copy deposit address" />
              </dd>
            </div>
            <div v-if="tip.depositMemo">
              <dt>Memo (required)</dt>
              <dd>
                <span class="mono">{{ tip.depositMemo }}</span>
                <CopyButton :value="tip.depositMemo" label="Copy" aria-label="Copy memo" />
              </dd>
            </div>
          </dl>

          <p v-if="tip.depositMemo" class="notice notice-danger">
            Your wallet must include this memo. A deposit without it can be lost.
          </p>

          <p class="countdown" :class="{ soon: msLeft < 5 * 60_000 }">
            Address expires in <strong>{{ countdown }}</strong>
          </p>
          <p class="muted small">
            Only send {{ tip.originSymbol }} on {{ chainName(tip.originChain) }}. This address is used for this tip only.
            {{ creatorFirstName }} receives about
            <strong>{{ tip.amountOut }} {{ tip.destSymbol }}</strong><template v-if="tip.amountOutUsd"> ({{ usd(tip.amountOutUsd) }})</template>.
          </p>

          <details class="speedup">
            <summary>Already sent? Speed it up</summary>
            <form class="speedup-form" @submit.prevent="submitTxHash">
              <div class="field">
                <label for="txHash">Your transaction hash</label>
                <input id="txHash" v-model="txHash" class="input mono" autocomplete="off" spellcheck="false" maxlength="200">
                <span class="hint">Optional. It helps the network notice your deposit sooner.</span>
                <span v-if="txError" class="error" role="alert">{{ txError }}</span>
                <span v-if="txSent" class="hint" role="status">Thanks. We passed it on.</span>
              </div>
              <button class="btn btn-ghost btn-sm" type="submit" :disabled="txSubmitting || txHash.trim().length < 8">
                {{ txSubmitting ? 'Sending…' : 'Submit hash' }}
              </button>
            </form>
          </details>
        </div>

        <!-- Expired -->
        <div v-else-if="tip.status === 'expired' || (tip.status === 'pending' && isExpired)" class="result">
          <h3>This deposit address has expired</h3>
          <p>Do not send anything to it. Start a new tip to get a fresh address.</p>
          <p class="muted small">If you already sent funds, they are refunded to your refund address automatically.</p>
        </div>

        <!-- Processing -->
        <div v-else-if="tip.status === 'processing'" class="result">
          <h3>Deposit received</h3>
          <p>
            Swapping your {{ tip.amountIn }} {{ tip.originSymbol }} into {{ tip.destSymbol }} for {{ creatorFirstName }}.
            This usually takes under a minute or two. You can close this page; it still completes.
          </p>
        </div>

        <!-- Success -->
        <div v-else-if="tip.status === 'success'" class="result ok">
          <h3>Delivered. Thank you!</h3>
          <p>
            {{ creatorFirstName }} received
            <strong>{{ tip.amountOut }} {{ tip.destSymbol }}</strong><template v-if="tip.amountOutUsd"> ({{ usd(tip.amountOutUsd) }})</template>
            on {{ chainName(tip.destChain) }}.
          </p>
          <ul v-if="txLinks.length" class="txs">
            <li v-for="t in txLinks" :key="t.hash">
              <a v-if="t.explorerUrl" :href="t.explorerUrl" target="_blank" rel="noopener noreferrer">{{ t.label }} transaction</a>
              <span v-else class="muted">{{ t.label }}: <span class="mono">{{ short(t.hash) }}</span></span>
            </li>
          </ul>
        </div>

        <!-- Refunded -->
        <div v-else-if="tip.status === 'refunded'" class="result bad">
          <h3>Your tip was refunded</h3>
          <p>
            The swap could not complete, so your
            <template v-if="live && live.refundedAmount">{{ live.refundedAmount }} {{ tip.originSymbol }}</template>
            <template v-else>funds</template>
            went back to your refund address. Nothing was lost except network fees.
          </p>
          <p class="muted small">Common causes: the deposit was too small, arrived after the deadline, or the price moved too much.</p>
        </div>

        <!-- Failed -->
        <div v-else-if="tip.status === 'failed'" class="result bad">
          <h3>Something went wrong</h3>
          <p>The swap failed. Funds that cannot be delivered are returned to your refund address.</p>
        </div>

        <p v-if="pollError" class="muted small" role="status">{{ pollError }}</p>

        <div class="actions">
          <!-- In flight: keep the fan on this tip until it finishes, so the status is never lost. -->
          <template v-if="tip.status === 'processing'">
            <button class="btn btn-primary" type="button" disabled aria-describedby="another-hint">Send another tip</button>
            <p id="another-hint" class="muted small hint-center">You can send another tip once this one is delivered.</p>
          </template>

          <!-- Waiting for deposit: allow cancelling, but confirm first in case funds are already on the way. -->
          <template v-else-if="tip.status === 'pending' && !isExpired">
            <div v-if="confirmCancel" class="confirm" role="group" aria-label="Confirm cancel">
              <p class="small">Only cancel if you have <strong>not</strong> sent anything yet. If you already sent funds, keep this page open.</p>
              <div class="confirm-row">
                <button class="btn btn-primary btn-sm" type="button" @click="startOver">Yes, cancel</button>
                <button class="btn btn-ghost btn-sm" type="button" @click="confirmCancel = false">Keep waiting</button>
              </div>
            </div>
            <button v-else class="btn btn-ghost btn-sm" type="button" @click="confirmCancel = true">Cancel and start over</button>
          </template>

          <!-- Finished (delivered, refunded, failed or expired). -->
          <button v-else class="btn btn-primary" type="button" @click="startOver">
            {{ tip.status === 'success' ? 'Send another tip' : 'Start a new tip' }}
          </button>
        </div>
      </section>

      <!-- Step 1: tip form -->
      <section v-else aria-labelledby="tip-title">
        <form class="card" novalidate @submit.prevent="getDepositAddress">
          <h2 id="tip-title">Send a tip</h2>

          <div v-if="tokensLoading" class="skeleton" style="height: 120px" role="status" aria-label="Loading tokens" />
          <div v-else-if="tokensError" class="notice notice-danger" role="alert">
            {{ tokensError }} <button class="btn btn-ghost btn-sm" type="button" @click="loadTokens">Retry</button>
          </div>
          <TokenPicker
            v-else
            v-model="form.originAssetId"
            :tokens="tokens"
            id-prefix="origin"
            chain-label="Pay from chain"
            token-label="Token"
          />

          <div class="field">
            <label for="amount">Amount</label>
            <div class="amount-input">
              <input
                id="amount"
                v-model="form.amount"
                class="input"
                inputmode="decimal"
                autocomplete="off"
                placeholder="0.00"
                :aria-invalid="!!amountError"
                aria-describedby="amount-hint"
                @blur="touched.amount = true"
              >
              <span class="suffix">{{ originToken ? originToken.symbol : '' }}</span>
            </div>
            <div v-if="originToken && originToken.priceUsd > 0" class="chips" role="group" aria-label="Quick amounts">
              <button v-for="u in quickUsd" :key="u" type="button" class="chip" @click="setUsd(u)">${{ u }}</button>
            </div>
            <span id="amount-hint" class="hint">
              <template v-if="amountUsd">About {{ usd(amountUsd) }}.</template>
              Small amounts only.
            </span>
            <span v-if="amountError && touched.amount" class="error" role="alert">{{ amountError }}</span>
          </div>

          <!-- Live estimate -->
          <div class="estimate" aria-live="polite">
            <template v-if="previewLoading">
              <span class="skeleton est-skel" aria-hidden="true" />
              <span class="sr-only">Getting estimate</span>
            </template>
            <template v-else-if="preview">
              {{ creatorFirstName }} receives about
              <strong>{{ preview.estimatedOut }} {{ preview.destSymbol }}</strong>
              <template v-if="preview.estimatedOutUsd"> ({{ usd(preview.estimatedOutUsd) }})</template>
            </template>
            <span v-else-if="previewError" class="error">{{ previewError }}</span>
            <span v-else class="muted">Enter an amount to see what {{ creatorFirstName }} receives.</span>
          </div>

          <div class="field">
            <label for="refundAddress">Your refund address on {{ originChainName }}</label>
            <input
              id="refundAddress"
              v-model.trim="form.refundAddress"
              class="input mono"
              autocomplete="off"
              spellcheck="false"
              :placeholder="refundPlaceholder"
              :aria-invalid="!!refundError && touched.refundAddress"
              aria-describedby="refund-hint"
              @blur="touched.refundAddress = true"
            >
            <span id="refund-hint" class="hint">
              If the swap cannot complete, your funds go back here automatically. Use an address you control.
            </span>
            <span v-if="flags.mock && sampleAddr" class="hint">
              Mock mode: nothing is sent, so any valid-looking address works.
              <button type="button" class="link-btn" @click="useExampleRefund">Use an example address</button>
            </span>
            <span v-if="refundError && touched.refundAddress" class="error" role="alert">{{ refundError }}</span>
          </div>

          <div class="field">
            <label for="tipperName">Your name <span class="muted">(optional)</span></label>
            <input id="tipperName" v-model="form.tipperName" class="input" maxlength="40" autocomplete="nickname">
          </div>

          <div class="field">
            <label for="message">Message <span class="muted">(optional)</span></label>
            <textarea id="message" v-model="form.message" class="textarea" maxlength="140" aria-describedby="msg-count" />
            <span id="msg-count" class="hint">{{ form.message.length }}/140. Shown publicly on stream.</span>
          </div>

          <p v-if="submitError" class="notice notice-danger" role="alert">{{ submitError }}</p>

          <button class="btn btn-primary btn-block" type="submit" :disabled="submitting || tokensLoading">
            {{ submitting ? 'Getting address…' : 'Get deposit address' }}
          </button>
          <p class="muted small fine">
            Powered by NEAR Intents. We never hold your funds: the swap pays {{ creatorFirstName }}'s own address directly.
          </p>
        </form>
      </section>
    </template>

    <div v-else class="skeleton" style="height: 320px" role="status" aria-label="Loading" />
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import type {
  CreatorPublicResponse,
  PublicTip,
  TipLiveDetail,
  TipPreviewResponse,
  TipResponse,
  TokenInfo,
  TokensResponse
} from '~~/types/api'
import { addressExample, checkAddress, sampleAddress } from '~~/utils/address'
import { chainName } from '~~/utils/chains'
import { formatCountdown, formatUsd, tokenAmountForUsd } from '~~/utils/format'
import { isValidAmount } from '~~/utils/units'

const POLL_MS = 4000
const PREVIEW_DEBOUNCE_MS = 600
const TERMINAL = ['success', 'refunded', 'failed', 'expired']

function errorMessage(err: unknown, fallback: string): string {
  const data = (err as { data?: { error?: unknown } })?.data
  return typeof data?.error === 'string' ? data.error : fallback
}

function storageKey(handle: string): string {
  return `cgt_tip_${handle}`
}

export default defineComponent({
  name: 'TipPage',
  async setup() {
    const route = useRoute()
    const handle = String(route.params.handle || '').toLowerCase()
    // Start both requests before the first await, so Nuxt's context is still available for each.
    const flagsReq = useAppFlags()
    const { data, error, refresh } = await useFetch<CreatorPublicResponse>(`/api/creators/${encodeURIComponent(handle)}`, {
      key: `creator-${handle}`
    })
    const name = data.value?.creator.displayName
    useHead({
      title: name ? `Tip ${name} · Chetapawa` : 'Tip page · Chetapawa',
      meta: [{ name: 'description', content: name ? `Send ${name} a tip with any token on any chain.` : 'Send a tip with any token on any chain.' }]
    })
    const { data: flags } = await flagsReq
    return { handle, creatorData: data, creatorError: error, refreshCreator: refresh, flags }
  },
  data() {
    return {
      form: { originAssetId: '', amount: '', refundAddress: '', tipperName: '', message: '' },
      touched: { amount: false, refundAddress: false },
      tokens: [] as TokenInfo[],
      tokensLoading: true,
      tokensError: '',
      preview: null as TipPreviewResponse | null,
      previewLoading: false,
      previewError: '',
      previewSeq: 0,
      previewTimer: null as ReturnType<typeof setTimeout> | null,
      submitting: false,
      submitError: '',
      tip: null as PublicTip | null,
      live: null as TipLiveDetail | null,
      pollTimer: null as ReturnType<typeof setTimeout> | null,
      pollError: '',
      pollFailures: 0,
      now: Date.now(),
      clock: null as ReturnType<typeof setInterval> | null,
      txHash: '',
      txSubmitting: false,
      txError: '',
      txSent: false,
      confirmCancel: false,
      quickUsd: [1, 2, 5]
    }
  },
  computed: {
    sampleAddr(): string | null {
      return this.originToken ? sampleAddress(this.originToken.chain) : null
    },
    creator() { return this.creatorData?.creator ?? null },
    goal() { return this.creatorData?.goal ?? null },
    loadError(): { status: number } | null {
      if (!this.creatorError) return null
      return { status: this.creatorError.statusCode ?? 500 }
    },
    initial(): string {
      return (this.creator?.displayName || '?').trim().charAt(0).toUpperCase()
    },
    creatorFirstName(): string {
      return (this.creator?.displayName || 'The creator').split(' ')[0] as string
    },
    originToken(): TokenInfo | undefined {
      return this.tokens.find((t) => t.assetId === this.form.originAssetId)
    },
    originChainName(): string {
      return this.originToken ? chainName(this.originToken.chain) : 'the chain you pay from'
    },
    refundPlaceholder(): string {
      return this.originToken ? addressExample(this.originToken.chain) : ''
    },
    amountError(): string | null {
      const a = this.form.amount.trim()
      if (!a) return 'Enter an amount.'
      if (!isValidAmount(a) || Number(a) <= 0) return 'Enter a positive number like 1.5'
      const dec = a.split('.')[1]
      if (this.originToken && dec && dec.length > this.originToken.decimals) {
        return `Too many decimal places. ${this.originToken.symbol} allows ${this.originToken.decimals}.`
      }
      return null
    },
    amountUsd(): number | null {
      if (this.amountError || !this.originToken || !(this.originToken.priceUsd > 0)) return null
      return Number(this.form.amount) * this.originToken.priceUsd
    },
    refundError(): string | null {
      if (!this.originToken) return null
      if (!this.form.refundAddress) return `Enter your own ${this.originChainName} address for refunds.`
      return checkAddress(this.originToken.chain, this.form.refundAddress)
    },
    previewKey(): string {
      return `${this.form.originAssetId}|${this.form.amount.trim()}`
    },
    expiresAtMs(): number | null {
      return this.tip?.expiresAt ? new Date(this.tip.expiresAt).getTime() : null
    },
    msLeft(): number {
      return this.expiresAtMs === null ? Infinity : this.expiresAtMs - this.now
    },
    isExpired(): boolean {
      return this.msLeft <= 0
    },
    countdown(): string {
      return Number.isFinite(this.msLeft) ? formatCountdown(this.msLeft) : 'soon'
    },
    txLinks(): { hash: string; explorerUrl: string; label: string }[] {
      if (!this.live) return []
      return [
        ...this.live.originTxs.map((t) => ({ ...t, label: 'Deposit' })),
        ...this.live.destinationTxs.map((t) => ({ ...t, label: 'Delivery' }))
      ]
    }
  },
  watch: {
    previewKey() { this.schedulePreview() },
    form: { deep: true, handler() { this.submitError = '' } },
    'form.originAssetId'() { this.touched.refundAddress = false }
  },
  mounted() {
    if (!this.creator) return
    this.loadTokens()
    this.restoreTip()
    this.clock = setInterval(() => { this.now = Date.now() }, 1000)
  },
  beforeUnmount() {
    this.stopPolling()
    if (this.previewTimer) clearTimeout(this.previewTimer)
    if (this.clock) clearInterval(this.clock)
  },
  methods: {
    chainName,
    usd(v: number | null): string { return formatUsd(v) },
    short(h: string): string { return h.length > 16 ? `${h.slice(0, 8)}…${h.slice(-6)}` : h },

    async loadTokens() {
      this.tokensLoading = true
      this.tokensError = ''
      try {
        const res = await $fetch<TokensResponse>('/api/tokens')
        this.tokens = res.tokens
        if (!this.form.originAssetId) this.form.originAssetId = this.pickDefault(res.tokens)
      } catch (err) {
        this.tokensError = errorMessage(err, 'Could not load tokens.')
      } finally {
        this.tokensLoading = false
      }
    },
    /** Default to USDC on the creator's own chain, then USDC anywhere, then the first token. */
    pickDefault(tokens: TokenInfo[]): string {
      const destChain = this.creator?.destChain
      const pick =
        tokens.find((t) => t.chain === destChain && t.symbol === 'USDC') ??
        tokens.find((t) => t.symbol === 'USDC') ??
        tokens[0]
      return pick ? pick.assetId : ''
    },
    useExampleRefund() {
      this.form.refundAddress = this.sampleAddr ?? ''
      this.touched.refundAddress = true
    },
    setUsd(u: number) {
      const t = this.originToken
      if (!t) return
      this.form.amount = tokenAmountForUsd(u, t.priceUsd, t.decimals)
      this.touched.amount = true
    },

    schedulePreview() {
      if (this.previewTimer) clearTimeout(this.previewTimer)
      this.preview = null
      this.previewError = ''
      if (this.amountError || !this.originToken) {
        this.previewLoading = false
        this.previewSeq++
        return
      }
      this.previewLoading = true
      this.previewTimer = setTimeout(() => this.runPreview(), PREVIEW_DEBOUNCE_MS)
    },
    async runPreview() {
      const seq = ++this.previewSeq
      try {
        const res = await $fetch<TipPreviewResponse>('/api/tips/preview', {
          method: 'POST',
          body: { handle: this.handle, originAssetId: this.form.originAssetId, amount: this.form.amount.trim() }
        })
        if (seq !== this.previewSeq) return
        this.preview = res
      } catch (err) {
        if (seq !== this.previewSeq) return
        this.previewError = errorMessage(err, 'Could not get an estimate right now.')
      } finally {
        if (seq === this.previewSeq) this.previewLoading = false
      }
    },

    async getDepositAddress() {
      this.touched.amount = true
      this.touched.refundAddress = true
      this.submitError = ''
      if (!this.originToken) { this.submitError = 'Pick a token to pay with.'; return }
      if (this.amountError || this.refundError) { this.submitError = 'Fix the highlighted fields first.'; return }
      if (this.previewError) { this.submitError = this.previewError; return }
      this.submitting = true
      try {
        const res = await $fetch<TipResponse>('/api/tips/quote', {
          method: 'POST',
          body: {
            handle: this.handle,
            originAssetId: this.form.originAssetId,
            amount: this.form.amount.trim(),
            refundAddress: this.form.refundAddress,
            tipperName: this.form.tipperName.trim() || undefined,
            message: this.form.message.trim() || undefined
          }
        })
        this.setTip(res)
        this.saveTipId(res.tip.id)
        this.schedulePoll()
        this.$nextTick(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
      } catch (err) {
        this.submitError = errorMessage(err, 'Could not create a deposit address. Try again.')
      } finally {
        this.submitting = false
      }
    },

    setTip(res: TipResponse) {
      const before = this.tip?.status
      this.tip = res.tip
      if (res.live) this.live = res.live
      if (res.tip.status === 'success' && before !== 'success') this.refreshCreator()
    },

    async poll() {
      if (!this.tip) return
      try {
        const res = await $fetch<TipResponse>(`/api/tips/${this.tip.id}/status`)
        this.setTip(res)
        this.pollError = ''
        this.pollFailures = 0
      } catch (err) {
        this.pollFailures++
        if (this.pollFailures >= 3) this.pollError = 'Having trouble checking status. Still trying…'
        const status = (err as { statusCode?: number }).statusCode
        if (status === 404) { this.forgetTip(); this.tip = null; return }
      }
      this.schedulePoll()
    },
    schedulePoll() {
      this.stopPolling()
      if (!this.tip || TERMINAL.includes(this.tip.status)) return
      const delay = this.pollFailures > 0 ? Math.min(POLL_MS * 2 ** this.pollFailures, 30_000) : POLL_MS
      this.pollTimer = setTimeout(() => this.poll(), delay)
    },
    stopPolling() {
      if (this.pollTimer) clearTimeout(this.pollTimer)
      this.pollTimer = null
    },

    async submitTxHash() {
      if (!this.tip) return
      this.txSubmitting = true
      this.txError = ''
      this.txSent = false
      try {
        const res = await $fetch<TipResponse>(`/api/tips/${this.tip.id}/submit-deposit`, {
          method: 'POST',
          body: { txHash: this.txHash.trim() }
        })
        this.setTip(res)
        this.txSent = true
        this.schedulePoll()
      } catch (err) {
        this.txError = errorMessage(err, 'Could not submit that hash.')
      } finally {
        this.txSubmitting = false
      }
    },

    startOver() {
      this.confirmCancel = false
      this.stopPolling()
      this.forgetTip()
      this.tip = null
      this.live = null
      this.pollError = ''
      this.txHash = ''
      this.txSent = false
      this.txError = ''
      this.form.amount = ''
      this.form.message = ''
      this.touched.amount = false
      this.preview = null
    },

    // The open tip survives a page reload, so fans never lose their deposit address.
    saveTipId(id: string) {
      try { localStorage.setItem(storageKey(this.handle), id) } catch { /* storage blocked: fine */ }
    },
    forgetTip() {
      try { localStorage.removeItem(storageKey(this.handle)) } catch { /* storage blocked: fine */ }
    },
    async restoreTip() {
      let id: string | null = null
      try { id = localStorage.getItem(storageKey(this.handle)) } catch { id = null }
      if (!id) return
      try {
        const res = await $fetch<TipResponse>(`/api/tips/${encodeURIComponent(id)}/status`)
        if (res.tip.handle !== this.handle) { this.forgetTip(); return }
        this.setTip(res)
        this.schedulePoll()
      } catch {
        this.forgetTip()
      }
    }
  }
})
</script>

<style scoped>
.center { text-align: center; }
.creator { display: flex; align-items: center; gap: 14px; margin-bottom: 12px; }
.avatar {
  flex: none; width: 56px; height: 56px; border-radius: 50%;
  display: grid; place-items: center;
  background: var(--coral); color: var(--charcoal); font-weight: 800; font-size: 1.5rem;
}
.who h1 { margin: 0; font-size: clamp(1.5rem, 6vw, 2rem); overflow-wrap: anywhere; }
.handle { margin: 0; }
.bio { margin: 0 0 8px; overflow-wrap: anywhere; }
.receives { font-size: 0.9rem; }
.goal-card { margin-bottom: 16px; }
.demo { margin-bottom: 16px; }
.card h2 { margin-bottom: 16px; }

.amount-input { position: relative; }
.amount-input .input { padding-right: 76px; font-size: 1.15rem; font-weight: 600; }
.suffix {
  position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
  color: var(--muted); font-weight: 600; pointer-events: none;
}
.chips { display: flex; gap: 8px; flex-wrap: wrap; }
.chip {
  min-height: 36px; padding: 4px 14px; border-radius: 999px; cursor: pointer;
  border: 1.5px solid var(--border); background: #fff; font: inherit; font-size: 0.875rem; font-weight: 600; color: var(--text);
}
.chip:hover { background: var(--peach); }

.estimate {
  margin: 0 0 16px; padding: 12px 14px; border-radius: var(--radius-sm);
  background: var(--cream); border: 1px dashed var(--border); min-height: 48px; font-size: 0.95rem;
}
.estimate .error { color: var(--danger); }
.est-skel { display: block; height: 20px; width: 70%; }

.deposit { margin-top: 20px; }
.instruction { font-size: 1.05rem; text-align: center; }
.qr-row { display: flex; justify-content: center; margin: 8px 0 16px; }
.kv { margin: 0 0 12px; display: grid; gap: 10px; }
.kv > div { background: var(--cream); border-radius: var(--radius-sm); padding: 10px 12px; }
.kv dt { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
.kv dd { margin: 4px 0 0; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.addr { flex: 1 1 200px; font-size: 0.9rem; }
.countdown { text-align: center; margin: 12px 0 8px; }
.countdown.soon strong { color: var(--danger); }
.small { font-size: 0.85rem; }
.speedup { margin-top: 12px; border-top: 1px solid var(--border); padding-top: 12px; }
.speedup summary { cursor: pointer; font-weight: 600; color: var(--primary); min-height: 32px; }
.speedup-form { margin-top: 12px; }

.result { margin-top: 20px; padding: 14px 16px; border-radius: var(--radius-sm); background: var(--cream); }
.result h3 { margin-bottom: 6px; }
.result p:last-child { margin-bottom: 0; }
.result.ok { background: #E6F5ED; }
.result.bad { background: #FDE7E5; }
.txs { margin: 8px 0 0; padding-left: 18px; font-size: 0.9rem; }
.actions { margin-top: 16px; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.hint-center { margin: 0; text-align: center; }
.confirm { width: 100%; padding: 12px 14px; border-radius: var(--radius-sm); background: #FFF4D6; border: 1px solid #F0D48A; }
.confirm p { margin: 0 0 10px; }
.confirm-row { display: flex; gap: 8px; flex-wrap: wrap; }
.fine { margin: 12px 0 0; text-align: center; }
</style>
