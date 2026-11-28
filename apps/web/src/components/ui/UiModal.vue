<script setup lang="ts">
withDefaults(defineProps<{ modelValue: boolean; title?: string; width?: string }>(), { width: "640px" });
const emit = defineEmits<{ "update:modelValue": [value: boolean]; close: [] }>();
function close() {
  emit("update:modelValue", false);
  emit("close");
}
</script>

<template>
  <Teleport to="body">
    <div v-if="modelValue" class="ui-modal-backdrop" @click.self="close" @keydown.esc="close">
      <section class="ui-modal" role="dialog" aria-modal="true" :aria-label="title" :style="{ width: `min(${width}, calc(100% - 32px))` }">
        <header class="ui-modal-header">
          <h2 v-if="title">{{ title }}</h2>
          <slot name="header" />
          <button class="ui-modal-close" type="button" aria-label="关闭" @click="close">×</button>
        </header>
        <div class="ui-modal-body"><slot /></div>
        <footer v-if="$slots.footer" class="ui-modal-footer"><slot name="footer" /></footer>
      </section>
    </div>
  </Teleport>
</template>
