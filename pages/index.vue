<template>
  <div class="container">
    <section class="hero">
      <span class="badge">Runs on NEAR Intents</span>
      <h1>Tips from anywhere, paid where you want.</h1>
      <p class="lead">
        Fans tip with any token on any chain. You get the asset you picked, straight to your own wallet.
        We never touch the money.
      </p>
      <NuxtLink to="/create" class="btn btn-primary">Create your tip page</NuxtLink>
    </section>

    <section class="steps" aria-labelledby="how-title">
      <h2 id="how-title">How it works</h2>
      <ol class="step-list">
        <li class="card">
          <span class="num" aria-hidden="true">1</span>
          <h3>Make your page</h3>
          <p class="muted">Pick a handle, your payout address, and the token you want to receive.</p>
        </li>
        <li class="card">
          <span class="num" aria-hidden="true">2</span>
          <h3>Fans send anything</h3>
          <p class="muted">They pick a token they hold on any chain and get a deposit address and QR code.</p>
        </li>
        <li class="card">
          <span class="num" aria-hidden="true">3</span>
          <h3>You get paid</h3>
          <p class="muted">NEAR Intents swaps and bridges it. Your asset lands in your wallet. Your overlay cheers.</p>
        </li>
      </ol>
    </section>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({ name: 'LandingPage' })
</script>

<style scoped>
.hero { padding: 24px 0 40px; max-width: 640px; }
.hero .badge { margin-bottom: 16px; }
.lead { font-size: 1.1rem; color: var(--muted); margin-bottom: 24px; }
.step-list {
  list-style: none; padding: 0; margin: 0;
  display: grid; gap: 16px; grid-template-columns: 1fr;
}
@media (min-width: 720px) { .step-list { grid-template-columns: repeat(3, 1fr); } }
.step-list p { margin: 0; }
.num {
  display: inline-flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; border-radius: 50%;
  background: var(--coral); color: var(--charcoal); font-weight: 800; margin-bottom: 10px;
}
</style>
