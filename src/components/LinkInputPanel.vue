<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  status: { type: String, default: 'Dán link sản phẩm để xem tiền hoàn.' },
  error: { type: String, default: '' },
  hint: { type: String, default: '' },
  valid: Boolean,
  loading: Boolean
})
const emit = defineEmits(['update:modelValue', 'submit'])
const clipboardHint = ref('')
const hasValue = computed(() => Boolean(props.modelValue.trim()))

async function pasteLink() {
  clipboardHint.value = ''
  try {
    const text = await navigator.clipboard.readText()
    emit('update:modelValue', text)
  } catch {
    clipboardHint.value = 'Chưa đọc được clipboard — hãy dán thủ công vào ô bên trên.'
  }
}

function submit() {
  if (!props.loading) emit('submit')
}
</script>

<template>
  <section class="control-panel" aria-labelledby="launch-title">
    <div class="panel-kicker"><span /> Bắt đầu</div>
    <h2 id="launch-title">Kiểm tra tiền hoàn</h2>
    <label for="shopee-link">Link sản phẩm Shopee</label>
    <div
      class="link-field"
      :class="{ 'has-error': error, 'is-ready': valid, 'is-invalid': hasValue && !valid && !loading }"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.07.07l2-2A5 5 0 0 0 12 4l-1.15 1.15M14 11a5 5 0 0 0-7.07-.07l-2 2A5 5 0 0 0 12 20l1.15-1.15" /></svg>
      <input
        id="shopee-link"
        :value="modelValue"
        autocomplete="url"
        inputmode="url"
        placeholder="Dán link Shopee vào đây"
        :disabled="loading"
        @input="emit('update:modelValue', $event.target.value)"
        @keydown.enter.prevent="submit"
      />
      <span v-if="hasValue && valid" class="link-badge ok">✓</span>
      <span v-else-if="hasValue && !valid && error" class="link-badge bad">✕</span>
      <button v-if="hasValue" class="icon-button" type="button" aria-label="Xóa" :disabled="loading" @click="emit('update:modelValue', '')">
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m7 7 10 10M17 7 7 17" /></svg>
      </button>
    </div>
    <div class="input-actions">
      <button class="secondary-button" type="button" :disabled="loading" @click="pasteLink">
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M9 4h6v4H9zM7 8h10v12H7zM5 12H3V6a2 2 0 0 1 2-2h2" /></svg>
        Dán link
      </button>
      <span class="input-status" :class="{ 'status-error': error, 'status-ok': hint && !error }" role="status">
        {{ error || clipboardHint || hint || status }}
      </span>
    </div>
  </section>
</template>
