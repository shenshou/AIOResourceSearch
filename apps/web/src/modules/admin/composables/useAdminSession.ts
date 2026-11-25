import { ref } from "vue";

/**
 * One in-memory administrator session shared by management modules.
 * Credentials are never persisted to browser storage.
 */
const token = ref("");
const authenticated = ref(false);
const generation = ref(0);

export function useAdminSession() {
  function setToken(value: string) {
    generation.value += 1;
    token.value = value;
    authenticated.value = false;
  }

  function clear() {
    generation.value += 1;
    token.value = "";
    authenticated.value = false;
  }

  return { token, authenticated, generation, setToken, clear };
}
