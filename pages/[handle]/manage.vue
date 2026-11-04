<template>
  <div class="container narrow">
    <div class="top">
      <div>
        <h1>Dashboard</h1>
        <p class="muted sub">
          <NuxtLink :to="`/${handle}`">@{{ handle }}</NuxtLink>
        </p>
      </div>
      <button v-if="data" class="btn btn-ghost btn-sm" type="button" @click="lock">Lock</button>
    </div>

    <!-- Unlock -->
    <section v-if="!data" class="card" aria-labelledby="unlock-title">
      <div v-if="checking" class="skeleton" style="height: 140px" aria-label="Checking your token" />
      <form v-else novalidate @submit.prevent="unlock">
        <h2 id="unlock-title">Enter your manage token</h2>
        <p class="muted">You got it when you created this page. It starts with <span class="mono">cgt_</span>.</p>
        <div class="field">
          <label for="manageToken">Manage token</label>
          <input
            id="manageToken"
            v-model.trim="tokenInput"
            class="input mono"
            type="password"
            autocomplete="off"
            spellcheck="false"
            :aria-invalid="!!authError"
            aria-describedby="token-err"
          >
          <span v-if="authError" id="token-err" class="error" role="alert">{{ authError }}</span>
        </div>
        <label class="check">
          <input v-model="remember" type="checkbox">
          Remember on this device
        </label>
        <button class="btn btn-primary btn-block" type="submit" :disabled="!tokenInput || unlocking">
          {{ unlocking ? 'Checking…' : 'Open dashboard' }}
        </button>
        <p v-if="notFound" class="notice notice-danger" role="alert">
          There is no page at /{{ handle }}. <NuxtLink to="/create">Create one</NuxtLink>.
        </p>
      </form>
    </section>

    <template v-else>
      <!-- Stats -->
      <section class="stats" aria-label="Totals">
        <div class="card stat">
          <span class="stat-num">{{ data.totals.successCount }}</span>
          <span class="muted">tips delivered</span>
        </div>
        <div class="card stat">
          <span class="stat-num">{{ usd(data.totals.totalUsd) || '$0.00' }}</span>
          <span class="muted">received (USD est.)</span>
        </div>
      </section>

      <!-- Links -->
      <section class="card" aria-labelledby="links-title">
        <h2 id="links-title">Your links</h2>
        <div class="link-row">
          <span class="label">Tip page</span>
          <a :href="data.tipUrl" class="mono">{{ data.tipUrl }}</a>
          <CopyButton :value="data.tipUrl" label="Copy" aria-label="Copy tip page link" />
        </div>
        <div class="link-row">
          <span class="label">OBS overlay</span>
          <span class="mono">{{ data.overlayUrl }}</span>
          <CopyButton :value="data.overlayUrl" label="Copy" aria-label="Copy overlay link" />
        </div>
        <p class="muted small">
          In OBS, add a Browser Source with the overlay link. Tip alerts and your goal bar appear on stream.
        </p>
        <p class="muted small">
          Payouts go to <span class="mono">{{ data.creator.payoutAddress }}</span>
          as {{ data.creator.destAssetSymbol }} on {{ chainName(data.creator.destChain) }}.
        </p>
      </section>

      <!-- Goal -->
      <section class="card" aria-labelledby="goal-title">
        <h2 id="goal-title">Goal</h2>

        <template v-if="data.goal && !editing">
          <GoalBar :goal="data.goal" />
          <p class="muted small goal-meta">
            {{ data.goal.tipCount }} {{ data.goal.tipCount === 1 ? 'tip' : 'tips' }} toward this goal.
            Progress counts delivered tips at their USD value.
          </p>
          <div class="row">
            <button class="btn btn-ghost btn-sm" type="button" @click="startEdit">Edit goal</button>
            <button
              v-if="!confirmEnd"
              class="btn btn-ghost btn-sm"
              type="button"
              @click="confirmEnd = true"
            >
              End goal
            </button>
            <template v-else>
              <span class="small">End this goal?</span>
              <button class="btn btn-primary btn-sm" type="button" :disabled="goalSaving" @click="endGoal">Yes, end it</button>
              <button class="btn btn-ghost btn-sm" type="button" @click="confirmEnd = false">Keep it</button>
            </template>
          </div>
        </template>

        <form v-else novalidate @submit.prevent="saveGoal">
          <p v-if="!data.goal" class="muted">
            Set a goal and fans see a progress bar on your tip page and stream. One goal at a time.
          </p>
          <div class="field">
            <label for="goalTitle">Title</label>
            <input id="goalTitle" v-model="goalForm.title" class="input" maxlength="80" placeholder="New microphone">
          </div>
          <div class="field">
            <label for="goalTarget">Target in US dollars</label>
            <div class="usd-input">
              <span aria-hidden="true">$</span>
              <input id="goalTarget" v-model="goalForm.target" class="input" inputmode="decimal" placeholder="100" aria-describedby="target-hint">
            </div>
            <span id="target-hint" class="hint">Tips count at the USD value 1Click reports when they are delivered.</span>
          </div>
          <div class="row">
            <button class="btn btn-primary" type="submit" :disabled="goalSaving">
              {{ goalSaving ? 'Saving…' : editing ? 'Save changes' : 'Start goal' }}
            </button>
            <button v-if="editing" class="btn btn-ghost" type="button" @click="cancelEdit">Cancel</button>
          </div>
        </form>

        <p v-if="goalError" class="notice notice-danger goal-err" role="alert">{{ goalError }}</p>
        <p v-if="goalNotice && !goalError" class="small ok-text" role="status">{{ goalNotice }}</p>

        <details v-if="data.pastGoals.length" class="past">
          <summary>Past goals ({{ data.pastGoals.length }})</summary>
          <ul>
            <li v-for="g in data.pastGoals" :key="g.id">
              <strong>{{ g.title }}</strong>: {{ usd(g.raised) || '$0.00' }} of {{ usd(g.targetAmount) }}
              <span v-if="g.completed" class="badge">Reached</span>
            </li>
          </ul>
        </details>
      </section>

      <!-- Tips -->
      <section class="card" aria-labelledby="tips-title">
        <div class="tips-head">
          <h2 id="tips-title">Recent tips</h2>
          <button class="btn btn-ghost btn-sm" type="button" :disabled="refreshing" @click="refresh()">
            {{ refreshing ? 'Refreshing…' : 'Refresh' }}
          </button>
        </div>
        <p v-if="!data.tips.length" class="muted">No tips yet. Share your tip page to get started.</p>
        <ul v-else class="tips">
          <li v-for="t in data.tips" :key="t.id" class="tip">
            <div class="tip-main">
              <span class="tip-who">{{ t.tipperName || 'Anonymous' }}</span>
              <span class="status" :class="`s-${t.status}`">{{ statusLabel(t.status) }}</span>
            </div>
            <div class="tip-amt">
              {{ t.amountIn }} {{ t.originSymbol }} <span class="muted">on {{ chainName(t.originChain) }}</span>
              <template v-if="t.amountOut">
                {{ ' ' }}<span aria-hidden="true">→</span><span class="sr-only">to</span>{{ ' ' }}{{ t.amountOut }} {{ t.destSymbol }}
              </template>
              <template v-if="t.status === 'success' && t.amountOutUsd">
                {{ ' ' }}<span class="muted">({{ usd(t.amountOutUsd) }})</span>
              </template>
            </div>
            <p v-if="t.message" class="tip-msg">“{{ t.message }}”</p>
            <time class="muted small" :datetime="t.createdAt">{{ ago(t.createdAt) }}</time>
          </li>
        </ul>
        <p v-if="refreshError" class="muted small" role="status">{{ refreshError }}</p>
      </section>
    </template>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import type { DashboardResponse, GoalResponse, GoalWithProgress, TipStatus } from '~~/types/api'
import { chainName } from '~~/utils/chains'
import { formatUsd } from '~~/utils/format'

const REFRESH_MS = 8000

function errorInfo(err: unknown, fallback: string): { status: number; message: string } {
  const e = err as { statusCode?: number; data?: { error?: unknown } }
  return { status: e?.statusCode ?? 0, message: typeof e?.data?.error === 'string' ? e.data.error : fallback }
}

export default defineComponent({
  name: 'ManagePage',
  setup() {
    const route = useRoute()
    const handle = String(route.params.handle || '').toLowerCase()
    useHead({
      title: `Dashboard @${handle} · Chetapawa`,
      meta: [{ name: 'robots', content: 'noindex' }]
    })
    return { handle }
  },
  data() {
    return {
      token: '',
      tokenInput: '',
      remember: true,
      checking: true,
      unlocking: false,
      authError: '',
      notFound: false,
      data: null as DashboardResponse | null,
      refreshing: false,
      /** Bumped on every local goal change, so an older in-flight refresh cannot overwrite it. */
      writeSeq: 0,
      refreshError: '',
      timer: null as ReturnType<typeof setInterval> | null,
      editing: false,
      confirmEnd: false,
      goalForm: { title: '', target: '' },
      goalSaving: false,
      goalError: '',
      goalNotice: '',
      now: Date.now()
    }
  },
  computed: {
    storageKey(): string { return `cgt_manage_${this.handle}` }
  },
  async mounted() {
    let saved = ''
    try { saved = localStorage.getItem(this.storageKey) || '' } catch { saved = '' }
    if (saved) {
      this.tokenInput = saved
      await this.tryToken(saved, true)
    }
    this.checking = false
  },
  beforeUnmount() {
    this.stopTimer()
  },
  methods: {
    chainName,
    usd(v: number | null): string { return formatUsd(v) },
    statusLabel(s: TipStatus): string {
      return ({ pending: 'Waiting', processing: 'Processing', success: 'Delivered', refunded: 'Refunded', failed: 'Failed', expired: 'Expired' } as Record<TipStatus, string>)[s]
    },
    ago(iso: string): string {
      const s = Math.max(0, Math.floor((this.now - new Date(iso).getTime()) / 1000))
      if (s < 60) return 'just now'
      if (s < 3600) return `${Math.floor(s / 60)} min ago`
      if (s < 86400) return `${Math.floor(s / 3600)} h ago`
      return new Date(iso).toLocaleDateString()
    },

    async fetchDashboard(token: string): Promise<DashboardResponse> {
      return await $fetch<DashboardResponse>(`/api/creators/${encodeURIComponent(this.handle)}/dashboard`, {
        headers: { 'x-manage-token': token }
      })
    },
    async tryToken(token: string, fromStorage: boolean) {
      this.authError = ''
      this.notFound = false
      try {
        this.data = await this.fetchDashboard(token)
        this.token = token
        if (this.remember) {
          try { localStorage.setItem(this.storageKey, token) } catch { /* storage blocked */ }
        }
        this.startTimer()
      } catch (err) {
        const { status, message } = errorInfo(err, 'Could not open the dashboard. Try again.')
        if (status === 404) this.notFound = true
        else this.authError = message
        if (fromStorage && status === 401) {
          try { localStorage.removeItem(this.storageKey) } catch { /* storage blocked */ }
          this.tokenInput = ''
        }
      }
    },
    async unlock() {
      this.unlocking = true
      await this.tryToken(this.tokenInput, false)
      this.unlocking = false
    },
    lock() {
      this.stopTimer()
      try { localStorage.removeItem(this.storageKey) } catch { /* storage blocked */ }
      this.token = ''
      this.tokenInput = ''
      this.data = null
    },

    async refresh(silent = false) {
      if (!this.token) return
      if (!silent) this.refreshing = true
      const seq = this.writeSeq
      try {
        const fresh = await this.fetchDashboard(this.token)
        if (seq === this.writeSeq) this.data = fresh
        this.refreshError = ''
      } catch (err) {
        const { status, message } = errorInfo(err, 'Could not refresh.')
        if (status === 401) { this.lock(); this.authError = message; return }
        this.refreshError = message
      } finally {
        this.refreshing = false
        this.now = Date.now()
      }
    },
    startTimer() {
      this.stopTimer()
      this.timer = setInterval(() => {
        // Skip background refreshes while the creator is editing the goal.
        if (!this.editing && !this.goalSaving && document.visibilityState === 'visible') this.refresh(true)
      }, REFRESH_MS)
    },
    stopTimer() {
      if (this.timer) clearInterval(this.timer)
      this.timer = null
    },

    /** Show a saved goal immediately, without waiting for the full dashboard refresh. */
    applyGoal(goal: GoalWithProgress, ended = false) {
      if (!this.data) return
      this.writeSeq++
      const prev = this.data.goal
      if (ended) {
        this.data = { ...this.data, goal: null, pastGoals: [goal, ...this.data.pastGoals].slice(0, 5) }
      } else if (prev && goal.id !== prev.id) {
        // A new goal replaced the previous active one.
        this.data = { ...this.data, goal, pastGoals: [prev, ...this.data.pastGoals].slice(0, 5) }
      } else {
        this.data = { ...this.data, goal }
      }
    },
    startEdit() {
      if (!this.data?.goal) return
      this.goalForm = { title: this.data.goal.title, target: String(this.data.goal.targetAmount) }
      this.goalError = ''
      this.goalNotice = ''
      this.confirmEnd = false
      this.editing = true
    },
    cancelEdit() {
      this.editing = false
      this.goalError = ''
    },
    parseTarget(): number | null {
      const raw = this.goalForm.target.replace(/[$,\s]/g, '')
      if (!/^\d+(\.\d{1,2})?$/.test(raw)) return null
      return Number(raw)
    },
    async saveGoal() {
      this.goalError = ''
      this.goalNotice = ''
      const title = this.goalForm.title.trim()
      const target = this.parseTarget()
      if (!title) { this.goalError = 'Give your goal a title.'; return }
      if (target === null) { this.goalError = 'Enter a target in dollars, like 100 or 49.99.'; return }
      this.goalSaving = true
      try {
        const editingId = this.editing && this.data?.goal ? this.data.goal.id : null
        if (editingId) {
          const res = await $fetch<GoalResponse>(`/api/goals/${editingId}`, {
            method: 'PATCH',
            headers: { 'x-manage-token': this.token },
            body: { title, targetAmount: target }
          })
          this.applyGoal(res.goal)
          this.goalNotice = 'Goal updated.'
        } else {
          const res = await $fetch<GoalResponse>('/api/goals', {
            method: 'POST',
            headers: { 'x-manage-token': this.token },
            body: { handle: this.handle, title, targetAmount: target }
          })
          this.applyGoal(res.goal)
          this.goalNotice = 'Goal started. It now shows on your tip page.'
        }
        this.editing = false
        this.goalForm = { title: '', target: '' }
        void this.refresh(true)
      } catch (err) {
        this.goalError = errorInfo(err, 'Could not save the goal.').message
      } finally {
        this.goalSaving = false
      }
    },
    async endGoal() {
      if (!this.data?.goal) return
      this.goalSaving = true
      this.goalError = ''
      try {
        const res = await $fetch<GoalResponse>(`/api/goals/${this.data.goal.id}`, {
          method: 'PATCH',
          headers: { 'x-manage-token': this.token },
          body: { end: true }
        })
        this.applyGoal(res.goal, true)
        this.goalNotice = 'Goal ended. You can start a new one any time.'
        this.confirmEnd = false
        void this.refresh(true)
      } catch (err) {
        this.goalError = errorInfo(err, 'Could not end the goal.').message
      } finally {
        this.goalSaving = false
      }
    }
  }
})
</script>

<style scoped>
.top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.top h1 { margin: 0; }
.sub { margin: 0; }
.card { margin-bottom: 16px; }
.card h2 { margin-bottom: 12px; }
.small { font-size: 0.85rem; }
.check { display: flex; gap: 8px; align-items: center; margin: 0 0 16px; font-size: 0.9rem; }
.check input { width: 18px; height: 18px; }
.stats { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.stat { display: flex; flex-direction: column; gap: 2px; padding: 14px 16px; }
.stat-num { font-size: 1.5rem; font-weight: 800; }
.stat .muted { font-size: 0.8rem; }
.link-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; margin-bottom: 10px; }
.link-row .label { width: 100%; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
.link-row .mono { flex: 1 1 200px; font-size: 0.85rem; }
.row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.goal-meta { margin: 10px 0 12px; }
.usd-input { position: relative; }
.usd-input span { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--muted); font-weight: 600; }
.usd-input .input { padding-left: 26px; }
.ok-text { color: var(--ok); margin: 10px 0 0; }
.goal-err { margin: 12px 0 0; }
.past { margin-top: 14px; border-top: 1px solid var(--border); padding-top: 12px; }
.past summary { cursor: pointer; font-weight: 600; color: var(--primary); min-height: 32px; }
.past ul { margin: 8px 0 0; padding-left: 18px; font-size: 0.9rem; }
.tips-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
.tips-head h2 { margin: 0; }
.tips { list-style: none; margin: 0; padding: 0; }
.tip { padding: 12px 0; border-top: 1px solid var(--border); display: flex; flex-direction: column; gap: 4px; }
.tip:first-child { border-top: 0; }
.tip-main { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.tip-who { font-weight: 700; overflow-wrap: anywhere; }
.tip-amt { font-size: 0.9rem; overflow-wrap: anywhere; }
.tip-msg { margin: 0; font-style: italic; overflow-wrap: anywhere; }
.status { flex: none; font-size: 0.75rem; font-weight: 700; padding: 2px 8px; border-radius: 999px; background: var(--peach); color: var(--rust); }
.s-success { background: #DDF3E7; color: var(--ok); }
.s-processing { background: #FFF4D6; color: var(--warn); }
.s-refunded, .s-failed { background: #FDE7E5; color: var(--danger); }
.s-expired { background: #EEE; color: var(--muted); }
</style>
