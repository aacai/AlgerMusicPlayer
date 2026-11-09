<template>
  <div v-if="isComponent ? favoriteSongs.length : true" class="favorite-page h-full flex flex-col">
    <!-- Header Section -->
    <div
      class="flex items-center justify-between px-6 py-4 flex-shrink-0"
      :class="setAnimationClass('animate__fadeInLeft')"
    >
      <div class="flex items-center gap-4">
        <div>
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
            {{ t('favorite.title') }}
          </h2>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {{ t('favorite.count', { count: favoriteList.length }) }}
          </p>
        </div>
      </div>

      <div v-if="!isComponent && isElectron" class="flex items-center gap-3">
        <template v-if="!isSelecting">
          <!-- Sort Controls -->
          <div class="flex items-center bg-gray-100 dark:bg-neutral-800 rounded-full p-1 h-9">
            <button
              v-for="isDesc in [true, false]"
              :key="String(isDesc)"
              class="px-3 h-full rounded-full text-xs font-medium transition-all duration-300 flex items-center gap-1"
              :class="
                isDescending === isDesc
                  ? 'bg-white dark:bg-neutral-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              "
              @click="toggleSort(isDesc)"
            >
              <i class="text-sm" :class="isDesc ? 'ri-sort-desc' : 'ri-sort-asc'"></i>
              {{ isDesc ? t('favorite.descending') : t('favorite.ascending') }}
            </button>
          </div>

          <button
            class="h-9 px-4 rounded-full bg-primary/10 hover:bg-primary text-primary hover:text-white text-xs font-medium transition-all duration-300 flex items-center gap-1.5"
            @click="goToImport"
          >
            <i class="ri-import-line text-sm"></i>
            {{ t('favorite.importSongs') }}
          </button>

          <button
            class="h-9 px-4 rounded-full bg-primary/10 hover:bg-primary text-primary hover:text-white text-xs font-medium transition-all duration-300 flex items-center gap-1.5"
            @click="startSelect"
          >
            <i class="ri-checkbox-multiple-line text-sm"></i>
            {{ t('favorite.batchDownload') }}
          </button>
        </template>

        <!-- Selection Controls -->
        <div
          v-else
          class="flex items-center gap-3 bg-white dark:bg-neutral-800 shadow-sm rounded-full px-4 py-1.5 border border-gray-100 dark:border-neutral-700 h-9"
        >
          <n-checkbox
            :checked="isAllSelected"
            :indeterminate="isIndeterminate"
            size="small"
            @update:checked="handleSelectAll"
          >
            <span class="text-xs">{{ t('common.selectAll') }}</span>
          </n-checkbox>
          <div class="h-3 w-px bg-gray-200 dark:bg-neutral-700 mx-1"></div>
          <div class="flex items-center gap-2">
            <button
              class="h-6 px-3 rounded-full bg-primary text-white text-xs font-medium hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              :disabled="selectedSongs.length === 0"
              @click="handleBatchDownload"
            >
              <i class="ri-download-line"></i>
              {{ t('favorite.download', { count: selectedSongs.length }) }}
            </button>
            <button
              class="h-6 px-3 rounded-full bg-gray-100 dark:bg-neutral-700 text-gray-600 dark:text-gray-300 text-xs font-medium hover:bg-gray-200 dark:hover:bg-neutral-600 transition-colors"
              @click="cancelSelect"
            >
              {{ t('common.cancel') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="flex-grow min-h-0 px-2" :class="setAnimationClass('animate__bounceInRight')">
      <n-scrollbar ref="scrollbarRef" class="h-full pr-4">
        <div
          v-if="favoriteList.length === 0"
          class="h-full flex flex-col items-center justify-center text-gray-400"
        >
          <div
            class="w-24 h-24 rounded-full bg-gray-100 dark:bg-neutral-800 flex items-center justify-center mb-4"
          >
            <i class="ri-heart-line text-4xl text-gray-300 dark:text-gray-600"></i>
          </div>
          <p>{{ t('favorite.emptyTip') }}</p>
        </div>

        <div v-else class="space-y-1" :class="{ 'max-w-[400px]': isComponent }">
          <div ref="favoriteListRef" class="favorite-list-section">
            <song-item
              v-for="(song, index) in favoriteSongs"
              :key="song.id"
              :item="song"
              :favorite="false"
              class="rounded-xl hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
              :class="[
                index < 20 ? setAnimationClass('animate__bounceInLeft') : '',
                { '!bg-primary/10': selectedSongs.includes(song.id as number) }
              ]"
              :style="index < 20 ? getItemAnimationDelay(index) : undefined"
              :selectable="isSelecting"
              :selected="selectedSongs.includes(song.id as number)"
              @play="handlePlay"
              @select="handleSelect"
            />
          </div>

          <div v-if="isComponent" class="pt-4 text-center">
            <n-button text type="primary" @click="handleMore">
              {{ t('common.viewMore') }} <i class="ri-arrow-right-s-line ml-1"></i>
            </n-button>
          </div>

          <!-- Loading Skeletons -->
          <div v-if="loading" class="space-y-2 pt-2">
            <div
              v-for="i in 5"
              :key="i"
              class="flex items-center gap-4 rounded-xl p-2 animate-pulse"
            >
              <div class="h-12 w-12 rounded-xl bg-gray-200 dark:bg-neutral-800"></div>
              <div class="flex-1 space-y-2">
                <div class="h-4 w-1/3 rounded bg-gray-200 dark:bg-neutral-800"></div>
                <div class="h-3 w-1/4 rounded bg-gray-200 dark:bg-neutral-800"></div>
              </div>
            </div>
          </div>
        </div>
      </n-scrollbar>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { getMusicDetail } from '@/api/music';
import SongItem from '@/components/common/SongItem.vue';
import { useSongListDrag } from '@/composables/useSongListDrag';
import { useDownload } from '@/hooks/useDownload';
import { usePlayerStore } from '@/store';
import type { SongResult } from '@/types/music';
import { isElectron, setAnimationClass, setAnimationDelay } from '@/utils';

const { t } = useI18n();
const playerStore = usePlayerStore();
const favoriteList = computed(() => playerStore.favoriteList);
const favoriteSongs = ref<SongResult[]>([]);
const loading = ref(false);
const noMore = ref(false);
const scrollbarRef = ref();

// 拖拽排序容器
const favoriteListRef = ref<HTMLElement | null>(null);

// 多选相关
const isSelecting = ref(false);
const selectedSongs = ref<number[]>([]);
const { batchDownloadMusic } = useDownload();

// 开始多选
const startSelect = () => {
  isSelecting.value = true;
  selectedSongs.value = [];
};

// 取消多选
const cancelSelect = () => {
  isSelecting.value = false;
  selectedSongs.value = [];
};

// 处理选择
const handleSelect = (songId: number, selected: boolean) => {
  if (selected) {
    selectedSongs.value.push(songId);
  } else {
    selectedSongs.value = selectedSongs.value.filter((id) => id !== songId);
  }
};

// 批量下载
const handleBatchDownload = async () => {
  const selectedSongsList = selectedSongs.value
    .map((songId) => favoriteSongs.value.find((s) => s.id === songId))
    .filter((song) => song) as SongResult[];

  await batchDownloadMusic(selectedSongsList);
  cancelSelect();
};

// 排序相关（升/降序仅决定展示方向，拖拽排序会以“规范顺序”正确回写）
const isDescending = ref(true);

const props = defineProps({
  isComponent: {
    type: Boolean,
    default: false
  }
});

// 拉取全部收藏歌曲详情（翻页取完，以支持整列拖拽排序）
const getFavoriteSongs = async () => {
  if (favoriteList.value.length === 0) {
    favoriteSongs.value = [];
    noMore.value = true;
    return;
  }

  // 组件模式（侧边/迷你）只展示前 16 首，不触发拖拽
  if (props.isComponent && favoriteSongs.value.length >= 16) {
    return;
  }

  loading.value = true;
  try {
    // 展示顺序：降序时反转规范列表
    const displayIds = isDescending.value
      ? [...favoriteList.value].reverse()
      : [...favoriteList.value];

    const pageSize = 100;
    const songs: SongResult[] = [];
    for (let start = 0; start < displayIds.length; start += pageSize) {
      const chunk = displayIds.slice(start, start + pageSize);
      const musicIds = chunk.filter((id) => typeof id === 'number') as number[];
      if (musicIds.length === 0) continue;
      const res = await getMusicDetail(musicIds);
      if (res.data?.songs) {
        songs.push(
          ...res.data.songs.map((song: SongResult) => ({
            ...song,
            picUrl: song.al?.picUrl || '',
            source: 'netease'
          }))
        );
      }
    }

    // 按展示顺序对齐（接口返回顺序不一定与请求一致）
    const songMap = new Map(songs.map((song) => [String(song.id), song]));
    favoriteSongs.value = displayIds
      .map((id) => songMap.get(String(id)))
      .filter((song): song is SongResult => !!song);
    noMore.value = true;
  } catch (error) {
    console.error('获取收藏歌曲失败:', error);
  } finally {
    loading.value = false;
  }
};

// 切换升/降序：按新方向重新拉取
const toggleSort = (descending: boolean) => {
  if (isDescending.value === descending) return;
  isDescending.value = descending;
  favoriteSongs.value = [];
  noMore.value = false;
  getFavoriteSongs();
};

/**
 * 拖拽排序：把展示顺序的变化按“规范顺序”回写到 favoriteList（保持升/降序语义）
 * 展示索引 d 对应规范索引 c = isDescending ? (len-1-d) : d
 */
function handleFavoriteReorder(from: number, to: number): void {
  const len = favoriteSongs.value.length;
  if (len === 0) return;
  const cFrom = isDescending.value ? len - 1 - from : from;
  const cTo = isDescending.value ? len - 1 - to : to;
  playerStore.reorderFavorite(cFrom, cTo);
}

// 拖拽排序（桌面鼠标拖拽 / 移动端长按拖动）；仅在整列已加载完成时启用
useSongListDrag(favoriteListRef, {
  active: computed(
    () =>
      !props.isComponent &&
      favoriteList.value.length > 0 &&
      favoriteSongs.value.length === favoriteList.value.length
  ),
  filter: '.song-item-operating',
  onReorder: handleFavoriteReorder
});

const hasLoaded = ref(false);

onMounted(async () => {
  if (!hasLoaded.value) {
    await playerStore.initializeFavoriteList();
    await getFavoriteSongs();
    hasLoaded.value = true;
  }
});

watch(
  favoriteList,
  async () => {
    hasLoaded.value = false;
    noMore.value = false;
    await getFavoriteSongs();
    hasLoaded.value = true;
  },
  { deep: true }
);

const handlePlay = (song: SongResult) => {
  playerStore.prepareSongPlayback(song, favoriteSongs.value);
};

const getItemAnimationDelay = (index: number) => {
  return setAnimationDelay(index, 30);
};

const router = useRouter();
const handleMore = () => {
  router.push('/history');
};

const goToImport = () => {
  router.push('/playlist/import');
};

// 全选相关
const isAllSelected = computed(() => {
  return (
    favoriteSongs.value.length > 0 && selectedSongs.value.length === favoriteSongs.value.length
  );
});

const isIndeterminate = computed(() => {
  return selectedSongs.value.length > 0 && selectedSongs.value.length < favoriteSongs.value.length;
});

const handleSelectAll = (checked: boolean) => {
  if (checked) {
    selectedSongs.value = favoriteSongs.value.map((song) => song.id as number);
  } else {
    selectedSongs.value = [];
  }
};
</script>

<style lang="scss" scoped>
.favorite-list-section :deep(.song-item) {
  cursor: grab;
}

.favorite-list-section :deep(.song-item:active) {
  cursor: grabbing;
}
</style>
