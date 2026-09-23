<script setup lang="ts" generic="T extends string">
defineProps<{
  label: string;
  options: ReadonlyArray<{ id: T; name: string; caption: string }>;
  selected: T;
  disabled?: boolean;
}>();
const emit = defineEmits<{ select: [value: T] }>();

function onKeydown(event: KeyboardEvent, index: number, options: ReadonlyArray<{ id: T }>) {
  let next = index;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % options.length;
  else if (event.key === "ArrowLeft" || event.key === "ArrowUp")
    next = (index - 1 + options.length) % options.length;
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = options.length - 1;
  else return;
  event.preventDefault();
  const option = options[next];
  if (!option) return;
  emit("select", option.id);
  (event.currentTarget as HTMLElement)
    .closest('[role="radiogroup"]')
    ?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
    [next]?.focus();
}
</script>

<template>
  <div
    class="preference-radio-group"
    role="radiogroup"
    :aria-label="label"
    :aria-disabled="disabled"
  >
    <button
      v-for="(option, index) in options"
      :key="option.id"
      class="preference-radio"
      type="button"
      role="radio"
      :aria-checked="selected === option.id"
      :tabindex="selected === option.id ? 0 : -1"
      :disabled="disabled"
      :class="{ 'is-selected': selected === option.id }"
      @click="emit('select', option.id)"
      @keydown="onKeydown($event, index, options)"
    >
      <span class="preference-radio__mark" aria-hidden="true"></span>
      <span class="preference-radio__copy">
        <strong>{{ option.name }}</strong>
        <small>{{ option.caption }}</small>
      </span>
      <span class="preference-radio__state">{{
        selected === option.id ? "当前选择" : "选择"
      }}</span>
    </button>
  </div>
</template>
