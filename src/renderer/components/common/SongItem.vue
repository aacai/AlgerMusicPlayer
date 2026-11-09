<template>
  <template v-if="dragHandle">
    <div class="flex items-center gap-1">
      <i
        class="drag-handle ri-draggable shrink-0 cursor-grab text-neutral-300 transition-colors hover:text-neutral-500 dark:text-neutral-600 dark:hover:text-neutral-400"
      ></i>
      <component
        :is="renderComponent"
        class="min-w-0 flex-1"
        :item="item"
        :favorite="favorite"
        :selectable="selectable"
        :selected="selected"
        :can-remove="canRemove"
        :is-next="isNext"
        :index="index"
        @play="(...args) => $emit('play', ...args)"
        @select="(...args) => $emit('select', ...args)"
        @remove-song="(...args) => $emit('remove-song', ...args)"
      />
    </div>
  </template>
  <component
    v-else
    :is="renderComponent"
    :item="item"
    :favorite="favorite"
    :selectable="selectable"
    :selected="selected"
    :can-remove="canRemove"
    :is-next="isNext"
    :index="index"
    @play="(...args) => $emit('play', ...args)"
    @select="(...args) => $emit('select', ...args)"
    @remove-song="(...args) => $emit('remove-song', ...args)"
  />
</template>

<script lang="ts" setup>
import { computed } from 'vue';

import type { SongResult } from '@/types/music';

import CompactSongItem from './songItemCom/CompactSongItem.vue';
import HomeSongItem from './songItemCom/HomeSongItem.vue';
import ListSongItem from './songItemCom/ListSongItem.vue';
import MiniSongItem from './songItemCom/MiniSongItem.vue';
import StandardSongItem from './songItemCom/StandardSongItem.vue';

const props = withDefaults(
  defineProps<{
    item: SongResult;
    mini?: boolean;
    list?: boolean;
    compact?: boolean;
    home?: boolean;
    favorite?: boolean;
    selectable?: boolean;
    selected?: boolean;
    canRemove?: boolean;
    isNext?: boolean;
    index?: number;
    /** 是否在行首渲染拖拽手柄（并作为 SortableJS 的拖拽起点） */
    dragHandle?: boolean;
  }>(),
  {
    mini: false,
    list: false,
    compact: false,
    home: false,
    favorite: true,
    selectable: false,
    selected: false,
    canRemove: false,
    isNext: false,
    index: undefined,
    dragHandle: false
  }
);

defineEmits(['play', 'select', 'remove-song']);

// 根据属性决定渲染哪个组件
const renderComponent = computed(() => {
  if (props.mini) return MiniSongItem;
  if (props.list) return ListSongItem;
  if (props.compact) return CompactSongItem;
  if (props.home) return HomeSongItem;
  return StandardSongItem;
});
</script>
