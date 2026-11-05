<template>
  <div class="stage" :class="{ compact }" :style="{ '--s': String(scale) }">
    <CoinRain
      v-if="current"
      :key="`rain-${current.key}`"
      :big="current.kind === 'goal'"
      :count="coinCount"
    />

    <Transition name="alert">
      <div v-if="current && current.kind === 'tip'" :key="current.key" class="alert" role="status">
        <p class="alert-line">
          <span class="who">{{ current.tip.tipperName || 'Someone' }}</span>
          tipped
          <strong class="amt">{{ current.tip.amountIn }} {{ current.tip.originSymbol }}</strong>
        </p>
        <p v-if="current.tip.amountOutUsd" class="alert-sub">
          about {{ usd(current.tip.amountOutUsd) }}, from {{ chainName(current.tip.originChain) }}
        </p>
        <p v-if="current.tip.message" class="alert-msg">“{{ current.tip.message }}”</p>
      </div>

      <div v-else-if="current && current.kind === 'goal'" :key="current.key" class="alert alert-goal" role="status">
        <p class="goal-kicker">Goal reached</p>
        <p class="goal-name">{{ current.goal.title }}</p>
        <p class="alert-sub">{{ usd(current.goal.raised) }} raised. Thank you!</p>
      </div>
    </Transition>

    <div v-if="goal" class="goal-corner">
      <GoalBar :key="goal.id" :goal="goal" compact />
    </div>

    <p v-if="demo" class="pill demo-pill">Demo alerts</p>
    <p v-else-if="problem" class="pill problem-pill" role="alert">{{ problem }}</p>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { CreatorPublicResponse, GoalWithProgress, OverlayTip, PollPendingResponse } from '~~/types/api'
import type { TipRow } from '~~/types/db'
import { chainName } from '~~/utils/chains'
import { formatUsd, tokenAmountForUsd } from '~~/utils/format'

// OBS browser source. Transparent, no chrome.
// Tips arrive two ways, deduplicated by id: Supabase realtime (instant) and
// /api/poll-pending every few seconds (which also settles open tips with 1Click,
// and is the fallback when realtime is not configured).

type Alert =
  | { key: string; kind: 'tip'; tip: OverlayTip; onShow?: () => void }
  | { key: string; kind: 'goal'; goal: GoalWithProgress }

const POLL_MS = 6_000
/** Re-ask for tips delivered this long before the last poll, in case a write landed late. */
const OVERLAP_MS = 30_000
const TIP_MS = 6_500
const GOAL_MS = 9_000
/** Leave transition plus a short gap between alerts. */
const GAP_MS = 900
const MAX_QUEUE = 30
/** On load, a goal completed this recently still gets its celebration (once). */
const FRESH_GOAL_MS = 2 * 60_000
const CELEBRATED_KEY = 'cgt_celebrated_goals'

const DEMO_NAMES = ['Ada', 'Kemi', 'Tobi', 'Lena', 'Marco', 'Yuki', null, 'Priya', 'Sam', 'Ifeoma']
const DEMO_MESSAGES = [
  'Love the stream!', 'For the new mic', 'Greetings from Lagos', null, 'Keep it up',
  'That last round was wild', null, 'Coffee is on me', 'Sent from Solana, landed on NEAR. Magic.'
]
const DEMO_TOKENS: Array<{ symbol: string; chain: string; price: number; decimals: number }> = [
  { symbol: 'USDC', chain: 'base', price: 1, decimals: 6 },
  { symbol: 'ETH', chain: 'arb', price: 3600, decimals: 18 },
  { symbol: 'SOL', chain: 'sol', price: 93, decimals: 9 },
  { symbol: 'NEAR', chain: 'near', price: 3.9, decimals: 24 },
  { symbol: 'USDT', chain: 'tron', price: 1, decimals: 6 },
  { symbol: 'BTC', chain: 'btc', price: 77000, decimals: 8 }
]

function pick<T>(xs: readonly T[]): T {
  return xs[Math.floor(Math.random() * xs.length)]!
}

function flag(v: unknown): boolean {
  return v === '1' || v === 'true'
}

function errStatus(err: unknown): number {
  return (err as { statusCode?: number })?.statusCode ?? 0
}

function loadCelebrated(): Set<string> {
  try {
    const raw = localStorage.getItem(CELEBRATED_KEY)
    const ids: unknown = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}

export default defineComponent({
  name: 'OverlayPage',
  setup() {
    definePageMeta({ layout: 'bare' })
    const route = useRoute()
    const handle = String(route.params.handle || '').toLowerCase()
    const q = route.query
    const scaleRaw = Number(q.scale)
    useHead({
      title: `Overlay @${handle}`,
      meta: [{ name: 'robots', content: 'noindex' }],
      htmlAttrs: { class: 'is-overlay' },
      bodyAttrs: { class: 'is-overlay' }
    })
    return {
      handle,
      compact: flag(q.compact),
      sound: q.sound !== '0' && q.sound !== 'false',
      demo: flag(q.demo),
      scale: Number.isFinite(scaleRaw) && scaleRaw > 0 ? Math.min(3, Math.max(0.5, scaleRaw)) : 1,
      chime: useChime(),
      // Kept out of reactive data: a realtime channel is a class instance, not state.
      rt: { channel: null as RealtimeChannel | null }
    }
  },
  data() {
    return {
      creatorId: '',
      destSymbol: '',
      goal: null as GoalWithProgress | null,
      queue: [] as Alert[],
      current: null as Alert | null,
      seen: new Set<string>(),
      celebratedIds: new Set<string>(),
      /** Server time of the first poll. Tips delivered before it are history, not alerts. */
      loadedAt: '',
      lastServerTime: '',
      initialized: false,
      failures: 0,
      problem: '',
      polling: false,
      pollAgain: false,
      pollTimer: null as ReturnType<typeof setInterval> | null,
      soonTimer: null as ReturnType<typeof setTimeout> | null,
      alertTimer: null as ReturnType<typeof setTimeout> | null,
      demoTimer: null as ReturnType<typeof setTimeout> | null,
      demoCycle: 0
    }
  },
  computed: {
    coinCount(): number {
      if (this.current?.kind === 'goal') return this.compact ? 30 : 60
      return this.compact ? 12 : 24
    }
  },
  mounted() {
    this.celebratedIds = loadCelebrated()
    // A normal browser tab blocks audio until the first click. OBS does not.
    window.addEventListener('pointerdown', this.chime.unlock, { once: true })
    if (this.demo) void this.startDemo()
    else void this.startLive()
  },
  beforeUnmount() {
    window.removeEventListener('pointerdown', this.chime.unlock)
    for (const t of [this.soonTimer, this.alertTimer, this.demoTimer]) if (t) clearTimeout(t)
    if (this.pollTimer) clearInterval(this.pollTimer)
    const sb = useSupabase()
    if (sb && this.rt.channel) void sb.removeChannel(this.rt.channel)
  },
  methods: {
    chainName,
    usd(v: number): string { return formatUsd(v) || '$0.00' },

    // ---- Alert queue ----------------------------------------------------
    enqueue(a: Alert) {
      if (this.queue.length >= MAX_QUEUE) {
        // A flood of tips: drop the oldest queued tip, never a goal celebration.
        const i = this.queue.findIndex((x) => x.kind === 'tip')
        if (i >= 0) this.queue.splice(i, 1)
      }
      // A goal celebration plays right after the current alert, ahead of later tips.
      if (a.kind === 'goal') this.queue.unshift(a)
      else this.queue.push(a)
      this.showNext()
    },
    enqueueTip(tip: OverlayTip, onShow?: () => void) {
      if (this.seen.has(tip.id)) return
      this.seen.add(tip.id)
      this.enqueue({ key: `tip-${tip.id}`, kind: 'tip', tip, onShow })
    },
    showNext() {
      if (this.current || !this.queue.length) return
      const next = this.queue.shift()!
      this.current = next
      if (next.kind === 'tip') next.onShow?.()
      if (this.sound) {
        if (next.kind === 'goal') this.chime.goal()
        else this.chime.tip()
      }
      const extra = next.kind === 'tip' && next.tip.message ? Math.min(3000, next.tip.message.length * 25) : 0
      // Busy queue: keep each alert a little shorter so the backlog clears.
      const busy = this.queue.length > 3 ? 0.6 : 1
      this.alertTimer = setTimeout(() => {
        this.current = null
        this.alertTimer = setTimeout(() => {
          this.alertTimer = null
          this.showNext()
        }, GAP_MS)
      }, ((next.kind === 'goal' ? GOAL_MS : TIP_MS) + extra) * busy)
    },

    // ---- Goal -----------------------------------------------------------
    markCelebrated(id: string) {
      this.celebratedIds.add(id)
      if (this.demo) return // demo goals repeat on every load
      try {
        localStorage.setItem(CELEBRATED_KEY, JSON.stringify([...this.celebratedIds].slice(-20)))
      } catch { /* storage blocked */ }
    },
    applyGoal(g: GoalWithProgress | null) {
      const prev = this.goal
      this.goal = g
      if (!g || !g.completed || this.celebratedIds.has(g.id)) return
      const crossedNow = this.initialized && prev?.id === g.id && !prev.completed
      const justBeforeLoad = !this.initialized && g.completedAt !== null &&
        Date.now() - new Date(g.completedAt).getTime() < FRESH_GOAL_MS
      if (crossedNow || justBeforeLoad || this.demo) {
        this.markCelebrated(g.id)
        this.enqueue({ key: `goal-${g.id}`, kind: 'goal', goal: g })
      } else {
        // Already complete before this overlay opened: no celebration, just the bar.
        this.celebratedIds.add(g.id)
      }
    },

    // ---- Live mode ------------------------------------------------------
    async startLive() {
      await this.poll()
      this.pollTimer = setInterval(() => { void this.poll() }, POLL_MS)
    },
    /** Poll shortly, coalescing bursts (realtime events often come in pairs). */
    pollSoon() {
      if (this.soonTimer) return
      this.soonTimer = setTimeout(() => {
        this.soonTimer = null
        void this.poll()
      }, 1200)
    },
    async poll() {
      if (this.polling) { this.pollAgain = true; return }
      this.polling = true
      try {
        const since = this.lastServerTime
          ? new Date(Math.max(new Date(this.loadedAt).getTime(), new Date(this.lastServerTime).getTime() - OVERLAP_MS)).toISOString()
          : undefined
        const res = await $fetch<PollPendingResponse>('/api/poll-pending', {
          method: 'POST',
          body: { handle: this.handle, since }
        })
        this.failures = 0
        this.problem = ''
        if (!this.initialized) {
          this.loadedAt = res.serverTime
          this.creatorId = res.creator.id
          this.destSymbol = res.creator.destSymbol
          this.subscribe()
        }
        this.lastServerTime = res.serverTime
        for (const t of res.delivered) this.enqueueTip(t)
        this.applyGoal(res.goal)
        this.initialized = true
      } catch (err) {
        if (errStatus(err) === 404) {
          this.problem = `No tip page at @${this.handle}. Check the overlay link.`
          if (this.pollTimer) clearInterval(this.pollTimer)
          this.pollTimer = null
        } else if (++this.failures >= 3) {
          this.problem = 'Reconnecting…'
        }
      } finally {
        this.polling = false
        if (this.pollAgain) { this.pollAgain = false; this.pollSoon() }
      }
    },
    subscribe() {
      const sb = useSupabase()
      if (!sb || this.rt.channel) return
      const filter = `creator_id=eq.${this.creatorId}`
      this.rt.channel = sb
        .channel(`overlay-${this.creatorId}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'cz_tips', filter }, (payload) => {
          const row = payload.new as Partial<TipRow>
          if (row.status === 'success') {
            if (row.id && row.settled_at && new Date(row.settled_at).getTime() >= new Date(this.loadedAt).getTime()) {
              this.enqueueTip({
                id: row.id,
                tipperName: row.tipper_name ?? null,
                message: row.message ?? null,
                amountIn: row.amount_in_formatted ?? row.amount_in ?? '',
                originSymbol: row.origin_asset_symbol ?? '',
                originChain: row.origin_chain ?? '',
                amountOut: row.amount_out_formatted ?? null,
                amountOutUsd: row.amount_out_usd ?? row.quote_out_usd ?? null,
                destSymbol: this.destSymbol,
                settledAt: row.settled_at
              })
            }
            this.pollSoon() // refresh goal progress
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'cz_goals', filter }, () => this.pollSoon())
        .subscribe()
    },

    // ---- Demo mode (?demo=1): fake alerts, no money, no writes ------------
    async startDemo() {
      let title = 'New microphone'
      let target = 100
      let raised = 0
      try {
        const res = await $fetch<CreatorPublicResponse>(`/api/creators/${encodeURIComponent(this.handle)}`)
        if (res.goal) {
          title = res.goal.title
          target = res.goal.targetAmount
          raised = res.goal.completed ? 0 : res.goal.raised
        }
      } catch { /* unknown handle is fine in demo mode */ }
      this.demoGoal(title, target, raised)
      this.initialized = true
      const tick = () => {
        if (this.queue.length < 2) this.demoTip()
        this.demoTimer = setTimeout(tick, 5_000 + Math.random() * 3_000)
      }
      this.demoTimer = setTimeout(tick, 1_200)
    },
    demoGoal(title: string, target: number, raised: number) {
      const r = Math.round(raised * 100) / 100
      this.applyGoal({
        id: `demo-${this.demoCycle}`,
        title,
        targetAmount: target,
        raised: r,
        percent: Math.min(100, Math.round((r / target) * 1000) / 10),
        tipCount: 0,
        completed: r >= target,
        completedAt: r >= target ? new Date().toISOString() : null,
        unit: 'USD'
      })
    },
    demoTip() {
      const g = this.goal
      // After a celebration, start the goal over so recording can loop.
      if (g?.completed) {
        // Wait for the celebration to finish before resetting the bar.
        if (this.current?.kind === 'goal' || this.queue.some((a) => a.kind === 'goal')) return
        this.demoCycle++
        this.demoGoal(g.title, g.targetAmount, 0)
      }
      const token = pick(DEMO_TOKENS)
      // Size fake tips to the goal, so it takes several alerts to fill.
      const target = g?.targetAmount ?? 100
      const usdValue = Math.max(1, Math.round(target * (0.08 + Math.random() * 0.14) * 100) / 100)
      const id = `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      this.enqueueTip({
        id,
        tipperName: pick(DEMO_NAMES),
        message: pick(DEMO_MESSAGES),
        amountIn: tokenAmountForUsd(usdValue, token.price, token.decimals),
        originSymbol: token.symbol,
        originChain: token.chain,
        amountOut: null,
        amountOutUsd: usdValue,
        destSymbol: this.destSymbol || 'USDC',
        settledAt: new Date().toISOString()
      }, () => {
        // Move the bar when this alert appears, not when it was queued.
        const cur = this.goal
        if (cur) this.demoGoal(cur.title, cur.targetAmount, cur.raised + usdValue)
      })
    }
  }
})
</script>

<style scoped>
.stage {
  position: fixed;
  top: 0;
  left: 0;
  width: calc(100vw / var(--s));
  height: calc(100vh / var(--s));
  transform: scale(var(--s));
  transform-origin: 0 0;
  overflow: hidden;
  color: #fff;
  font-family: var(--font);
}

.alert {
  position: absolute;
  top: 48px;
  left: 50%;
  width: min(640px, calc(100% - 48px));
  transform: translateX(-50%);
  padding: 22px 28px;
  border-radius: 20px;
  background: rgba(26, 26, 26, 0.9);
  border: 3px solid var(--coral);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
  text-align: center;
  z-index: 2;
}
.alert p { margin: 0; }
.alert-line { font-size: 1.9rem; font-weight: 700; line-height: 1.25; overflow-wrap: anywhere; }
.who { color: var(--coral); }
.amt { color: #FFC94A; white-space: nowrap; }
.alert-sub { margin-top: 6px !important; font-size: 1rem; color: #E8DCD5; }
.alert-msg { margin-top: 12px !important; font-size: 1.25rem; font-style: italic; color: #FFF8F0; overflow-wrap: anywhere; }

.alert-goal { border-color: #FFC94A; padding: 28px 32px; }
.goal-kicker {
  font-size: 1rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: #FFC94A;
}
.goal-name { font-size: 2.4rem; font-weight: 800; line-height: 1.15; margin-top: 4px !important; overflow-wrap: anywhere; }

.alert-enter-active { transition: transform 0.5s cubic-bezier(.2, 1.4, .4, 1), opacity 0.3s ease; }
.alert-leave-active { transition: transform 0.5s ease, opacity 0.5s ease; }
.alert-enter-from { opacity: 0; transform: translate(-50%, -30px) scale(0.92); }
.alert-leave-to { opacity: 0; transform: translate(-50%, -12px); }
.alert-goal.alert-enter-from { transform: translate(-50%, 0) scale(0.6); }

.goal-corner {
  position: absolute;
  right: 20px;
  bottom: 20px;
  width: 320px;
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(26, 26, 26, 0.82);
  z-index: 1;
}
.goal-corner :deep(.goal-title) { color: #fff; font-size: 0.95rem; }
.goal-corner :deep(.goal-foot) { color: #E8DCD5; }
.goal-corner :deep(.goal-foot strong) { color: #fff; }
.goal-corner :deep(.done-badge) { white-space: nowrap; }
.goal-corner :deep(.track) { background: rgba(255, 255, 255, 0.18); border-color: rgba(255, 255, 255, 0.25); }

.pill {
  position: absolute;
  top: 12px;
  left: 12px;
  margin: 0;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  background: rgba(26, 26, 26, 0.75);
  color: #fff;
  z-index: 3;
}
.problem-pill { background: rgba(179, 38, 30, 0.9); }

/* ?compact=1: smaller alert and goal panel for busy layouts. */
.compact .alert { top: 20px; width: min(420px, calc(100% - 32px)); padding: 14px 18px; border-radius: 14px; border-width: 2px; }
.compact .alert-line { font-size: 1.3rem; }
.compact .alert-sub { font-size: 0.85rem; }
.compact .alert-msg { font-size: 1rem; margin-top: 8px !important; }
.compact .goal-name { font-size: 1.6rem; }
.compact .goal-corner :deep(.done-badge) { display: none; }
.compact .goal-corner { width: 240px; padding: 8px 10px; right: 12px; bottom: 12px; }
</style>

<style>
/* The OBS browser source must be see-through. */
html.is-overlay, body.is-overlay { background: transparent !important; overflow: hidden; }
</style>
