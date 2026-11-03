<template>
  <span class="copy-wrap">
    <button type="button" class="btn btn-ghost btn-sm" :aria-label="ariaLabel || `Copy ${label}`" @click="copy">
      <span aria-hidden="true">{{ copied ? '✓' : '⧉' }}</span>
      {{ copied ? 'Copied' : label }}
    </button>
    <span class="sr-only" aria-live="polite">{{ copied ? 'Copied to clipboard' : '' }}</span>
  </span>
</template>

<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'CopyButton',
  props: {
    value: { type: String, required: true },
    label: { type: String, default: 'Copy' },
    ariaLabel: { type: String, default: '' }
  },
  data() {
    return { copied: false, timer: 0 as ReturnType<typeof setTimeout> | 0 }
  },
  beforeUnmount() {
    if (this.timer) clearTimeout(this.timer)
  },
  methods: {
    async copy() {
      try {
        await navigator.clipboard.writeText(this.value)
      } catch {
        // Fallback for browsers without the async clipboard API (or non-secure contexts).
        const ta = document.createElement('textarea')
        ta.value = this.value
        ta.setAttribute('readonly', '')
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        try { document.execCommand('copy') } catch { /* nothing else to try */ }
        document.body.removeChild(ta)
      }
      this.copied = true
      if (this.timer) clearTimeout(this.timer)
      this.timer = setTimeout(() => { this.copied = false }, 1800)
    }
  }
})
</script>
