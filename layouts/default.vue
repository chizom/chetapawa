<template>
  <div class="shell">
    <header class="site-header">
      <div class="container header-inner">
        <NuxtLink to="/" class="brand">
          <LogoMark :size="28" />
          <span>Chetapawa</span>
        </NuxtLink>
        <NuxtLink to="/create" class="btn btn-ghost btn-sm">Create page</NuxtLink>
      </div>
    </header>
    <main class="site-main">
      <slot />
    </main>
    <footer class="site-footer">
      <div class="container">
        <p class="muted">Non-custodial tips, settled by NEAR Intents. Built for the NEAR HACKATHON.</p>
      </div>
    </footer>
    <MockBadge />
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({ name: 'DefaultLayout' })
</script>

<style scoped>
.shell { min-height: 100vh; display: flex; flex-direction: column; }
.site-header { border-bottom: 1px solid var(--border); background: var(--cream); }
.header-inner { display: flex; align-items: center; justify-content: space-between; height: 64px; }
.brand {
  display: inline-flex; align-items: center; gap: 10px;
  font-weight: 800; color: var(--charcoal); text-decoration: none; letter-spacing: -0.01em;
}
.brand:hover { color: var(--charcoal); }
.site-main { flex: 1; padding: 32px 0 48px; }
.site-footer { border-top: 1px solid var(--border); padding: 20px 0; font-size: 0.85rem; }
.site-footer p { margin: 0; }
</style>
