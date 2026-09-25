<script setup>
const props = defineProps({
  ready: Boolean,
  loading: Boolean,
  /** idle | ignition | ascent | orbit | reentry | signal */
  phase: { type: String, default: 'idle' },
})
const emit = defineEmits(['launch'])

function launch() {
  if (!props.loading) emit('launch')
}

const rockets = [
  { id: 1, delay: '0s', radius: '72px', size: 42, dur: '1.7s' },
  { id: 2, delay: '0.12s', radius: '96px', size: 34, dur: '2.1s' },
  { id: 3, delay: '0.24s', radius: '58px', size: 28, dur: '1.45s' },
  { id: 4, delay: '0.36s', radius: '112px', size: 30, dur: '2.4s' },
]
</script>

<template>
  <section
    class="moon-zone"
    :class="[
      {
        'is-ready': ready,
        'is-loading': loading,
        'is-launching': phase !== 'idle' && phase !== 'signal',
        'is-success': phase === 'signal',
      },
      `phase-${phase}`,
    ]"
    aria-label="Nút kiểm tra"
  >
    <div class="orbit orbit-one"><i /></div>
    <div class="orbit orbit-two" />
    <div class="launch-ring ring-a" />
    <div class="launch-ring ring-b" />

    <!-- Đội tên lửa bay quanh nút -->
    <div class="rocket-fleet" aria-hidden="true">
      <div
        v-for="r in rockets"
        :key="r.id"
        class="fleet-rocket"
        :class="`rocket-${r.id}`"
        :style="{
          '--delay': r.delay,
          '--radius': r.radius,
          '--dur': r.dur,
          width: `${r.size}px`,
          height: `${r.size * 1.7}px`,
        }"
      >
        <div class="fleet-rocket-inner">
          <svg viewBox="0 0 40 72">
            <defs>
              <linearGradient :id="`body${r.id}`" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#ffffff" />
                <stop offset="55%" stop-color="#c8d0ff" />
                <stop offset="100%" stop-color="#6d78c9" />
              </linearGradient>
              <linearGradient :id="`flame${r.id}`" x1="0.5" y1="0" x2="0.5" y2="1">
                <stop offset="0%" stop-color="#fff7c2" />
                <stop offset="40%" stop-color="#ffb347" />
                <stop offset="100%" stop-color="#ff2a6d" stop-opacity="0.1" />
              </linearGradient>
            </defs>
            <g class="fleet-flame">
              <ellipse cx="20" cy="68" rx="8" ry="14" :fill="`url(#flame${r.id})`" />
              <ellipse cx="20" cy="63" rx="4" ry="9" fill="#fff3b0" />
            </g>
            <path d="M12 50 L5 66 L14 58 Z" fill="#5a63b8" />
            <path d="M28 50 L35 66 L26 58 Z" fill="#5a63b8" />
            <path d="M20 3 C28 18 31 36 29 56 L11 56 C9 36 12 18 20 3 Z" :fill="`url(#body${r.id})`" />
            <circle cx="20" cy="28" r="5.5" fill="#0d1330" stroke="#9aa7ff" stroke-width="1.6" />
            <circle cx="20" cy="28" r="2.4" fill="#7ce5ed" />
            <circle cx="20" cy="8" r="2.2" fill="#ff8fab" />
            <rect x="14" y="44" width="12" height="2.5" rx="1" fill="#8898e2" opacity="0.7" />
          </svg>
          <!-- trail lửa -->
          <span class="trail t1" /><span class="trail t2" /><span class="trail t3" />
        </div>
      </div>
    </div>

    <button
      class="moon-button"
      type="button"
      :disabled="loading"
      :aria-label="loading ? 'Đang tra tiền hoàn' : ready ? 'Chạm để xem tiền hoàn' : 'Dán link để bắt đầu'"
      @click="launch"
    >
      <span class="moon-surface" aria-hidden="true">
        <i class="crater crater-one" /><i class="crater crater-two" /><i class="crater crater-three" /><i class="crater crater-four" />
        <b class="moon-star">✦</b>
        <b class="moon-check">✓</b>
      </span>
      <span class="moon-label">
        {{ loading ? 'Đang tra…' : ready ? 'Xem tiền hoàn' : 'Chờ link' }}
      </span>
    </button>

    <div v-if="phase === 'signal'" class="moon-success-badge">✓ Thành công</div>
    <div v-if="phase === 'orbit'" class="moon-orbit-caption">Tên lửa đang bay quanh…</div>

    <p class="moon-help">
      {{ loading ? 'Một lát thôi…' : ready ? 'Chạm mặt trăng' : 'Dán link vào ô bên trái' }}
    </p>
  </section>
</template>
