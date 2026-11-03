<template>
  <div>
    <slot />
    <MockBadge />
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'

// Used by the OBS overlay: no header, no footer, transparent background.
export default defineComponent({ name: 'BareLayout' })
</script>
