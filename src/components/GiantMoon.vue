<script setup>
import { onMounted, onUnmounted, ref } from 'vue'

const shiftX = ref(0)
const shiftY = ref(0)

function onMove(event) {
  const nx = (event.clientX / window.innerWidth - 0.5) * 2
  const ny = (event.clientY / window.innerHeight - 0.5) * 2
  shiftX.value = nx * 18
  shiftY.value = ny * 12
}

onMounted(() => window.addEventListener('mousemove', onMove, { passive: true }))
onUnmounted(() => window.removeEventListener('mousemove', onMove))
</script>

<template>
  <div class="giant-moon-layer" aria-hidden="true">
    <div
      class="giant-moon"
      :style="{ transform: `translate3d(${shiftX}px, ${shiftY}px, 0)` }"
    >
      <div class="giant-halo" />
      <div class="giant-disk">
        <div class="giant-earthshine" />
        <div class="giant-terminator" />
        <i class="g-crater g1" />
        <i class="g-crater g2" />
        <i class="g-crater g3" />
        <i class="g-crater g4" />
        <i class="g-crater g5" />
        <i class="g-crater g6" />
        <i class="g-crater g7" />
        <i class="g-mare m1" />
        <i class="g-mare m2" />
        <i class="g-mare m3" />
        <div class="giant-spec" />

        <!-- Cờ Việt Nam cắm trên mặt trăng -->
        <div class="vn-flag-pole">
          <div class="vn-flag-pole-line" />
          <div class="vn-flag">
            <svg viewBox="0 0 30 20" class="vn-flag-svg">
              <rect width="30" height="20" fill="#da251d" />
              <polygon
                fill="#ffff00"
                points="15,3.2 16.8,8.6 22.5,8.6 17.9,11.9 19.7,17.3 15,14 10.3,17.3 12.1,11.9 7.5,8.6 13.2,8.6"
              />
            </svg>
          </div>
          <div class="vn-flag-base" />
        </div>

        <!-- Người chạy nhảy vui đùa trên mặt trăng -->
        <div class="moon-folk">
          <!-- runner -->
          <svg class="folk folk-run" viewBox="0 0 40 48">
            <circle cx="22" cy="8" r="5" fill="#ffd27a" />
            <path d="M22 13 L20 28 L28 26 L26 14 Z" fill="#ff8c42" />
            <path d="M20 28 L12 40" stroke="#ff8c42" stroke-width="3" stroke-linecap="round" fill="none" />
            <path d="M28 26 L34 38" stroke="#ff8c42" stroke-width="3" stroke-linecap="round" fill="none" />
            <path d="M22 16 L12 12" stroke="#ffd27a" stroke-width="2.5" stroke-linecap="round" />
            <path d="M22 18 L32 14" stroke="#ffd27a" stroke-width="2.5" stroke-linecap="round" />
          </svg>

          <!-- jumper -->
          <svg class="folk folk-jump" viewBox="0 0 40 48">
            <circle cx="20" cy="8" r="5" fill="#9ae6ff" />
            <path d="M20 13 L20 26 L20 13 Z" fill="#6d7ee0" />
            <rect x="15" y="13" width="10" height="14" rx="3" fill="#6d7ee0" />
            <path d="M17 27 L10 36" stroke="#6d7ee0" stroke-width="3" stroke-linecap="round" />
            <path d="M23 27 L30 34" stroke="#6d7ee0" stroke-width="3" stroke-linecap="round" />
            <path d="M16 16 L8 8" stroke="#9ae6ff" stroke-width="2.5" stroke-linecap="round" />
            <path d="M24 16 L32 6" stroke="#9ae6ff" stroke-width="2.5" stroke-linecap="round" />
          </svg>

          <!-- dancer / play -->
          <svg class="folk folk-dance" viewBox="0 0 40 48">
            <circle cx="20" cy="8" r="5" fill="#ffb3c6" />
            <rect x="15" y="13" width="10" height="13" rx="3" fill="#ff5a8a" />
            <path d="M16 26 L14 38" stroke="#ff5a8a" stroke-width="3" stroke-linecap="round" />
            <path d="M24 26 L28 38" stroke="#ff5a8a" stroke-width="3" stroke-linecap="round" />
            <path d="M16 16 L6 20" stroke="#ffb3c6" stroke-width="2.5" stroke-linecap="round" />
            <path d="M24 16 L34 12" stroke="#ffb3c6" stroke-width="2.5" stroke-linecap="round" />
            <!-- bóng nhỏ / vui đùa -->
            <circle cx="36" cy="6" r="3" fill="#7ce5ed" opacity="0.85" />
          </svg>

          <!-- child waving -->
          <svg class="folk folk-wave" viewBox="0 0 36 44">
            <circle cx="18" cy="8" r="4.5" fill="#c4f7c4" />
            <rect x="13" y="12" width="10" height="12" rx="3" fill="#5ad46a" />
            <path d="M15 24 L12 35" stroke="#5ad46a" stroke-width="2.5" stroke-linecap="round" />
            <path d="M21 24 L24 35" stroke="#5ad46a" stroke-width="2.5" stroke-linecap="round" />
            <path d="M14 15 L8 8" stroke="#c4f7c4" stroke-width="2.5" stroke-linecap="round" />
            <path d="M22 15 L30 10" stroke="#c4f7c4" stroke-width="2.5" stroke-linecap="round" />
          </svg>
        </div>
      </div>
    </div>
    <div class="giant-orbit-ring" />
  </div>
</template>
