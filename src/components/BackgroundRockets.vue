<script setup>
const props = defineProps({
  /** idle | ignition | ascent | orbit | reentry | signal */
  phase: { type: String, default: 'idle' },
})

const ships = [
  { id: 'bg1', top: '12%', dur: '3.2s', delay: '0s', scale: 0.7, dir: 'ltr' },
  { id: 'bg2', top: '28%', dur: '4s', delay: '0.35s', scale: 0.5, dir: 'rtl' },
  { id: 'bg3', top: '48%', dur: '3.6s', delay: '0.7s', scale: 0.85, dir: 'ltr' },
  { id: 'bg4', top: '68%', dur: '4.4s', delay: '0.2s', scale: 0.55, dir: 'rtl' },
  { id: 'bg5', top: '82%', dur: '3.8s', delay: '0.55s', scale: 0.65, dir: 'ltr' },
]

const flying = () => ['ignition', 'ascent', 'orbit', 'reentry'].includes(props.phase)
</script>

<template>
  <div class="bg-rockets" :class="{ 'is-active': flying() }" aria-hidden="true">
    <!-- vòng quanh mặt trăng lớn -->
    <div class="bg-moon-orbit">
      <div class="bg-moon-ship ship-a">
        <svg viewBox="0 0 40 72"><path d="M20 3 C28 18 31 36 29 56 L11 56 C9 36 12 18 20 3 Z" fill="#aab4ff" opacity="0.75" /><ellipse cx="20" cy="66" rx="7" ry="11" fill="#ff8c42" opacity="0.55" /></svg>
      </div>
      <div class="bg-moon-ship ship-b">
        <svg viewBox="0 0 40 72"><path d="M20 3 C28 18 31 36 29 56 L11 56 C9 36 12 18 20 3 Z" fill="#8fd3ff" opacity="0.55" /><ellipse cx="20" cy="66" rx="7" ry="11" fill="#ffb347" opacity="0.4" /></svg>
      </div>
    </div>

    <!-- tên lửa ngang background -->
    <div
      v-for="ship in ships"
      :key="ship.id"
      class="bg-ship"
      :class="ship.dir"
      :style="{
        top: ship.top,
        animationDuration: ship.dur,
        animationDelay: ship.delay,
        transform: `scale(${ship.scale})`,
      }"
    >
      <div class="bg-ship-body">
        <svg viewBox="0 0 48 28">
          <ellipse cx="38" cy="14" rx="10" ry="5" fill="#ff8c42" opacity="0.35" />
          <path d="M4 14 C12 6 28 6 36 14 C28 22 12 22 4 14 Z" fill="#c5ccff" opacity="0.7" />
          <circle cx="30" cy="14" r="3" fill="#7ce5ed" opacity="0.8" />
          <path d="M8 14 L0 8 L2 14 L0 20 Z" fill="#6d7ee0" opacity="0.7" />
        </svg>
      </div>
      <span class="bg-trail" />
    </div>
  </div>
</template>
