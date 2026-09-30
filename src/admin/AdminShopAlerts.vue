<script setup>
import { onMounted, ref } from 'vue'
import { api } from '../services/api.js'

const loading = ref(false)
const scanning = ref(false)
const error = ref('')
const msg = ref('')
const shops = ref([])
const alerts = ref([])
const newShopId = ref('')
const newNote = ref('')
const onlyNew = ref(false)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [shopsResult, alertsResult] = await Promise.all([
      api.watchedShops(),
      api.commissionAlerts(onlyNew.value ? 'new' : ''),
    ])
    shops.value = shopsResult.shops || []
    alerts.value = alertsResult.alerts || []
  } catch (requestError) {
    error.value = requestError.message
  } finally {
    loading.value = false
  }
}

async function addShop() {
  error.value = ''
  msg.value = ''
  try {
    await api.addWatchedShop(newShopId.value.trim(), newNote.value.trim() || null)
    newShopId.value = ''
    newNote.value = ''
    msg.value = 'Đã thêm shop vào danh sách theo dõi.'
    await load()
  } catch (requestError) {
    error.value = requestError.message
  }
}

async function removeShop(shopId) {
  try {
    await api.removeWatchedShop(shopId)
    await load()
  } catch (requestError) {
    error.value = requestError.message
  }
}

async function scan() {
  scanning.value = true
  error.value = ''
  msg.value = ''
  try {
    const result = await api.scanCommissionAlerts(7)
    msg.value = `Quét ${result.scanned} shop · ${result.newAlerts} cảnh báo mới.`
    await load()
  } catch (requestError) {
    error.value = requestError.message
  } finally {
    scanning.value = false
  }
}

async function setStatus(id, status) {
  try {
    await api.updateCommissionAlert(id, status)
    await load()
  } catch (requestError) {
    error.value = requestError.message
  }
}

onMounted(load)
</script>

<template>
  <section class="admin-panel" aria-labelledby="shop-alerts-title">
    <div class="panel-head">
      <h2 id="shop-alerts-title">Cảnh báo hoa hồng shop</h2>
      <p class="cell-sub">Theo dõi shop quen thuộc · quét thay đổi 7 ngày · giảm ≥ 0.5 điểm %</p>
    </div>

    <div v-if="error" class="admin-error" role="alert">{{ error }}</div>
    <div v-if="msg" class="admin-success" role="status">{{ msg }}</div>

    <form class="filter-row" @submit.prevent="addShop">
      <label>
        Shop ID
        <input v-model="newShopId" type="text" placeholder="123456" :disabled="loading" />
      </label>
      <label>
        Ghi chú
        <input v-model="newNote" type="text" placeholder="shop áo len" :disabled="loading" />
      </label>
      <button class="secondary-button" type="submit" :disabled="loading || !newShopId.trim()">Thêm shop</button>
      <button class="copy-button" type="button" :disabled="scanning || loading || !shops.length" @click="scan">
        {{ scanning ? 'Đang quét…' : 'Quét 7 ngày' }}
      </button>
    </form>

    <h3>Shop đang theo dõi ({{ shops.length }})</h3>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Shop</th>
            <th>Ghi chú</th>
            <th>Lần đổi gần nhất</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="shop in shops" :key="shop.shopId">
            <td>
              <div class="cell-title">{{ shop.shopName || `Shop #${shop.shopId}` }}</div>
              <div class="cell-sub">ID {{ shop.shopId }}</div>
            </td>
            <td>{{ shop.note || '—' }}</td>
            <td>
              <template v-if="shop.lastFromRate != null">
                {{ shop.lastFromRate }}% → {{ shop.lastToRate }}%
              </template>
              <template v-else>—</template>
            </td>
            <td>
              <button class="text-button" type="button" @click="removeShop(shop.shopId)">Xóa</button>
            </td>
          </tr>
          <tr v-if="!shops.length">
            <td colspan="4">Chưa theo dõi shop nào.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <h3 style="margin-top: 18px;">
      Cảnh báo
      <label class="batch-check" style="float: right; font-weight: 400;">
        <input v-model="onlyNew" type="checkbox" @change="load" /> Chỉ hiện mới
      </label>
    </h3>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Shop</th>
            <th>Thay đổi</th>
            <th>Delta</th>
            <th>Số ngày data</th>
            <th>Trạng thái</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="alert in alerts" :key="alert.id">
            <td>
              <div class="cell-title">{{ alert.shopName || `Shop #${alert.shopId}` }}</div>
              <div class="cell-sub">{{ alert.windowDays }} ngày</div>
            </td>
            <td>{{ alert.fromRate }}% → {{ alert.toRate }}%</td>
            <td :class="alert.delta < 0 ? 'status-error' : ''">{{ alert.delta }} điểm</td>
            <td>
              {{ alert.points }}
              <span v-if="(alert.points || 0) < 2" class="cell-sub"> · ít data</span>
            </td>
            <td>{{ alert.status }}</td>
            <td>
              <button v-if="alert.status === 'new'" class="text-button" type="button" @click="setStatus(alert.id, 'seen')">Đã xem</button>
              <button v-if="alert.status !== 'ignored'" class="text-button" type="button" @click="setStatus(alert.id, 'ignored')">Bỏ qua</button>
            </td>
          </tr>
          <tr v-if="!alerts.length">
            <td colspan="6">Chưa có cảnh báo nào.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
