<template>
  <div class="rain" :class="{ big }" aria-hidden="true">
    <span
      v-for="p in pieces"
      :key="p.id"
      :class="['piece', p.kind]"
      :style="{
        left: p.x + '%',
        width: p.size + 'px',
        height: (p.kind === 'confetti' ? p.size * 0.45 : p.size) + 'px',
        animationDelay: p.delay + 's',
        animationDuration: p.fall + 's',
        '--drift': p.drift + 'px',
        '--tilt': p.tilt + 'deg'
      }"
    >
      <span
        class="inner"
        :style="{ animationDuration: p.spin + 's', background: p.color }"
      />
    </span>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'

// Falling coins for a tip alert. With `big`, more coins plus brand-colored confetti
// for a goal celebration. Pieces are generated once per mount, so remount (change
// the key) to replay.

interface Piece {
  id: number
  kind: 'coin' | 'confetti'
  x: number
  size: number
  delay: number
  fall: number
  spin: number
  drift: number
  tilt: number
  color: string
}

const CONFETTI = ['#FF6B4A', '#B44226', '#FFE3DA', '#FFF8F0', '#FFC94A']

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

export default defineComponent({
  name: 'CoinRain',
  props: {
    count: { type: Number, default: 22 },
    big: { type: Boolean, default: false }
  },
  data() {
    return { pieces: [] as Piece[] }
  },
  mounted() {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const coins = reduced ? Math.min(6, this.count) : this.count
    const confetti = this.big && !reduced ? Math.round(this.count * 1.2) : 0
    const out: Piece[] = []
    for (let i = 0; i < coins + confetti; i++) {
      const coin = i < coins
      out.push({
        id: i,
        kind: coin ? 'coin' : 'confetti',
        x: rand(2, 96),
        size: coin ? rand(this.big ? 28 : 22, this.big ? 52 : 40) : rand(10, 18),
        delay: rand(0, this.big ? 2.2 : 1.2),
        fall: rand(this.big ? 3.2 : 2.4, this.big ? 5 : 3.6),
        spin: rand(0.5, 1.1),
        drift: rand(-80, 80),
        tilt: rand(-50, 50),
        color: coin ? '' : CONFETTI[i % CONFETTI.length]!
      })
    }
    this.pieces = out
  }
})
</script>

<style scoped>
.rain { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
.piece {
  position: absolute;
  top: -70px;
  display: block;
  animation-name: fall;
  animation-timing-function: cubic-bezier(.35, .1, .7, 1);
  animation-fill-mode: both;
}
.inner {
  display: block;
  width: 100%;
  height: 100%;
  animation: flip linear infinite;
}
.coin .inner {
  border-radius: 50%;
  background:
    radial-gradient(circle at 35% 30%, #FFF3C4 0 14%, transparent 15%),
    radial-gradient(circle at 50% 50%, #FFC94A 0 52%, #E9A21E 53% 62%, #FFC94A 63% 100%) !important;
  box-shadow: inset 0 0 0 3px #B44226, 0 2px 6px rgba(26, 26, 26, 0.35);
}
.confetti .inner { border-radius: 2px; animation-name: flutter; }

@keyframes fall {
  0% { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 0; }
  8% { opacity: 1; }
  85% { opacity: 1; }
  100% { transform: translate3d(var(--drift), 115vh, 0) rotate(var(--tilt)); opacity: 0; }
}
@keyframes flip {
  0%, 100% { transform: scaleX(1); }
  50% { transform: scaleX(0.15); }
}
@keyframes flutter {
  0% { transform: rotate(0deg) scaleY(1); }
  50% { transform: rotate(180deg) scaleY(0.3); }
  100% { transform: rotate(360deg) scaleY(1); }
}
</style>
