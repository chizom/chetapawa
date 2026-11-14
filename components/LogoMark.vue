<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 32 32"
    role="img"
    aria-label="Chetapawa logo"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect x="1" y="1" width="30" height="30" rx="8" fill="#FF6B4A" />
    <path d="M18.5 4.5 L8.5 18 H15 L13 27.5 L23.5 13.5 H17 Z" fill="#1A1A1A" stroke="#1A1A1A" stroke-width="1" stroke-linejoin="round" />
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
