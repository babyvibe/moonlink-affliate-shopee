<script setup>
import { onMounted, onUnmounted, reactive, ref } from 'vue'

const active = ref(false)
const pos = reactive({ x: -200, y: -200 })
const trail = ref([])

// Vùng “block” → không bật hiệu ứng chuột
const BLOCK_SELECTOR = [
  'button',
  'a',
  'input',
  'select',
  'textarea',
  'label',
  'header',
  'footer',
  'nav',
  'table',
  '.launcher',
  '.result-card',
  '.recent-section',
  '.how-section',
  '.admin-login',
  '.admin-reports',
  '.admin-panel',
  '.admin-form',
  '.cashback-card',
  '.product-preview',
  '.moon-button',
  '.control-panel',
  '.site-header',
  '.rocket-stage',
  '.signal-badge',
].join(',')

let trailId = 0
let mx = 0
let my = 0
let raf = 0

function isVoid(target) {
  if (!(target instanceof Element)) return false
  return !target.closest(BLOCK_SELECTOR)
}

function spawnSpark(x, y) {
  const id = ++trailId
  const item = {
    id,
    x: x + (Math.random() - 0.5) * 28,
    y: y + (Math.random() - 0.5) * 28,
    size: 2 + Math.random() * 3,
    hue: 180 + Math.random() * 60,
  }
  trail.value = [...trail.value, item].slice(-14)
  window.setTimeout(() => {
    trail.value = trail.value.filter((s) => s.id !== id)
  }, 700)
}

function tick() {
  pos.x += (mx - pos.x) * 0.22
  pos.y += (my - pos.y) * 0.22
  raf = window.requestAnimationFrame(tick)
}

function onMove(event) {
  mx = event.clientX
  my = event.clientY
  const voidZone = isVoid(event.target)
  active.value = voidZone
  if (voidZone && Math.random() > 0.55) {
    spawnSpark(event.clientX, event.clientY)
  }
}

function onLeave() {
  active.value = false
}

onMounted(() => {
  window.addEventListener('mousemove', onMove, { passive: true })
  window.addEventListener('mouseleave', onLeave)
  raf = window.requestAnimationFrame(tick)
})

onUnmounted(() => {
  window.removeEventListener('mousemove', onMove)
  window.removeEventListener('mouseleave', onLeave)
  window.cancelAnimationFrame(raf)
})
</script>

<template>
  <div class="void-cursor-layer" :class="{ 'is-active': active }" aria-hidden="true">
    <!-- vệt sao / bụi mặt trăng -->
    <i
      v-for="spark in trail"
      :key="spark.id"
      class="void-spark"
      :style="{
        left: `${spark.x}px`,
        top: `${spark.y}px`,
        width: `${spark.size}px`,
        height: `${spark.size}px`,
        background: `hsl(${spark.hue} 90% 75%)`,
      }"
    />

    <!-- quầng sáng theo chuột -->
    <div class="void-aura" :style="{ left: `${pos.x}px`, top: `${pos.y}px` }">
      <div class="void-core" />
      <div class="void-ring" />
      <div class="void-ring ring-b" />
      <div class="void-crescent" />
    </div>
  </div>
</template>
