<script setup>
import FoodStoreCard from '../../components/FoodStoreCard.vue'
import FoodOrdersCard from '../../components/FoodOrdersCard.vue'
</script>

<template>
  <section class="explore-tab" aria-labelledby="food-title">
    <header class="exp-head">
      <p class="section-kicker">Khám phá</p>
      <h1 id="food-title">Quán ăn ShopeeFood</h1>
      <p class="hero-copy">
        Tra thông tin quán (địa chỉ, giờ mở cửa) và xem đơn ShopeeFood bạn đã đặt.
      </p>
    </header>

    <div class="food-layout">
      <div class="food-col">
        <h2 class="food-subtitle">Tra quán</h2>
        <FoodStoreCard />
      </div>
      <div class="food-col">
        <h2 class="food-subtitle">Đơn của tôi</h2>
        <FoodOrdersCard />
      </div>
    </div>
  </section>
</template>
