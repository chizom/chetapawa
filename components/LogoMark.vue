<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 32 32"
    role="img"
    aria-label="Chetapawa logo"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="15" cy="15" r="10" fill="none" stroke="#FF6B4A" stroke-width="5" />
    <path d="M20 20 L27 27" stroke="#B44226" stroke-width="5" stroke-linecap="round" />
  </svg>
</template>

<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'LogoMark',
  props: {
    size: { type: Number, default: 28 }
  }
})
</script>
