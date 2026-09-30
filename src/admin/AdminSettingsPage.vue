<script setup>
import { onMounted, ref } from 'vue'
import { api } from '../services/api.js'

const emit = defineEmits(['saved'])

const loading = ref(false)
const saving = ref(false)
const error = ref('')
const savedMsg = ref('')
const items = ref([])
const form = ref({})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const result = await api.adminSettings()
    items.value = result.items || []
    const next = {}
    for (const item of items.value) {
      // secret đang bị mask → để trống, giữ giá trị cũ khi save
      next[item.key] = item.type === 'secret' && item.configured ? '' : item.value
    }
    form.value = next
  } catch (requestError) {
    error.value = requestError.message
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  error.value = ''
  savedMsg.value = ''
  try {
    const result = await api.adminUpdateSettings(form.value)
    items.value = result.items || items.value
    const next = {}
    for (const item of items.value) {
      next[item.key] = item.type === 'secret' && item.configured ? '' : item.value
    }
    form.value = next
    savedMsg.value = 'Đã lưu cài đặt — áp dụng ngay, không cần khởi động lại.'
    emit('saved')
    window.setTimeout(() => { savedMsg.value = '' }, 3500)
  } catch (requestError) {
    error.value = requestError.message
  } finally {
    saving.value = false
  }
}

function isCookieField(key) {
  return key === 'shopee_cookie' || key === 'shopeefood_cookie'
}

onMounted(load)
</script>

<template>
  <section class="admin-panel settings-panel" aria-labelledby="settings-title">
    <div class="panel-head">
      <h2 id="settings-title">Cài đặt hệ thống</h2>
      <p class="cell-sub">
        Sửa API key, Affiliate ID, tỷ lệ hoàn… lưu trong database —
        <strong>không cần sửa .env hay deploy lại</strong>.
        Tài khoản admin vẫn nằm ở <code>.env</code>.
      </p>
    </div>

    <div v-if="error" class="admin-error" role="alert">{{ error }}</div>
    <div v-if="savedMsg" class="admin-success" role="status">{{ savedMsg }}</div>

    <!-- J2Team guide: hàng riêng, full-width -->
    <details class="j2team-guide">
      <summary>🍪 Cookie Shopee — cách lấy bằng J2Team Cookies</summary>
      <div class="j2team-body">
        <p><strong>Tính năng cần cookie:</strong></p>
        <ul>
          <li><strong>Đơn ShopeeFood</strong> — xem lịch sử đơn hàng đã đặt</li>
          <li><em>Đơn/click Shopee Affiliate đọc qua Addlivetag — cookie kết nối ở addlivetag.com, không cần dán ở đây.</em></li>
        </ul>

        <p><strong>Cách lấy cookie bằng J2Team Cookies:</strong></p>
        <ol>
          <li>Cài tiện ích <a href="https://chromewebstore.google.com/detail/j2team-cookies/okpidcojpimokonjdbjjehnjadooppkj" target="_blank" rel="noopener noreferrer">J2Team Cookies</a> cho Chrome/Edge.</li>
          <li>Đăng nhập tài khoản Shopee trên trình duyệt.</li>
          <li>Bấm icon <strong>J2Team Cookies</strong> → <strong>Get Cookies</strong> → <strong>Copy</strong> (dạng JSON hoặc chuỗi).</li>
          <li>Dán vào ô <strong>Cookie Shopee Affiliate</strong> bên dưới → <strong>Lưu cài đặt</strong>.</li>
        </ol>

        <p class="cell-sub">
          ⚠️ Cookie là <strong>thông tin đăng nhập</strong> — chỉ lưu ở máy chủ của bạn, không chia sẻ cho người khác.
          Nếu Shopee đăng xuất / đổi mật khẩu thì cookie hết hạn → lấy lại bằng J2Team.
        </p>
      </div>
    </details>

    <div v-if="loading" class="cell-sub">Đang tải cài đặt…</div>

    <form v-else class="settings-form" @submit.prevent="save">
      <div v-for="item in items" :key="item.key" class="setting-field">
        <label :for="`set-${item.key}`">
          {{ item.label }}
          <span v-if="item.type === 'secret'" class="setting-hint">
            {{ item.configured ? 'Đã cấu hình — để trống nếu không muốn thay' : 'Chưa cấu hình' }}
          </span>
        </label>

        <!-- Cookie / nội dung dài → textarea -->
        <textarea
          v-if="isCookieField(item.key)"
          :id="`set-${item.key}`"
          v-model="form[item.key]"
          rows="3"
          :placeholder="item.type === 'secret' && item.configured ? '•••••••• (giữ nguyên)' : item.placeholder"
          :disabled="saving"
          spellcheck="false"
        />

        <input
          v-else-if="item.type === 'number'"
          :id="`set-${item.key}`"
          v-model="form[item.key]"
          type="number"
          :min="item.min"
          :max="item.max"
          :placeholder="item.placeholder"
          :disabled="saving"
        />
        <input
          v-else
          :id="`set-${item.key}`"
          v-model="form[item.key]"
          :type="item.type === 'secret' ? 'password' : 'text'"
          :placeholder="item.type === 'secret' && item.configured ? '•••••••• (giữ nguyên)' : item.placeholder"
          autocomplete="off"
          :disabled="saving"
        />
      </div>

      <div class="settings-actions">
        <button class="copy-button" type="submit" :disabled="saving">
          {{ saving ? 'Đang lưu…' : 'Lưu cài đặt' }}
        </button>
        <button class="secondary-button" type="button" :disabled="saving || loading" @click="load">
          Tải lại
        </button>
      </div>
    </form>
  </section>
</template>
