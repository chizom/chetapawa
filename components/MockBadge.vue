<template>
  <div v-if="flags && flags.mock" :class="['mock', variant]" role="status">
    <strong>MOCK mode:</strong> payments are fake. Do not send real funds.
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue'

export default defineComponent({
  name: 'MockBadge',
  props: {
    /** "bar" = full-width strip in page flow (never covers content). "corner" = fixed pill for the OBS overlay. */
    variant: { type: String as PropType<'bar' | 'corner'>, default: 'bar' }
  },
  async setup() {
    const { data: flags } = await useAppFlags()
    return { flags }
  }
})
</script>

<style scoped>
.mock {
  background: #FFD400;
  color: var(--charcoal);
  font-size: 0.8rem;
  font-weight: 600;
}
.bar {
  padding: 6px 16px;
  text-align: center;
  border-bottom: 2px solid var(--charcoal);
}
.corner {
  position: fixed;
  left: 12px;
  bottom: 12px;
  z-index: 1000;
  padding: 6px 12px;
  border-radius: 999px;
  border: 2px solid var(--charcoal);
}
</style>
