<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from "vue";

const props = withDefaults(defineProps<{ modelValue: boolean; title?: string; width?: string }>(), { width: "640px" });
const emit = defineEmits<{ "update:modelValue": [value: boolean]; close: [] }>();
const dialog = ref<HTMLElement | null>(null);
let previouslyFocused: HTMLElement | null = null;

const focusableSelector = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

watch(() => props.modelValue, async (open) => {
  if (open) {
    previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    await nextTick();
    const firstFocusable = dialog.value?.querySelector<HTMLElement>(focusableSelector);
    (firstFocusable ?? dialog.value)?.focus();
    return;
  }

  previouslyFocused?.focus();
  previouslyFocused = null;
}, { immediate: true });

function close() {
  emit("update:modelValue", false);
  emit("close");
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    close();
    return;
  }
  if (event.key !== "Tab") return;

  const panel = dialog.value;
  if (!panel) return;
  const focusable = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector));
  if (!focusable.length) {
    event.preventDefault();
    panel.focus();
    return;
  }

  const first = focusable[0]!;
  const last = focusable[focusable.length - 1]!;
  if (!panel.contains(document.activeElement)) {
    event.preventDefault();
    first.focus();
  } else if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

onBeforeUnmount(() => previouslyFocused?.focus());
</script>

<template>
  <Teleport to="body">
    <div v-if="modelValue" class="ui-modal-backdrop" @click.self="close">
      <section
        ref="dialog"
        class="ui-modal"
        role="dialog"
        aria-modal="true"
        :aria-label="title || '对话框'"
        tabindex="-1"
        :style="{ width: `min(${width}, calc(100% - 32px))` }"
        @keydown="handleKeydown"
      >
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
