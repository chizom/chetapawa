<template>
  <div class="container narrow">
    <!-- Success: show the manage token once -->
    <section v-if="result" class="card done" aria-labelledby="done-title">
      <h1 id="done-title">Your page is live 🎉</h1>
      <p class="muted">Share your tip page anywhere. Fans can pay with any token on any chain.</p>

      <div class="link-row">
        <span class="label">Tip page</span>
        <a :href="result.tipUrl" class="mono">{{ result.tipUrl }}</a>
        <CopyButton :value="result.tipUrl" label="Copy link" aria-label="Copy tip page link" />
      </div>

      <div class="token-box" role="alert">
        <h2>Save your manage token</h2>
        <p>
          You need this to set goals and see your dashboard. <strong>We only show it once and cannot recover it.</strong>
          Store it in a password manager.
        </p>
        <code class="mono token">{{ result.manageToken }}</code>
        <div class="row">
          <CopyButton :value="result.manageToken" label="Copy token" aria-label="Copy manage token" />
        </div>
        <label class="check">
          <input v-model="savedToken" type="checkbox">
          I saved my manage token somewhere safe.
        </label>
      </div>

      <div class="link-row">
        <span class="label">Dashboard</span>
        <span class="mono">{{ result.manageUrl }}</span>
        <CopyButton :value="result.manageUrl" label="Copy" aria-label="Copy dashboard link" />
      </div>

      <div class="actions">
        <NuxtLink
          :to="`/${result.creator.handle}/manage`"
          class="btn btn-primary"
          :class="{ disabled: !savedToken }"
          :aria-disabled="!savedToken"
          :tabindex="savedToken ? 0 : -1"
          @click="onDashboardClick"
        >
          Go to dashboard
        </NuxtLink>
        <NuxtLink :to="`/${result.creator.handle}`" class="btn btn-ghost">View tip page</NuxtLink>
      </div>
    </section>

    <!-- Form -->
    <section v-else aria-labelledby="create-title">
      <h1 id="create-title">Create your tip page</h1>
      <p class="muted">Takes a minute. No account, no email. Tips go straight to your own wallet.</p>

      <form class="card" novalidate @submit.prevent="submit">
        <div class="field">
          <label for="handle">Handle</label>
          <div class="prefix-input">
            <span aria-hidden="true">/</span>
            <input
              id="handle"
              v-model="form.handle"
              class="input"
              autocomplete="off"
              autocapitalize="off"
              spellcheck="false"
              maxlength="24"
              placeholder="yourname"
              aria-describedby="handle-hint"
              @blur="touched.handle = true"
            >
          </div>
          <span v-if="touched.handle && handleError" class="error">{{ handleError }}</span>
          <span v-else id="handle-hint" class="hint">3 to 24 characters. Lowercase letters, numbers and underscores.</span>
        </div>

        <div class="field">
          <label for="displayName">Display name</label>
          <input id="displayName" v-model="form.displayName" class="input" maxlength="60" placeholder="Your name" @blur="touched.displayName = true">
          <span v-if="touched.displayName && !form.displayName.trim()" class="error">Display name is required.</span>
        </div>

        <div class="field">
          <label for="bio">Bio <span class="muted">(optional)</span></label>
          <textarea id="bio" v-model="form.bio" class="textarea" maxlength="280" placeholder="What do you make?" />
          <span class="hint">{{ form.bio.length }}/280</span>
        </div>

        <fieldset class="payout">
          <legend>How you get paid</legend>
          <div v-if="tokensLoading" class="skeleton" style="height: 72px" role="status" aria-label="Loading tokens" />
          <p v-else-if="tokensError" class="notice notice-danger">
            {{ tokensError }} <button type="button" class="btn btn-ghost btn-sm" @click="loadTokens">Retry</button>
          </p>
          <TokenPicker
            v-else
            v-model="form.destAssetId"
            :tokens="tokens"
            id-prefix="dest"
            chain-label="Receive on chain"
            token-label="Receive token"
          />

          <div class="field">
            <label for="payoutAddress">Your {{ destChainName }} address</label>
            <input
              id="payoutAddress"
              v-model="form.payoutAddress"
              class="input mono"
              autocomplete="off"
              autocapitalize="off"
              spellcheck="false"
              :placeholder="addressPlaceholder"
              aria-describedby="address-warn"
              @blur="touched.payoutAddress = true"
            >
            <span v-if="touched.payoutAddress && addressError" class="error">{{ addressError }}</span>
            <span v-if="flags.mock && sampleAddr" class="hint">
              Mock mode: nothing is sent, so any valid-looking address works.
              <button type="button" class="link-btn" @click="useExampleAddress">Use an example address</button>
            </span>
          </div>
          <p id="address-warn" class="notice notice-warn">
            ⚠️ This must be <strong>your own address on {{ destChainName }}</strong>.
            Tips arrive there as {{ destSymbol }}. An address from another chain can lose funds.
          </p>
        </fieldset>

        <p v-if="submitError" class="notice notice-danger" role="alert">{{ submitError }}</p>

        <button type="submit" class="btn btn-primary btn-block" :disabled="submitting || tokensLoading">
          {{ submitting ? 'Creating…' : 'Create my page' }}
        </button>
      </form>
    </section>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import type { CreateCreatorResponse, TokenInfo, TokensResponse } from '~~/types/api'
import { addressExample, checkAddress, sampleAddress } from '~~/utils/address'
import { chainName } from '~~/utils/chains'
import { checkHandle, normalizeHandle } from '~~/utils/handle'

const DEFAULT_DEST_CHAIN = 'near'
const DEFAULT_DEST_SYMBOL = 'USDC'

function errorMessage(err: unknown, fallback: string): string {
  const data = (err as { data?: { error?: unknown } })?.data
  return typeof data?.error === 'string' ? data.error : fallback
}

export default defineComponent({
  name: 'CreatePage',
  async setup() {
    useHead({ title: 'Create your tip page · Chetapawa' })
    const { data: flags } = await useAppFlags()
    return { flags }
  },
  data() {
    return {
      form: { handle: '', displayName: '', bio: '', payoutAddress: '', destAssetId: '' },
      touched: { handle: false, displayName: false, payoutAddress: false },
      tokens: [] as TokenInfo[],
      tokensLoading: true,
      tokensError: '',
      submitting: false,
      submitError: '',
      result: null as CreateCreatorResponse | null,
      savedToken: false
    }
  },
  computed: {
    sampleAddr(): string | null {
      return this.destToken ? sampleAddress(this.destToken.chain) : null
    },
    handle(): string {
      return normalizeHandle(this.form.handle)
    },
    handleError(): string | null {
      return checkHandle(this.handle)
    },
    destToken(): TokenInfo | undefined {
      return this.tokens.find((t) => t.assetId === this.form.destAssetId)
    },
    destChainName(): string {
      return this.destToken ? chainName(this.destToken.chain) : 'payout'
    },
    destSymbol(): string {
      return this.destToken?.symbol ?? 'your token'
    },
    addressPlaceholder(): string {
      return this.destToken ? addressExample(this.destToken.chain) : ''
    },
    addressError(): string | null {
      return this.destToken ? checkAddress(this.destToken.chain, this.form.payoutAddress) : null
    }
  },
  mounted() {
    this.loadTokens()
  },
  methods: {
    useExampleAddress() {
      this.form.payoutAddress = this.sampleAddr ?? ''
      this.touched.payoutAddress = true
    },
    async loadTokens() {
      this.tokensLoading = true
      this.tokensError = ''
      try {
        const res = await $fetch<TokensResponse>('/api/tokens')
        this.tokens = res.tokens
        if (!this.form.destAssetId) this.form.destAssetId = this.pickDefault(res.tokens)
      } catch (err) {
        this.tokensError = errorMessage(err, 'Could not load tokens.')
      } finally {
        this.tokensLoading = false
      }
    },
    /** USDC on NEAR if present, otherwise the first sensible NEAR token, otherwise anything. */
    pickDefault(tokens: TokenInfo[]): string {
      const near = tokens.filter((t) => t.chain === DEFAULT_DEST_CHAIN)
      const pick =
        near.find((t) => t.symbol === DEFAULT_DEST_SYMBOL) ??
        near.find((t) => ['USDT', 'wNEAR', 'NEAR'].includes(t.symbol)) ??
        near[0] ??
        tokens[0]
      return pick?.assetId ?? ''
    },
    async submit() {
      this.touched = { handle: true, displayName: true, payoutAddress: true }
      this.submitError = ''
      if (this.handleError || !this.form.displayName.trim() || this.addressError || !this.destToken) {
        this.submitError = 'Fix the highlighted fields first.'
        return
      }
      this.submitting = true
      try {
        const res = await $fetch<CreateCreatorResponse>('/api/creators', {
          method: 'POST',
          body: {
            handle: this.handle,
            displayName: this.form.displayName.trim(),
            bio: this.form.bio.trim() || undefined,
            payoutAddress: this.form.payoutAddress.trim(),
            destAssetId: this.form.destAssetId
          }
        })
        this.result = res
        // Convenience only: the dashboard can auto-fill from here. The creator must still save it.
        try { localStorage.setItem(`cgt_manage_${res.creator.handle}`, res.manageToken) } catch { /* storage blocked */ }
        window.scrollTo({ top: 0 })
      } catch (err) {
        this.submitError = errorMessage(err, 'Could not create your page. Try again.')
      } finally {
        this.submitting = false
      }
    },
    onDashboardClick(e: Event) {
      if (!this.savedToken) e.preventDefault()
    }
  }
})
</script>

<style scoped>
.card form, form.card { display: block; }
.prefix-input { display: flex; align-items: center; gap: 6px; }
.prefix-input span { font-weight: 700; color: var(--muted); }
.payout { border: 0; padding: 0; margin: 8px 0 16px; }
.payout legend { font-weight: 700; font-size: 1.05rem; margin-bottom: 12px; padding: 0; }
.notice { margin: 0 0 16px; }
.done h1 { font-size: 1.75rem; }
.link-row {
  display: grid; grid-template-columns: 1fr auto; gap: 4px 12px; align-items: center;
  padding: 12px 0; border-bottom: 1px solid var(--border);
}
.link-row .label { grid-column: 1 / -1; font-size: 0.8rem; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
.link-row .mono { font-size: 0.9rem; }
.token-box {
  margin: 16px 0; padding: 16px; border-radius: var(--radius-sm);
  background: var(--peach); border: 2px solid var(--coral);
}
.token-box h2 { font-size: 1.1rem; }
.token-box p { font-size: 0.9rem; }
.token { display: block; padding: 12px; background: #fff; border-radius: var(--radius-sm); border: 1px solid var(--border); margin-bottom: 10px; font-size: 0.85rem; }
.row { margin-bottom: 12px; }
.check { display: flex; gap: 8px; align-items: flex-start; font-size: 0.9rem; font-weight: 600; cursor: pointer; }
.check input { width: 20px; height: 20px; margin: 0; accent-color: var(--rust); flex-shrink: 0; }
.actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 20px; }
.btn.disabled { opacity: 0.55; cursor: not-allowed; }
</style>
