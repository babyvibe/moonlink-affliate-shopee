<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { api } from '../services/api.js'

const loading = ref(false)
const error = ref('')
const state = ref({ status: 'stopped', url: '' })
const copied = ref(false)
const pollTimer = ref(null)

async function refresh() {
  try {
    state.value = await api.adminTunnel()
    error.value = ''
  } catch (requestError) {
    error.value = requestError.message
  }
}

function startPolling() {
  stopPolling()
  pollTimer.value = window.setInterval(async () => {
    await refresh()
    if (state.value.status === 'running' || state.value.status === 'error' || state.value.status === 'stopped') {
      // đã có URL hoặc xong → ngừng poll
      if (state.value.status !== 'starting') stopPolling()
    }
  }, 1500)
}

function stopPolling() {
  if (pollTimer.value) {
    window.clearInterval(pollTimer.value)
    pollTimer.value = null
  }
}

async function start() {
  loading.value = true
  error.value = ''
  try {
    state.value = await api.adminTunnelStart()
    startPolling()
  } catch (requestError) {
    error.value = requestError.message
  } finally {
    loading.value = false
  }
}

async function stop() {
  loading.value = true
  try {
    state.value = await api.adminTunnelStop()
  } catch (requestError) {
    error.value = requestError.message
  } finally {
    loading.value = false
    stopPolling()
  }
}

async function copyUrl() {
  if (!state.value.url) return
  await navigator.clipboard.writeText(state.value.url)
  copied.value = true
  window.setTimeout(() => { copied.value = false }, 1800)
}

onMounted(refresh)
onUnmounted(stopPolling)
</script>

<template>
  <section class="admin-panel tunnel-panel" aria-labelledby="tunnel-title">
    <div class="panel-head">
      <h2 id="tunnel-title">Tạo host test (Cloudflare Tunnel)</h2>
      <p class="cell-sub">
        Bấm nút để tạo đường dẫn public dạng <code>https://xxx.trycloudflare.com</code> —
        mở trên điện thoại / gửi cho người khác test mà không cần cài đặt gì thêm.
      </p>
    </div>

    <div class="tunnel-status">
      <span class="tunnel-dot" :class="`st-${state.status}`" />
      <span>
        <template v-if="state.status === 'running'">Đang chạy</template>
        <template v-else-if="state.status === 'starting'">Đang khởi động…</template>
        <template v-else-if="state.status === 'error'">Lỗi</template>
        <template v-else>Chưa chạy</template>
      </span>
    </div>

    <div v-if="state.url" class="tunnel-url-box">
      <span class="cell-sub">Địa chỉ test</span>
      <a class="tunnel-url" :href="state.url" target="_blank" rel="noopener noreferrer">{{ state.url }}</a>
      <div class="tunnel-actions">
        <button class="copy-button" type="button" @click="copyUrl">
          {{ copied ? 'Đã sao chép' : 'Sao chép link' }}
        </button>
        <a class="secondary-button" :href="state.url" target="_blank" rel="noopener noreferrer">Mở test ↗</a>
      </div>
      <p class="cell-sub">
        Link này trỏ tới máy bạn — chỉ hoạt động khi server còn chạy.
        <strong>URL đổi mỗi lần khởi động lại.</strong>
      </p>
    </div>

    <p v-else-if="state.status === 'starting'" class="cell-sub">
      Đang kết nối Cloudflare… có thể mất vài giây.
    </p>

    <p v-if="state.error" class="admin-error" role="alert">{{ state.error }}</p>

    <div class="tunnel-actions">
      <button
        v-if="state.status !== 'running' && state.status !== 'starting'"
        class="copy-button"
        type="button"
        :disabled="loading"
        @click="start"
      >
        {{ loading ? 'Đang khởi động…' : 'Tạo link test' }}
      </button>
      <button
        v-else
        class="secondary-button"
        type="button"
        :disabled="loading"
        @click="stop"
      >
        Dừng tunnel
      </button>
      <button class="text-button" type="button" :disabled="loading" @click="refresh">Làm mới</button>
    </div>

    <details class="j2team-guide" style="margin-top: 18px;">
      <summary>💡 Lưu ý khi test</summary>
      <div class="j2team-body">
        <ul>
          <li>Server vẫn phải đang chạy (<code>pnpm dev</code> hoặc <code>pnpm start</code>).</li>
          <li>Link public → <strong>ai có link cũng mở được</strong> — không chia sẻ công khai nếu có dữ liệu nhạy cảm.</li>
          <li>Muốn host cố định (không đổi URL): dùng named tunnel của Cloudflare (cần tài khoản Cloudflare).</li>
          <li>Chạy thủ công ngoài terminal: <code>pnpm tunnel</code>.</li>
        </ul>
      </div>
    </details>
  </section>
</template>
