<script setup lang="ts" generic="T extends string | number">
export interface UiSelectOption<TValue extends string | number = string> {
  value: TValue;
  label: string;
  disabled?: boolean;
}
withDefaults(defineProps<{
  modelValue?: T;
  label?: string;
  hint?: string;
  error?: string;
  options?: UiSelectOption<T>[];
  id?: string;
}>(), { options: () => [] });

const emit = defineEmits<{ "update:modelValue": [value: T] }>();
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
      @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value as T)"
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
