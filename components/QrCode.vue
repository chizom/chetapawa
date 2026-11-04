<template>
  <div class="qr" :style="{ width: size + 'px', height: size + 'px' }">
    <!-- SVG generated locally by the qrcode library from our own value: no remote content. -->
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div v-if="svg" class="qr-svg" role="img" :aria-label="label" v-html="svg" />
    <div v-else class="skeleton qr-svg" aria-hidden="true" />
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import QRCode from 'qrcode'

export default defineComponent({
  name: 'QrCode',
  props: {
    value: { type: String, required: true },
    size: { type: Number, default: 200 },
    label: { type: String, default: 'QR code' }
  },
  data() {
    return { svg: '' }
  },
  watch: {
    value: 'render'
  },
  mounted() {
    this.render()
  },
  methods: {
    async render() {
      try {
        this.svg = await QRCode.toString(this.value, {
          type: 'svg',
          errorCorrectionLevel: 'M',
          margin: 1,
          color: { dark: '#1A1A1A', light: '#FFFFFF' }
        })
      } catch {
        this.svg = ''
      }
    }
  }
})
</script>

<style scoped>
.qr { background: #fff; border-radius: var(--radius-sm); padding: 8px; border: 1px solid var(--border); }
.qr-svg { width: 100%; height: 100%; }
.qr-svg :deep(svg) { width: 100%; height: 100%; display: block; }
</style>
