<script setup lang="ts">
withDefaults(defineProps<{ tone?: "info" | "success" | "warning" | "danger"; title?: string }>(), { tone: "info" });
</script>

<template>
  <section class="ui-alert" :class="`ui-alert--${tone}`" role="status">
    <strong v-if="title">{{ title }}</strong>
    <div><slot /></div>
  </section>
</template>
