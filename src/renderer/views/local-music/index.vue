<template>
  <div class="local-music-page h-full w-full bg-white dark:bg-black transition-colors duration-500">
    <n-scrollbar class="h-full">
      <div class="local-music-content pb-32">
        <!-- Hero Section -->
        <section class="hero-section relative overflow-hidden rounded-tl-2xl">
          <!-- 背景模糊效果 -->
          <div class="hero-bg absolute inset-0 -top-20">
            <div
              class="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-primary/10 blur-3xl opacity-50 dark:opacity-30"
            ></div>
            <div
              class="absolute inset-0 bg-gradient-to-b from-transparent via-white/80 to-white dark:via-black/80 dark:to-black"
            ></div>
          </div>

          <!-- Hero 内容 -->
          <div class="hero-content relative z-10 page-padding-x pt-6 pb-4">
            <div class="flex items-center gap-5">
              <div
                class="cover-container relative w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center shadow-lg ring-2 ring-white/50 dark:ring-neutral-800/50 shrink-0"
              >
                <i class="ri-folder-music-fill text-4xl text-primary opacity-80" />
              </div>

              <div class="info-content min-w-0">
                <h1
                  class="text-2xl md:text-3xl font-bold text-neutral-900 dark:text-white tracking-tight"
                >
                  {{ t('localMusic.title') }}
                </h1>
                <p class="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                  {{ t('localMusic.songCount', { count: localMusicStore.musicList.length }) }}
                  <template v-if="localMusicStore.folderPaths.length > 0">
                    · {{ localMusicStore.folderPaths.length }} 个文件夹
                  </template>
                </p>
              </div>
            </div>

            <!-- 全部歌曲 / 歌单 -->
            <div
              class="mt-4 inline-flex items-center gap-1 p-1 rounded-full bg-neutral-100/80 dark:bg-neutral-900/80 backdrop-blur"
            >
              <button
                v-for="item in tabs"
                :key="item.key"
                class="px-4 py-1.5 rounded-full text-sm font-medium transition-all"
                :class="
                  tab === item.key
                    ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                "
                @click="switchTab(item.key)"
              >
                {{ t(item.label) }}
              </button>
            </div>
          </div>
        </section>

        <!-- Action Bar (Sticky on scroll) -->
        <section
          class="action-bar sticky top-0 z-20 page-padding-x py-3 md:py-4 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-neutral-100 dark:border-neutral-800/50"
        >
          <div class="flex flex-wrap items-center justify-between gap-3">
            <!-- 左侧：搜索框 -->
            <div class="flex-1 min-w-[180px] max-w-xs">
              <n-input
                v-model:value="searchKeyword"
                :placeholder="
                  tab === 'songs' ? t('localMusic.search') : t('localMusic.playlist.search')
                "
                clearable
                size="small"
                round
              >
                <template #prefix>
                  <i class="ri-search-line text-neutral-400" />
                </template>
              </n-input>
            </div>

            <!-- 排序（全部歌曲） -->
            <div v-if="tab === 'songs'" class="hidden lg:flex items-center gap-2">
              <div class="flex items-center gap-1">
                <button
                  v-for="option in sortOptions"
                  :key="option.key"
                  class="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                  :class="
                    sortEntries.length === 0 && sortMode === option.key
                      ? 'bg-primary/10 text-primary'
                      : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'
                  "
                  @click="applySortMode(option.key)"
                >
                  {{ t(option.label) }}
                </button>
              </div>
              <n-popover
                v-model:show="sortPasteVisible"
                trigger="click"
                placement="bottom-start"
                style="padding: 0"
              >
                <template #trigger>
                  <button
                    class="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                    :class="
                      sortEntries.length > 0
                        ? 'bg-primary/10 text-primary'
                        : 'text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    "
                  >
                    <i class="ri-clipboard-line text-sm" />
                    <span class="max-w-40 truncate">
                      {{
                        sortEntries.length > 0
                          ? sortName
                            ? t('localMusic.sort.pastedName', { name: sortName })
                            : t('localMusic.sort.pasted', { count: sortEntries.length })
                          : t('localMusic.sort.paste')
                      }}
                    </span>
                  </button>
                </template>
                <div class="w-96 p-3">
                  <p class="mb-2 text-xs text-neutral-500 dark:text-neutral-400">
                    {{ t('localMusic.sort.pasteHint') }}
                  </p>
                  <n-input
                    v-model:value="sortPasteText"
                    :placeholder="t('localMusic.sort.pastePlaceholder')"
                    :status="sortError ? 'error' : undefined"
                    @keyup.enter="applyPastedSort"
                  />
                  <p v-if="sortError" class="mt-1 text-xs text-red-500">{{ sortError }}</p>
                  <p v-else-if="sortEntries.length > 0" class="mt-1 text-xs text-neutral-400">
                    {{
                      t('localMusic.sort.matched', {
                        count: matchedSortCount,
                        total: sortEntries.length
                      })
                    }}
                  </p>
                  <div class="mt-3 flex items-center justify-between">
                    <n-button
                      size="small"
                      quaternary
                      :disabled="sortEntries.length === 0"
                      @click="clearPastedSort"
                    >
                      {{ t('localMusic.sort.clear') }}
                    </n-button>
                    <div class="flex gap-2">
                      <n-button size="small" @click="sortPasteVisible = false">
                        {{ t('localMusic.playlist.cancel') }}
                      </n-button>
                      <n-button
                        size="small"
                        type="primary"
                        :loading="sortLoading"
                        @click="applyPastedSort"
                      >
                        {{ t('localMusic.sort.apply') }}
                      </n-button>
                    </div>
                  </div>
                </div>
              </n-popover>
              <n-tooltip trigger="hover" placement="bottom">
                <template #trigger>
                  <i
                    class="ri-draggable text-base cursor-help transition-colors"
                    :class="
                      localMusicStore.orderIds.length > 0
                        ? 'text-primary'
                        : 'text-neutral-300 dark:text-neutral-600'
                    "
                  />
                </template>
                {{
                  localMusicStore.orderIds.length > 0
                    ? t('localMusic.dragHintManual')
                    : t('localMusic.dragHint')
                }}
              </n-tooltip>
            </div>

            <!-- 右侧：操作按钮 -->
            <div class="flex items-center gap-2">
              <button
                v-if="tab === 'playlists'"
                class="action-btn-pill flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm transition-all bg-primary/10 text-primary hover:bg-primary/15"
                @click="openImport"
              >
                <i class="ri-play-list-add-line text-lg" />
                <span class="hidden md:inline">{{ t('localMusic.playlist.import') }}</span>
              </button>

              <!-- 播放全部按钮 -->
              <button
                v-if="playableCount > 0"
                class="action-btn-pill flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm transition-all bg-primary text-white hover:bg-primary/90"
                @click="handlePlayAll"
              >
                <i class="ri-play-fill text-lg" />
                <span class="hidden md:inline">{{ t('localMusic.playAll') }}</span>
              </button>

              <!-- 扫描按钮 -->
              <button
                class="action-btn-icon w-10 h-10 rounded-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all"
                :disabled="localMusicStore.scanning"
                @click="handleScan"
              >
                <i
                  class="ri-refresh-line text-lg"
                  :class="{ 'animate-spin': localMusicStore.scanning }"
                />
              </button>

              <!-- 添加文件夹按钮 -->
              <button
                class="action-btn-icon w-10 h-10 rounded-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all"
                @click="handleAddFolder"
              >
                <i class="ri-folder-add-line text-lg" />
              </button>

              <!-- 文件夹管理按钮 -->
              <button
                v-if="localMusicStore.folderPaths.length > 0"
                class="action-btn-icon w-10 h-10 rounded-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all"
                @click="showFolderManager = true"
              >
                <i class="ri-folder-settings-line text-lg" />
              </button>
            </div>
          </div>
        </section>

        <!-- 扫描进度提示 -->
        <section v-if="localMusicStore.scanning" class="page-padding-x mt-6">
          <div
            class="flex items-center gap-4 p-4 rounded-2xl bg-primary/5 dark:bg-primary/10 border border-primary/20"
          >
            <n-spin size="small" />
            <div>
              <p class="text-sm font-medium text-neutral-900 dark:text-white">
                {{ t('localMusic.scanning') }}
              </p>
              <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                {{ t('localMusic.songCount', { count: localMusicStore.scanProgress }) }}
              </p>
            </div>
          </div>
        </section>

        <!-- ==================== 全部歌曲 ==================== -->
        <template v-if="tab === 'songs'">
          <!-- 歌曲列表 -->
          <section class="list-section page-padding-x mt-6">
            <!-- 空状态 -->
            <div
              v-if="!localMusicStore.scanning && filteredList.length === 0"
              class="empty-state py-20 text-center"
            >
              <i
                class="ri-folder-music-fill text-5xl mb-4 text-neutral-200 dark:text-neutral-800"
              />
              <p class="text-neutral-400">{{ t('localMusic.emptyState') }}</p>
              <button
                class="mt-6 px-6 py-2 rounded-full bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-all"
                @click="handleAddFolder"
              >
                <i class="ri-folder-add-line mr-2" />
                {{ t('localMusic.scanFolder') }}
              </button>
            </div>

            <!-- 歌曲列表 -->
            <div v-else-if="filteredList.length > 0" ref="songListRef" class="song-list-container">
              <song-item
                v-for="(item, index) in filteredSongResults"
                :key="item.id"
                :index="index"
                :item="item"
                :can-remove="true"
                @play="handlePlaySong"
                @remove-song="handleRemoveSong"
              />
            </div>
          </section>
        </template>

        <!-- ==================== 歌单 ==================== -->
        <template v-else>
          <section
            v-if="localPlaylistStore.playlists.length === 0"
            class="page-padding-x mt-10 py-16 text-center"
          >
            <i class="ri-play-list-2-line text-5xl mb-4 text-neutral-200 dark:text-neutral-800" />
            <p class="text-neutral-400">{{ t('localMusic.playlist.empty') }}</p>
            <button
              class="mt-6 px-6 py-2 rounded-full bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-all"
              @click="openImport"
            >
              <i class="ri-play-list-add-line mr-2" />
              {{ t('localMusic.playlist.import') }}
            </button>
          </section>

          <section
            v-else
            class="page-padding-x mt-6 flex flex-col md:grid md:grid-cols-[220px_1fr] md:gap-6"
          >
            <!-- 歌单列表 -->
            <aside
              class="flex gap-2 overflow-x-auto pb-2 md:block md:space-y-1 md:overflow-visible"
            >
              <button
                v-for="playlist in localPlaylistStore.playlists"
                :key="playlist.id"
                class="shrink-0 md:w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm transition-all"
                :class="
                  activePlaylist?.id === playlist.id
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900'
                "
                @click="activePlaylistId = playlist.id"
              >
                <span class="flex items-center gap-2 min-w-0">
                  <i class="ri-play-list-line shrink-0" />
                  <span class="truncate">{{ playlist.name }}</span>
                </span>
                <span class="text-[11px] text-neutral-400 shrink-0">
                  {{ playlist.entries.length }}
                </span>
              </button>
            </aside>

            <!-- 歌单内容 -->
            <main v-if="activePlaylist" class="min-w-0 mt-2 md:mt-0">
              <header
                class="flex flex-wrap items-end justify-between gap-3 pb-3 border-b border-neutral-100 dark:border-neutral-800/60"
              >
                <div class="min-w-0">
                  <h2 class="text-xl font-bold text-neutral-900 dark:text-white truncate">
                    {{ activePlaylist.name }}
                  </h2>
                  <p class="mt-1 text-xs text-neutral-400">
                    {{
                      t('localMusic.playlist.matched', {
                        matched: matchedCount,
                        total: activePlaylist.entries.length
                      })
                    }}
                  </p>
                </div>
                <div class="flex items-center gap-2">
                  <button
                    v-if="matchedCount > 0"
                    class="flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-all"
                    @click="handlePlayAll"
                  >
                    <i class="ri-play-fill text-base" />
                    {{ t('localMusic.playlist.playAll') }}
                  </button>
                  <button
                    class="w-9 h-9 rounded-full flex items-center justify-center text-neutral-400 hover:text-red-500 hover:bg-red-500/10 transition-all"
                    :title="t('localMusic.playlist.delete')"
                    @click="handleDeletePlaylist"
                  >
                    <i class="ri-delete-bin-line" />
                  </button>
                </div>
              </header>

              <div
                v-if="visibleRows.length === 0"
                class="py-16 text-center text-sm text-neutral-400"
              >
                {{ t('localMusic.playlist.emptyDetail') }}
              </div>

              <div v-else class="mt-2">
                <template v-for="(row, index) in visibleRows" :key="`${row.entry.title}-${index}`">
                  <song-item
                    v-if="row.track"
                    :index="index"
                    :item="toSongResult(row.track)"
                    :can-remove="false"
                    @play="handlePlaySong"
                  />
                  <div
                    v-else
                    class="missing-row flex items-center gap-4 px-4 py-3 rounded-xl opacity-55 select-none"
                  >
                    <span class="w-6 text-center text-xs tabular-nums text-neutral-400">
                      {{ index + 1 }}
                    </span>
                    <div class="min-w-0 flex-1">
                      <p class="text-sm truncate text-neutral-400">{{ row.entry.title }}</p>
                      <p class="text-xs truncate text-neutral-400/80">
                        {{ row.entry.artist || '—' }}
                      </p>
                    </div>
                    <span
                      class="shrink-0 px-2 py-0.5 rounded-full text-[11px] bg-neutral-100 dark:bg-neutral-900 text-neutral-400"
                    >
                      {{ t('localMusic.playlist.missing') }}
                    </span>
                  </div>
                </template>
              </div>
            </main>
          </section>
        </template>
      </div>
    </n-scrollbar>

    <!-- 文件夹管理抽屉 -->
    <n-drawer v-model:show="showFolderManager" :width="400" placement="right">
      <n-drawer-content :title="t('localMusic.removeFolder')" closable>
        <div class="space-y-3 py-4">
          <div
            v-for="folder in localMusicStore.folderPaths"
            :key="folder"
            class="flex items-center justify-between p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800"
          >
            <div class="flex items-center gap-3 min-w-0 flex-1">
              <i class="ri-folder-line text-lg text-primary flex-shrink-0" />
              <span class="text-sm text-neutral-700 dark:text-neutral-300 truncate">{{
                folder
              }}</span>
            </div>
            <button
              class="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-red-500 hover:bg-red-500/10 transition-all flex-shrink-0 ml-2"
              @click="handleRemoveFolder(folder)"
            >
              <i class="ri-delete-bin-line" />
            </button>
          </div>

          <!-- 空文件夹列表 -->
          <div v-if="localMusicStore.folderPaths.length === 0" class="text-center py-8">
            <i class="ri-folder-line text-4xl text-neutral-200 dark:text-neutral-800" />
            <p class="text-sm text-neutral-400 mt-2">{{ t('localMusic.emptyState') }}</p>
          </div>
        </div>

        <template #footer>
          <n-button type="primary" block @click="handleAddFolder">
            <template #icon>
              <i class="ri-folder-add-line" />
            </template>
            {{ t('localMusic.scanFolder') }}
          </n-button>
        </template>
      </n-drawer-content>
    </n-drawer>

    <!-- 导入歌单 -->
    <n-modal
      v-model:show="importVisible"
      preset="card"
      :title="t('localMusic.playlist.importTitle')"
      class="import-modal"
      style="width: 540px; max-width: 92vw"
    >
      <div class="space-y-3">
        <div>
          <p class="mb-1.5 text-xs font-medium text-neutral-500">
            {{ t('localMusic.playlist.link') }}
          </p>
          <n-input
            v-model:value="importLink"
            :placeholder="t('localMusic.playlist.linkPlaceholder')"
            clearable
          >
            <template #prefix>
              <i class="ri-link text-neutral-400" />
            </template>
          </n-input>
        </div>

        <div>
          <p class="mb-1.5 text-xs font-medium text-neutral-500">
            {{ t('localMusic.playlist.name') }}
          </p>
          <n-input
            v-model:value="importName"
            :placeholder="t('localMusic.playlist.namePlaceholder')"
            clearable
          />
        </div>

        <div>
          <p class="mb-1.5 text-xs font-medium text-neutral-500">
            {{ t('localMusic.playlist.text') }}
          </p>
          <n-input
            v-model:value="importText"
            type="textarea"
            :rows="5"
            :placeholder="t('localMusic.playlist.textPlaceholder')"
          />
        </div>

        <p v-if="importError" class="text-xs text-red-500">{{ importError }}</p>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <n-button @click="importVisible = false">{{ t('localMusic.playlist.cancel') }}</n-button>
          <n-button type="primary" :loading="importing" @click="submitImport">
            {{ importing ? t('localMusic.playlist.importing') : t('localMusic.playlist.submit') }}
          </n-button>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { createDiscreteApi } from 'naive-ui';
import Sortable from 'sortablejs';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import SongItem from '@/components/common/SongItem.vue';
import { useLocalMusicStore } from '@/store/modules/localMusic';
import { useLocalPlaylistStore } from '@/store/modules/localPlaylist';
import { usePlayerStore } from '@/store/modules/player';
import type { SongResult } from '@/types/music';
import { filterByKeyword, toSongResult } from '@/utils/localMusicUtils';
import {
  buildMatchIndex,
  buildPlaylistRows,
  filterPlaylistRows,
  matchEntry,
  parsePlaylistText,
  playlistTracks
} from '@/utils/localPlaylistUtils';

// ==================== Stores ====================
const { t } = useI18n();
const { message, dialog } = createDiscreteApi(['message', 'dialog']);
const localMusicStore = useLocalMusicStore();
const localPlaylistStore = useLocalPlaylistStore();
const playerStore = usePlayerStore();

// ==================== State ====================
const tab = ref<'songs' | 'playlists'>('songs');
const searchKeyword = ref('');
/** 歌曲列表容器（用于绑定 SortableJS 实现拖拽排序） */
const songListRef = ref<HTMLElement | null>(null);
const sortMode = ref<'title' | 'artist' | 'added'>('title');
/** 粘贴排序弹层 */
const sortPasteVisible = ref(false);
const sortPasteText = ref('');
const sortError = ref('');
const sortLoading = ref(false);
const activePlaylistId = ref('');
const showFolderManager = ref(false);

const importVisible = ref(false);
const importLink = ref('');
const importName = ref('');
const importText = ref('');
const importError = ref('');
const importing = ref(false);

const tabs = [
  { key: 'songs' as const, label: 'localMusic.tabs.songs' },
  { key: 'playlists' as const, label: 'localMusic.tabs.playlists' }
];

const sortOptions = [
  { key: 'title' as const, label: 'localMusic.sort.title' },
  { key: 'artist' as const, label: 'localMusic.sort.artist' },
  { key: 'added' as const, label: 'localMusic.sort.added' }
];

// 打开排序弹层时回填上次的歌单链接
watch(sortPasteVisible, (visible) => {
  if (!visible) return;
  sortError.value = '';
  sortPasteText.value = localPlaylistStore.sortLink;
});

// ==================== Computed ====================
/** 本地曲库匹配索引，曲库变化时重建 */
const matchIndex = computed(() => buildMatchIndex(localMusicStore.musicList));

/** 粘贴进来的排序条目，存在 store 里，重启后保持 */
const sortEntries = computed(() => localPlaylistStore.sortEntries);
const sortName = computed(() => localPlaylistStore.sortName);

/** 粘贴歌单里本地存在的曲目 → 曲目 id 到歌单位置的映射 */
const playlistSortOrder = computed(() => {
  if (sortEntries.value.length === 0) return null;
  const order = new Map<string, number>();
  for (const entry of sortEntries.value) {
    const track = matchEntry(entry, matchIndex.value);
    if (track && !order.has(track.id)) order.set(track.id, order.size);
  }
  return order;
});

/** 歌单里能在本地曲库匹配到的数量 */
const matchedSortCount = computed(() => playlistSortOrder.value?.size ?? 0);

/** 按当前排序模式排好的全部本地歌曲；选了歌单时歌单内曲目按歌单顺序置顶。
 *  若用户手动拖拽排过序（orderIds 非空），则优先使用手动顺序。 */
const sortedEntries = computed(() => {
  if (localMusicStore.orderIds.length > 0) {
    return localMusicStore.orderedList;
  }
  const list = [...localMusicStore.musicList];
  const order = playlistSortOrder.value;
  if (order) {
    return list.sort((a, b) => {
      const ai = order.get(a.id);
      const bi = order.get(b.id);
      if (ai !== undefined && bi !== undefined) return ai - bi;
      if (ai !== undefined) return -1;
      if (bi !== undefined) return 1;
      return a.title.localeCompare(b.title, 'zh-Hans-CN');
    });
  }
  if (sortMode.value === 'title') {
    return list.sort((a, b) => a.title.localeCompare(b.title, 'zh-Hans-CN'));
  }
  if (sortMode.value === 'artist') {
    return list.sort(
      (a, b) =>
        a.artist.localeCompare(b.artist, 'zh-Hans-CN') ||
        a.title.localeCompare(b.title, 'zh-Hans-CN')
    );
  }
  return list.sort((a, b) => (b.modifiedTime || 0) - (a.modifiedTime || 0));
});

/** 根据搜索关键词过滤后的本地音乐列表 */
const filteredList = computed(() => filterByKeyword(sortedEntries.value, searchKeyword.value));

/** 将过滤后的列表转换为 SongResult[] 供 SongItem 使用 */
const filteredSongResults = computed(() => filteredList.value.map(toSongResult));

/** 当前选中的歌单 */
const activePlaylist = computed(() => {
  const selected = localPlaylistStore.playlists.find(
    (playlist) => playlist.id === activePlaylistId.value
  );
  return selected ?? localPlaylistStore.playlists[0] ?? null;
});

/** 当前歌单的完整行列表（含本地没有的曲目） */
const playlistRows = computed(() =>
  activePlaylist.value
    ? buildPlaylistRows(activePlaylist.value, localMusicStore.musicList, matchIndex.value)
    : []
);

/** 歌单列表经过搜索过滤后的展示行 */
const visibleRows = computed(() => filterPlaylistRows(playlistRows.value, searchKeyword.value));

/** 歌单里本地可播放的曲目，保持歌单原顺序 */
const playlistTracksList = computed(() => playlistTracks(playlistRows.value));

const visibleMatchedSongResults = computed(() =>
  playlistTracks(visibleRows.value).map(toSongResult)
);

const matchedCount = computed(() => playlistTracksList.value.length);

const playableCount = computed(() =>
  tab.value === 'songs' ? filteredList.value.length : matchedCount.value
);

// ==================== Methods ====================
/** 点按标题/歌手/最近添加时退出歌单排序（同时清除手动拖拽顺序） */
function applySortMode(key: 'title' | 'artist' | 'added'): void {
  sortMode.value = key;
  localMusicStore.clearManualOrder();
  clearPastedSort();
}

/** 读取歌单链接（或按文本列表）给全部歌曲排序 */
async function applyPastedSort(): Promise<void> {
  const raw = sortPasteText.value.trim();
  sortError.value = '';
  // 粘贴歌单排序会覆盖手动拖拽顺序
  localMusicStore.clearManualOrder();
  if (!raw) {
    sortError.value = t('localMusic.sort.pasteEmpty');
    return;
  }

  if (!/^https?:\/\//i.test(raw)) {
    const entries = parsePlaylistText(raw);
    if (entries.length === 0) {
      sortError.value = t('localMusic.sort.pasteEmpty');
      return;
    }
    localPlaylistStore.sortEntries = entries;
    localPlaylistStore.sortName = '';
    localPlaylistStore.sortLink = '';
    sortPasteVisible.value = false;
    message.success(t('localMusic.sort.applied', { count: entries.length }));
    return;
  }

  sortLoading.value = true;
  try {
    const result = await localPlaylistStore.importFromLink(raw);
    if (!result.ok || !result.playlist) {
      sortError.value = result.error || t('localMusic.sort.linkError');
      return;
    }
    localPlaylistStore.sortEntries = result.playlist.entries;
    localPlaylistStore.sortName = result.playlist.name;
    localPlaylistStore.sortLink = raw;
    sortPasteVisible.value = false;
    message.success(t('localMusic.sort.appliedLink', { name: result.playlist.name }));
  } finally {
    sortLoading.value = false;
  }
}

function clearPastedSort(): void {
  localPlaylistStore.sortEntries = [];
  localPlaylistStore.sortName = '';
  localPlaylistStore.sortLink = '';
  sortPasteText.value = '';
}

function switchTab(next: 'songs' | 'playlists'): void {
  tab.value = next;
  searchKeyword.value = '';
}

// ==================== 拖拽排序（长按 / 鼠标拖拽） ====================
let sortable: Sortable | null = null;

/**
 * 拖拽结束时按新的展示顺序写入手动排序
 * 仅“全部歌曲”且未搜索时允许拖拽，此时 sortedEntries 即完整展示顺序
 */
function handleDragEnd(evt: any): void {
  const { oldIndex, newIndex } = evt;
  if (oldIndex == null || newIndex == null || oldIndex === newIndex) return;
  const list = sortedEntries.value.slice();
  if (oldIndex >= list.length || newIndex >= list.length) return;
  const [moved] = list.splice(oldIndex, 1);
  if (!moved) return;
  list.splice(newIndex, 0, moved);
  localMusicStore.setOrder(list.map((entry) => entry.id));
}

function initSortable(): void {
  if (sortable || !songListRef.value) return;
  sortable = Sortable.create(songListRef.value, {
    animation: 150,
    delay: 250, // 触摸需长按 250ms 才进入拖拽；鼠标无需延迟直接拖
    delayOnTouchOnly: true, // 仅触摸启用长按，桌面鼠标拖拽不受影响
    filter: '.song-item-operating', // 播放/收藏按钮不触发拖拽
    preventOnFilter: false,
    onEnd: handleDragEnd
  });
}

function destroySortable(): void {
  if (sortable) {
    sortable.destroy();
    sortable = null;
  }
}

// 进入“全部歌曲”且列表非空时初始化拖拽；切到歌单页或清空时销毁
watch(
  [() => tab.value, () => filteredList.value.length],
  ([curTab, len]: [string, number]) => {
    if (curTab === 'songs' && len > 0) {
      nextTick(initSortable);
    } else {
      destroySortable();
    }
  },
  { immediate: true }
);

// 搜索时禁用拖拽，避免过滤视图与全局顺序错位
watch(searchKeyword, (kw) => {
  if (sortable) sortable.option('disabled', kw.trim().length > 0);
});

async function handleAddFolder(): Promise<void> {
  try {
    const result = await window.electron.ipcRenderer.invoke('select-directory');
    if (result && !result.canceled && result.filePaths?.length > 0) {
      localMusicStore.addFolder(result.filePaths[0]);
      await localMusicStore.scanFolders();
    }
  } catch (error) {
    console.error('选择文件夹失败:', error);
    message.error(String(error));
  }
}

async function handleRemoveFolder(folder: string): Promise<void> {
  await localMusicStore.removeFolder(folder);
}

async function handleScan(): Promise<void> {
  if (localMusicStore.folderPaths.length === 0) {
    await localMusicStore.scanFolders();
    await handleAddFolder();
    return;
  }
  await localMusicStore.scanFolders();
}

/** 播放单曲：SongItem 内部负责开始播放，这里只同步播放队列 */
function handlePlaySong(song: SongResult): void {
  const queue = tab.value === 'songs' ? filteredSongResults.value : visibleMatchedSongResults.value;
  playerStore.prepareSongPlayback(song, queue);
}

async function handleRemoveSong(id: number | string): Promise<void> {
  try {
    await localMusicStore.removeEntry(String(id));
    message.success(t('localMusic.removedFromLibrary'));
  } catch (error) {
    console.error('移除本地歌曲失败:', error);
    message.error(String(error));
  }
}

async function handlePlayAll(): Promise<void> {
  const songs = tab.value === 'songs' ? filteredSongResults.value : visibleMatchedSongResults.value;
  const firstTrack =
    tab.value === 'songs' ? filteredList.value[0] : playlistTracks(visibleRows.value)[0];

  if (songs.length === 0 || !firstTrack) return;

  try {
    const exists = await window.electron.ipcRenderer.invoke(
      'check-file-exists',
      firstTrack.filePath
    );
    if (!exists) {
      message.error(t('localMusic.fileNotFound'));
      return;
    }

    playerStore.setPlayList(songs);
    await playerStore.setPlay(songs[0]);
  } catch (error) {
    console.error('播放全部失败:', error);
  }
}

function openImport(): void {
  importLink.value = '';
  importName.value = '';
  importText.value = '';
  importError.value = '';
  importVisible.value = true;
}

async function submitImport(): Promise<void> {
  importError.value = '';

  if (!importLink.value.trim() && !importText.value.trim()) {
    importError.value = t('localMusic.playlist.needLinkOrText');
    return;
  }

  importing.value = true;
  try {
    const result = importLink.value.trim()
      ? await localPlaylistStore.importFromLink(importLink.value, importName.value)
      : localPlaylistStore.importFromText(importText.value, importName.value);

    if (!result.ok || !result.playlist) {
      importError.value = result.error || '导入失败';
      return;
    }

    activePlaylistId.value = result.playlist.id;
    tab.value = 'playlists';
    importVisible.value = false;
    message.success(t('localMusic.playlist.imported', { name: result.playlist.name }));
  } finally {
    importing.value = false;
  }
}

function handleDeletePlaylist(): void {
  const playlist = activePlaylist.value;
  if (!playlist) return;

  dialog.warning({
    title: t('localMusic.playlist.delete'),
    content: t('localMusic.playlist.deleteConfirm', { name: playlist.name }),
    positiveText: t('localMusic.playlist.delete'),
    negativeText: t('localMusic.playlist.cancel'),
    onPositiveClick: () => {
      localPlaylistStore.removePlaylist(playlist.id);
      activePlaylistId.value = '';
    }
  });
}

// 删除后自动选中剩下的第一个歌单
watch(
  () => localPlaylistStore.playlists.map((playlist) => playlist.id).join(','),
  () => {
    if (!activePlaylist.value) {
      activePlaylistId.value = localPlaylistStore.playlists[0]?.id ?? '';
    }
  }
);

// ==================== Lifecycle ====================
onMounted(async () => {
  // 启动时的自动扫描可能仍在进行，此时不要用缓存快照覆盖扫描结果
  if (localMusicStore.scanning) {
    return;
  }
  await localMusicStore.loadFromCache();
});

onUnmounted(() => {
  destroySortable();
});
</script>

<style scoped>
.missing-row {
  @apply bg-neutral-50/60 dark:bg-neutral-900/40;
}

.song-list-container :deep(.song-item) {
  cursor: grab;
}

.song-list-container :deep(.song-item:active) {
  cursor: grabbing;
}

.import-modal :deep(.n-card__content) {
  padding-top: 8px;
}
</style>
