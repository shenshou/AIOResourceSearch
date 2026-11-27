<script setup lang="ts">
import { ref, watch } from "vue";

const props = defineProps<{
  loading: boolean;
  authenticated: boolean;
  description: string;
}>();

const emit = defineEmits<{
  submit: [token: string];
}>();

const token = ref("");
const showToken = ref(false);

watch(
  () => props.authenticated,
  (authenticated) => {
    if (authenticated) token.value = "";
  },
);

function submit() {
  const value = token.value.trim();
  if (!value || props.loading) return;
  emit("submit", value);
}
</script>

<template>
  <div class="login-panel">
    <div class="login-icon" aria-hidden="true">⌘</div>
    <h2>管理员验证</h2>
    <p>{{ description }}</p>
    <form class="login-form" @submit.prevent="submit">
      <div class="token-field">
        <input
          v-model="token"
          :type="showToken ? 'text' : 'password'"
          autocomplete="off"
          placeholder="ADMIN_API_TOKEN"
          aria-label="管理员令牌"
        />
        <button type="button" class="visibility-button" @click="showToken = !showToken">
          {{ showToken ? "隐藏" : "显示" }}
        </button>
      </div>
      <button class="primary-button" type="submit" :disabled="loading || !token.trim()">
        {{ loading ? "验证中…" : "验证并进入管理" }}
      </button>
    </form>
  </div>
</template>
