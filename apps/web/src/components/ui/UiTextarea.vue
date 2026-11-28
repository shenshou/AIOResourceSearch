<script setup lang="ts">
withDefaults(defineProps<{
  modelValue?: string;
  label?: string;
  hint?: string;
  error?: string;
  id?: string;
}>(), { modelValue: "" });

const emit = defineEmits<{ "update:modelValue": [value: string] }>();
</script>

<template>
  <label class="ui-field" :for="id">
    <span v-if="label" class="ui-field-label">{{ label }}</span>
    <textarea
      v-bind="$attrs"
      :id="id"
      class="ui-textarea"
      :value="modelValue"
      :aria-invalid="Boolean(error) || undefined"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    ></textarea>
    <span v-if="error" class="ui-field-error">{{ error }}</span>
    <span v-else-if="hint" class="ui-field-hint">{{ hint }}</span>
  </label>
</template>
