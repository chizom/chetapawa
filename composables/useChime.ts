// Tiny synthesized alert sounds (Web Audio), so the overlay ships no audio files.
// OBS browser sources allow audio without a click. A normal browser tab may block it
// until the page is clicked once; failures are silent.

type Note = [freq: number, at: number, len: number]

const TIP: Note[] = [[988, 0, 0.12], [1319, 0.09, 0.35]]
const GOAL: Note[] = [[523, 0, 0.18], [659, 0.14, 0.18], [784, 0.28, 0.18], [1047, 0.42, 0.6], [1319, 0.42, 0.6]]

let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  if (import.meta.server) return null
  if (ctx) return ctx
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  try { ctx = new Ctor() } catch { ctx = null }
  return ctx
}

function play(notes: Note[], volume: number): void {
  const a = audio()
  if (!a) return
  if (a.state === 'suspended') void a.resume().catch(() => {})
  const t0 = a.currentTime + 0.02
  for (const [freq, at, len] of notes) {
    const osc = a.createOscillator()
    const gain = a.createGain()
    osc.type = 'triangle'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0, t0 + at)
    gain.gain.linearRampToValueAtTime(volume, t0 + at + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + len)
    osc.connect(gain).connect(a.destination)
    osc.start(t0 + at)
    osc.stop(t0 + at + len + 0.05)
  }
}

export function useChime() {
  return {
    tip: () => play(TIP, 0.18),
    goal: () => play(GOAL, 0.16),
    /** Call from a click handler to unlock audio in a normal browser tab. */
    unlock: () => { const a = audio(); if (a?.state === 'suspended') void a.resume().catch(() => {}) }
  }
}
