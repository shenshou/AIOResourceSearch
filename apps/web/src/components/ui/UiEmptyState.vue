<script setup lang="ts">
defineProps<{ title?: string; description?: string }>();
</script>

<template>
  <section class="ui-empty-state" role="status">
    <strong v-if="title">{{ title }}</strong>
    <p v-if="description">{{ description }}</p>
    <slot />
  </section>
</template>
