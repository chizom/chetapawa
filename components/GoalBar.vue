<template>
  <div class="goal" :class="{ done: goal.completed, compact }" role="group" :aria-label="`Goal: ${goal.title}`">
    <div class="goal-head">
      <span class="goal-title">{{ goal.title }}</span>
      <span v-if="goal.completed" class="badge done-badge">Goal reached</span>
    </div>
    <div
      class="track"
      role="progressbar"
      :aria-valuenow="goal.percent"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuetext="`${money(goal.raised)} of ${money(goal.targetAmount)} raised`"
    >
      <div class="fill" :style="{ width: shown + '%' }" />
    </div>
    <div class="goal-foot">
      <span><strong>{{ money(goal.raised) }}</strong> of {{ money(goal.targetAmount) }}</span>
      <span>{{ goal.percent }}%</span>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue'
import type { GoalWithProgress } from '~~/types/api'
import { formatUsd } from '~~/utils/format'

export default defineComponent({
  name: 'GoalBar',
  props: {
    goal: { type: Object as PropType<GoalWithProgress>, required: true },
    compact: { type: Boolean, default: false }
  },
  data() {
    // Start at 0 and animate to the real value after mount.
    return { shown: 0 }
  },
  watch: {
    'goal.percent'(v: number) { this.shown = v }
  },
  mounted() {
    requestAnimationFrame(() => { this.shown = this.goal.percent })
  },
  methods: {
    money(v: number): string { return formatUsd(v) || '$0.00' }
  }
})
</script>

<style scoped>
.goal { display: flex; flex-direction: column; gap: 8px; }
.goal-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.goal-title { font-weight: 700; }
.track {
  height: 14px; border-radius: 999px; background: var(--peach); overflow: hidden;
  border: 1px solid #F6C7B8;
}
.fill {
  height: 100%; width: 0; border-radius: 999px;
  background: linear-gradient(90deg, var(--coral), var(--rust));
  transition: width 1.2s cubic-bezier(.2, .8, .2, 1);
}
.done .fill { background: linear-gradient(90deg, #2FA36B, var(--ok)); }
.done-badge { background: #DDF3E7; color: var(--ok); }
.goal-foot { display: flex; justify-content: space-between; font-size: 0.85rem; color: var(--muted); }
.goal-foot strong { color: var(--text); }
.compact { gap: 4px; }
.compact .track { height: 10px; }
</style>
