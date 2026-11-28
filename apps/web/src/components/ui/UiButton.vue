<script setup lang="ts">
withDefaults(defineProps<{
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  loading?: boolean;
  block?: boolean;
}>(), {
  variant: "primary",
  size: "md",
  type: "button",
  disabled: false,
  loading: false,
  block: false,
});
</script>

<template>
  <button
    v-bind="$attrs"
    class="ui-button"
    :class="[`ui-button--${variant}`, `ui-button--${size}`, { 'is-block': block, 'is-loading': loading }]"
    :type="type"
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
  >
    <span v-if="loading" class="ui-button-spinner" aria-hidden="true"></span>
    <slot />
  </button>
</template>
