<template>
  <component :is="componentToUse" v-bind="$attrs" ref="musicFullRef" />
</template>

<script setup lang="ts">
import { computed } from 'vue';

import MusicFull from '@/components/lyric/MusicFull.vue';
import MusicFullMelo from '@/components/lyric/MusicFullMelo.vue';
import MusicFullMobile from '@/components/lyric/MusicFullMobile.vue';
import { useSettingsStore } from '@/store/modules/settings';
import { isMobile } from '@/utils';

const settingsStore = useSettingsStore();

// 播放页样式：默认沿用 Alger 自带布局，选择 Melo 时整页换成 Melo 风格
const componentToUse = computed(() => {
  if (settingsStore.setData?.playerStyle === 'melo') return MusicFullMelo;
  return isMobile.value ? MusicFullMobile : MusicFull;
});

const musicFullRef = ref<InstanceType<typeof MusicFull>>();

defineExpose({
  musicFullRef
});
</script>
