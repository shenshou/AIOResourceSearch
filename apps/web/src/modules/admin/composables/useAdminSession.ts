import { ref } from "vue";

/**
 * One in-memory administrator session shared by management modules.
 * Credentials are never persisted to browser storage.
 */
const token = ref("");
const authenticated = ref(false);

export function useAdminSession() {
  function clear() {
    token.value = "";
    authenticated.value = false;
  }

  return { token, authenticated, clear };
}
