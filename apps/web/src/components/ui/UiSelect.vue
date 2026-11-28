<script setup lang="ts">
export interface UiSelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}
withDefaults(defineProps<{
  modelValue?: string | number;
  label?: string;
  hint?: string;
  error?: string;
  options?: UiSelectOption[];
  id?: string;
}>(), { modelValue: "", options: () => [] });

const emit = defineEmits<{ "update:modelValue": [value: string] }>();
</script>

<template>
  <label class="ui-field" :for="id">
    <span v-if="label" class="ui-field-label">{{ label }}</span>
    <select
      v-bind="$attrs"
      :id="id"
      class="ui-select"
      :value="modelValue"
      :aria-invalid="Boolean(error) || undefined"
      @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option v-for="option in options" :key="String(option.value)" :value="option.value" :disabled="option.disabled">
        {{ option.label }}
      </option>
      <slot />
    </select>
    <span v-if="error" class="ui-field-error">{{ error }}</span>
    <span v-else-if="hint" class="ui-field-hint">{{ hint }}</span>
  </label>
</template>
