<template>
  <svg
    class="hero-art"
    viewBox="0 0 400 320"
    role="img"
    aria-labelledby="hero-art-title hero-art-desc"
    xmlns="http://www.w3.org/2000/svg"
  >
    <title id="hero-art-title">How a tip travels</title>
    <desc id="hero-art-desc">
      Tokens from different chains flow through NEAR Intents into the creator's wallet.
      A tip alert pops up and the creator's goal bar fills.
    </desc>

    <!-- Backdrop -->
    <rect x="8" y="16" width="384" height="288" rx="28" fill="#FFE3DA" />
    <circle cx="226" cy="282" r="5" fill="#FF6B4A" />
    <circle cx="36" cy="286" r="4" fill="#B44226" />
    <path d="M232 36 l4 9 9 4 -9 4 -4 9 -4 -9 -9 -4 9 -4z" fill="#FF6B4A" />

    <!-- Flows: coins to hub, hub to phone -->
    <g fill="none" stroke="#B44226" stroke-width="3" stroke-linecap="round" class="flow">
      <path d="M78 84 C 120 84, 130 140, 158 152" />
      <path d="M78 164 L 158 164" />
      <path d="M78 244 C 120 244, 130 188, 158 176" />
      <path d="M222 164 L 252 164" />
    </g>

    <!-- Coins from different chains (labels only, no brand logos) -->
    <g font-family="Sora, system-ui, sans-serif" font-weight="800" text-anchor="middle">
      <circle cx="56" cy="84" r="24" fill="#1A1A1A" />
      <text x="56" y="89" font-size="13" fill="#FFF8F0">SOL</text>
      <circle cx="56" cy="164" r="24" fill="#FF6B4A" />
      <text x="56" y="169" font-size="13" fill="#1A1A1A">ETH</text>
      <circle cx="56" cy="244" r="24" fill="#FFFFFF" stroke="#1A1A1A" stroke-width="3" />
      <text x="56" y="249" font-size="13" fill="#1A1A1A">BTC</text>
    </g>

    <!-- NEAR Intents hub -->
    <g font-family="Sora, system-ui, sans-serif" text-anchor="middle">
      <rect x="158" y="130" width="64" height="68" rx="16" fill="#1A1A1A" />
      <text x="190" y="160" font-size="11" font-weight="800" fill="#FFF8F0">NEAR</text>
      <text x="190" y="175" font-size="9" font-weight="600" fill="#FFE3DA">Intents</text>
    </g>

    <!-- Creator tip page on a phone -->
    <g font-family="Sora, system-ui, sans-serif">
      <rect x="252" y="44" width="124" height="232" rx="20" fill="#FFFFFF" stroke="#1A1A1A" stroke-width="3" />
      <rect x="296" y="54" width="36" height="5" rx="2.5" fill="#EADBD2" />
      <circle cx="282" cy="88" r="14" fill="#FF6B4A" />
      <text x="282" y="93" font-size="13" font-weight="800" fill="#1A1A1A" text-anchor="middle">A</text>
      <rect x="302" y="80" width="58" height="7" rx="3.5" fill="#1A1A1A" />
      <rect x="302" y="92" width="40" height="5" rx="2.5" fill="#EADBD2" />

      <text x="268" y="128" font-size="9" font-weight="700" fill="#5C5550">GOAL</text>
      <text x="268" y="143" font-size="11" font-weight="800" fill="#1A1A1A">New mic</text>
      <rect x="268" y="152" width="92" height="10" rx="5" fill="#FFE3DA" />
      <rect x="268" y="152" width="66" height="10" rx="5" fill="#FF6B4A" class="goal-fill" />
      <text x="268" y="176" font-size="9" font-weight="600" fill="#5C5550">$70 of $100</text>

      <rect x="268" y="236" width="92" height="24" rx="12" fill="#B44226" />
      <text x="314" y="252" font-size="10" font-weight="700" fill="#FFFFFF" text-anchor="middle">Send a tip</text>
    </g>

    <!-- Tip alert -->
    <g class="alert" font-family="Sora, system-ui, sans-serif">
      <rect x="200" y="192" width="140" height="44" rx="14" fill="#FF6B4A" stroke="#1A1A1A" stroke-width="3" />
      <text x="214" y="211" font-size="11" font-weight="800" fill="#1A1A1A">Ada tipped $5</text>
      <text x="214" y="226" font-size="9" font-weight="600" fill="#1A1A1A">"Power your goals!"</text>
    </g>
  </svg>
</template>

<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({ name: 'HeroArt' })
</script>

<style scoped>
.hero-art { display: block; width: 100%; height: auto; max-width: 440px; margin: 0 auto; }
.flow path { stroke-dasharray: 6 8; animation: flow 1.4s linear infinite; }
.alert { animation: bob 3s ease-in-out infinite; transform-origin: 270px 214px; }
@keyframes flow { to { stroke-dashoffset: -28; } }
@keyframes bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
</style>
