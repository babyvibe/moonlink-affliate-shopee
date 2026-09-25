<script setup>
import { computed } from 'vue'

const stars = computed(() => Array.from({ length: 74 }, (_, index) => ({
  id: index,
  left: `${(index * 37.7) % 100}%`,
  top: `${(index * 71.3) % 100}%`,
  size: `${index % 9 === 0 ? 3 : index % 3 === 0 ? 2 : 1}px`,
  delay: `${(index % 13) * -0.63}s`,
  opacity: 0.22 + ((index * 17) % 58) / 100
})))
</script>

<template>
  <div class="star-field" aria-hidden="true">
    <i v-for="star in stars" :key="star.id" class="star" :style="{
      left: star.left, top: star.top, width: star.size, height: star.size,
      opacity: star.opacity, animationDelay: star.delay
    }" />
    <div class="nebula nebula-one" />
    <div class="nebula nebula-two" />
  </div>
</template>
