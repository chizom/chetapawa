<template>
  <div class="stepper-wrap">
    <ol class="stepper" aria-label="Tip progress">
      <li v-for="(s, i) in steps" :key="s.key" :class="stepClass(i)" :aria-current="i === current && !finalBad ? 'step' : undefined">
        <span class="dot" aria-hidden="true">
          <template v-if="i < current || (i === current && status === 'success')">✓</template>
          <template v-else>{{ i + 1 }}</template>
        </span>
        <span class="lbl">{{ s.label }}</span>
      </li>
    </ol>
    <p class="sr-only" aria-live="polite">{{ liveText }}</p>
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue'
import type { TipStatus } from '~~/types/api'

const STEPS = [
  { key: 'wait', label: 'Waiting for deposit' },
  { key: 'proc', label: 'Processing' },
  { key: 'done', label: 'Delivered' }
]

export default defineComponent({
  name: 'TipStepper',
  props: {
    status: { type: String as PropType<TipStatus>, required: true }
  },
  computed: {
    steps() { return STEPS },
    current(): number {
      if (this.status === 'success') return 2
      if (this.status === 'processing' || this.status === 'refunded' || this.status === 'failed') return 1
      return 0
    },
    finalBad(): boolean {
      return ['refunded', 'failed', 'expired'].includes(this.status)
    },
    liveText(): string {
      switch (this.status) {
        case 'pending': return 'Waiting for your deposit.'
        case 'processing': return 'Deposit received. Processing.'
        case 'success': return 'Delivered.'
        case 'refunded': return 'Tip refunded.'
        case 'failed': return 'Tip failed.'
        case 'expired': return 'Deposit address expired.'
        default: return ''
      }
    }
  },
  methods: {
    stepClass(i: number): Record<string, boolean> {
      return {
        done: i < this.current || (i === this.current && this.status === 'success'),
        active: i === this.current && !this.finalBad && this.status !== 'success',
        bad: i === this.current && this.finalBad
      }
    }
  }
})
</script>

<style scoped>
.stepper { list-style: none; display: flex; gap: 0; margin: 0; padding: 0; }
.stepper li { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; position: relative; text-align: center; }
.stepper li + li::before {
  content: ''; position: absolute; top: 15px; right: 50%; width: 100%; height: 3px;
  background: var(--border); z-index: 0;
}
.stepper li.done + li::before, .stepper li.done + li.done::before { background: var(--ok); }
.dot {
  position: relative; z-index: 1;
  width: 32px; height: 32px; border-radius: 50%;
  display: grid; place-items: center; font-weight: 700; font-size: 0.85rem;
  background: #fff; border: 2px solid var(--border); color: var(--muted);
}
.lbl { font-size: 0.78rem; color: var(--muted); line-height: 1.25; }
.done .dot { background: var(--ok); border-color: var(--ok); color: #fff; }
.done .lbl { color: var(--text); }
.active .dot { border-color: var(--rust); color: var(--rust); animation: pulse 1.4s ease-in-out infinite; }
.active .lbl { color: var(--text); font-weight: 600; }
.bad .dot { background: var(--danger); border-color: var(--danger); color: #fff; }
.bad .lbl { color: var(--danger); font-weight: 600; }
@keyframes pulse { 50% { box-shadow: 0 0 0 6px rgba(180, 66, 38, 0.15); } }
</style>
