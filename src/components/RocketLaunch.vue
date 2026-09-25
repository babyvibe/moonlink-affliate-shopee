<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  /** idle | ignition | ascent | orbit | reentry | signal */
  phase: { type: String, default: 'idle' },
  message: { type: String, default: '' },
})

const emit = defineEmits(['done'])

const visible = ref(false)
const caption = ref('')

watch(
  () => props.phase,
  (phase) => {
    if (phase === 'idle') {
      visible.value = false
      return
    }
    visible.value = true
    if (phase === 'ignition') caption.value = 'Đánh lửa…'
    if (phase === 'ascent') caption.value = 'Cất cánh rời bệ phóng'
    if (phase === 'orbit') caption.value = 'Bay vòng quỹ đạo — chờ tín hiệu từ trạm'
    if (phase === 'reentry') caption.value = 'Đang hạ cánh về trạm'
    if (phase === 'signal') {
      caption.value = props.message || 'Tín hiệu đã ổn định'
      window.setTimeout(() => {
        visible.value = false
        emit('done')
      }, 1100)
    }
  },
  { immediate: true }
)
</script>

<template>
  <div
    v-if="visible"
    class="rocket-stage"
    :class="`is-${phase}`"
    aria-live="polite"
    :aria-label="caption"
  >
    <div class="cosmos" aria-hidden="true">
      <i v-for="n in 48" :key="`s-${n}`" class="cosmo-star" :style="{
        left: `${(n * 41.3) % 100}%`,
        top: `${(n * 67.7) % 100}%`,
        animationDelay: `${(n % 11) * -0.4}s`,
        opacity: 0.25 + ((n * 13) % 60) / 100,
        width: n % 7 === 0 ? '3px' : n % 3 === 0 ? '2px' : '1px',
        height: n % 7 === 0 ? '3px' : n % 3 === 0 ? '2px' : '1px',
      }" />
      <div class="cosmo-nebula nebula-a" />
      <div class="cosmo-nebula nebula-b" />
      <div class="cosmo-nebula nebula-c" />
      <div class="planet">
        <div class="planet-ring" />
        <div class="planet-glow" />
      </div>
      <div class="orbit-track track-wide" />
      <div class="orbit-track track-mid" />
      <div class="launch-pad">
        <div class="pad-moon">
          <i class="pad-crater c1" /><i class="pad-crater c2" /><i class="pad-crater c3" />
        </div>
      </div>
    </div>

    <!-- Tên lửa bay trên path quỹ đạo -->
    <div class="rocket-path">
      <div class="rocket-wrap">
        <div class="rocket">
          <svg viewBox="0 0 64 120" class="rocket-svg" aria-hidden="true">
            <defs>
              <linearGradient id="bodyGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#f4f7ff" />
                <stop offset="55%" stop-color="#c5ccff" />
                <stop offset="100%" stop-color="#6d78c9" />
              </linearGradient>
              <linearGradient id="flameGrad" x1="0.5" y1="0" x2="0.5" y2="1">
                <stop offset="0%" stop-color="#fff7c2" />
                <stop offset="35%" stop-color="#ffb347" />
                <stop offset="70%" stop-color="#ff5a1f" />
                <stop offset="100%" stop-color="#ff2a6d" stop-opacity="0.2" />
              </linearGradient>
            </defs>
            <!-- flame -->
            <g class="flame">
              <ellipse cx="32" cy="108" rx="10" ry="18" fill="url(#flameGrad)" />
              <ellipse cx="32" cy="102" rx="5" ry="12" fill="#fff3b0" opacity="0.9" />
            </g>
            <!-- fins -->
            <path d="M18 78 L8 98 L22 90 Z" fill="#5a63b8" />
            <path d="M46 78 L56 98 L42 90 Z" fill="#5a63b8" />
            <!-- body -->
            <path d="M32 6 C44 28 48 52 46 88 L18 88 C16 52 20 28 32 6 Z" fill="url(#bodyGrad)" />
            <!-- window -->
            <circle cx="32" cy="42" r="8" fill="#0d1330" stroke="#9aa7ff" stroke-width="2" />
            <circle cx="32" cy="42" r="4" fill="#7ce5ed" opacity="0.85" />
            <!-- nose tip -->
            <circle cx="32" cy="10" r="3" fill="#ff8fab" />
            <!-- stripes -->
            <rect x="20" y="68" width="24" height="4" rx="2" fill="#8898e2" opacity="0.7" />
            <rect x="20" y="76" width="24" height="3" rx="1.5" fill="#8898e2" opacity="0.45" />
          </svg>
          <div class="exhaust">
            <i /><i /><i /><i /><i /><i />
          </div>
        </div>
      </div>
    </div>

    <!-- Trail đốm lửa -->
    <div class="spark-field" aria-hidden="true">
      <i v-for="n in 18" :key="`sp-${n}`" class="spark" :style="{
        left: `${10 + ((n * 29) % 80)}%`,
        animationDelay: `${(n % 9) * 0.12}s`,
      }" />
    </div>

    <div class="rocket-caption">
      <span class="caption-dot" />
      {{ caption }}
    </div>

    <div v-if="phase === 'signal'" class="signal-badge">
      <span class="signal-check">✓</span>
      Tín hiệu đã ổn định
    </div>
  </div>
</template>
