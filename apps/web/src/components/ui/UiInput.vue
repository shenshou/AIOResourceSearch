<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue?: string | number;
  label?: string;
  hint?: string;
  error?: string;
  type?: string;
  id?: string;
}>(), { modelValue: "", type: "text" });

const emit = defineEmits<{ "update:modelValue": [value: string | number] }>();

function updateValue(event: Event) {
  const input = event.target as HTMLInputElement;
  if (props.type === "number" && input.value !== "") {
    emit("update:modelValue", input.valueAsNumber);
    return;
  }
  emit("update:modelValue", input.value);
}
</script>

<template>
  <label class="ui-field" :for="id">
    <span v-if="label" class="ui-field-label">{{ label }}</span>
    <input
      v-bind="$attrs"
      :id="id"
      class="ui-input"
      :type="type"
      :value="modelValue"
      :aria-invalid="Boolean(error) || undefined"
      @input="updateValue"
    >
    <span v-if="error" class="ui-field-error">{{ error }}</span>
    <span v-else-if="hint" class="ui-field-hint">{{ hint }}</span>
  </label>
</template>
