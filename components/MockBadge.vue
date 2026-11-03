<template>
  <div v-if="flags && flags.mock" class="mock-badge" role="status">
    MOCK mode: payments are fake
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'MockBadge',
  async setup() {
    const { data: flags } = await useAppFlags()
    return { flags }
  }
})
</script>

<style scoped>
.mock-badge {
  position: fixed;
  left: 12px;
  bottom: 12px;
  z-index: 1000;
  padding: 6px 12px;
  border-radius: 999px;
  background: #FFD400;
  color: var(--charcoal);
  border: 2px solid var(--charcoal);
  font-weight: 800;
  font-size: 0.8rem;
  letter-spacing: 0.02em;
  box-shadow: var(--shadow);
}
</style>
