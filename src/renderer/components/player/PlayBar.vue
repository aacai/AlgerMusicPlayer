<template>
  <div
    class="music-play-bar"
    :class="[
      setAnimationClass('animate__bounceInUp'),
      isMeloStyle ? 'is-melo-bar' : '',
      isMeloStyle && musicFullVisible ? 'is-immersive' : '',
      musicFullVisible && !isMeloStyle ? 'play-bar-opcity' : '',
      musicFullVisible && MusicFullRef?.musicFullRef?.config?.hidePlayBar
        ? 'animate__animated animate__slideOutDown'
        : ''
    ]"
    :style="{ color: barColor }"
    @click="handleBarClick"
  >
    <!-- 第二风格（Melo）：左侧曲名 + 收藏/评论/更多，中间走带 + 进度，右侧功能图标 -->
    <div v-if="isMeloStyle" class="melo-bar">
      <div class="melo-bar-left">
        <div class="melo-bar-title-row">
          <span class="melo-bar-title">
            {{ playMusic?.name || t('player.playBar.noSongPlaying') }}
          </span>
          <span v-if="artistText" class="melo-bar-artist">- {{ artistText }}</span>
          <span v-if="playbackRate !== 1.0" class="playback-rate-badge"> {{ playbackRate }}x </span>
          <i v-if="playMusic?.playLoading" class="ri-loader-4-line melo-bar-loading"></i>
        </div>
        <div class="melo-bar-sub">
          <n-tooltip trigger="hover" :z-index="9999999">
            <template #trigger>
              <i
                class="iconfont melo-bar-icon"
                :class="{
                  'like-active': isFavorite,
                  'ri-heart-3-fill': isFavorite,
                  'ri-heart-3-line': !isFavorite
                }"
                @click="toggleFavorite"
              ></i>
            </template>
            {{ t('player.playBar.like') }}
          </n-tooltip>
          <n-tooltip trigger="hover" :z-index="9999999">
            <template #trigger>
              <i
                class="iconfont ri-chat-3-line melo-bar-icon"
                :class="{ 'text-green-500': meloCommentsOpen }"
                @click="toggleComments"
              ></i>
            </template>
            评论
          </n-tooltip>
          <advanced-controls-popover />
        </div>
      </div>

      <div class="melo-bar-center">
        <div class="melo-bar-transport">
          <n-tooltip trigger="hover" :z-index="9999999">
            <template #trigger>
              <i
                class="iconfont melo-bar-icon"
                :class="[playModeIcon, { 'intelligence-active': playMode === 3 }]"
                @click="togglePlayMode"
              ></i>
            </template>
            {{ playModeText }}
          </n-tooltip>
          <i class="iconfont icon-prev melo-bar-icon" @click="handlePrev"></i>
          <button class="melo-bar-play" @click="playMusicEvent">
            <i class="iconfont icon" :class="play ? 'icon-stop' : 'icon-play'"></i>
          </button>
          <i class="iconfont icon-next melo-bar-icon" @click="handleNext"></i>
          <div class="melo-bar-volume" @wheel.prevent="handleVolumeWheel">
            <i class="iconfont melo-bar-icon" :class="getVolumeIcon" @click="mute"></i>
            <n-slider
              v-model:value="volumeSlider"
              class="melo-bar-vol-slider custom-slider"
              :step="0.01"
              :tooltip="false"
              :disabled="isMuted"
            />
          </div>
        </div>
        <div class="melo-bar-progress custom-slider">
          <span class="melo-bar-time">{{ secondToMinute(timeSlider) }}</span>
          <n-slider
            v-model:value="timeSlider"
            :step="1"
            :max="allTime"
            :min="0"
            :tooltip="false"
            @dragstart="handleSliderDragStart"
            @dragend="handleSliderDragEnd"
          ></n-slider>
          <span class="melo-bar-time">{{ secondToMinute(allTime) }}</span>
        </div>
      </div>

      <div class="melo-bar-right">
        <n-tooltip v-if="isElectron" trigger="hover" :z-index="9999999">
          <template #trigger>
            <i
              class="iconfont ri-netease-cloud-music-line melo-bar-icon"
              :class="{ 'text-green-500': isLyricWindowOpen, 'disabled-icon': !playMusic?.id }"
              @click="playMusic?.id && openLyricWindow()"
            ></i>
          </template>
          {{ playMusic?.id ? t('player.playBar.lyric') : t('player.playBar.noSongPlaying') }}
        </n-tooltip>
        <div v-if="playMusic?.id && isElectron" class="melo-bar-extra">
          <n-tooltip trigger="hover" :z-index="9999999">
            <template #trigger>
              <reparse-popover v-if="playMusic?.id" />
            </template>
            {{ t('player.playBar.reparse') }}
          </n-tooltip>
          <n-tooltip trigger="hover" :z-index="9999999">
            <template #trigger>
              <i
                class="iconfont ri-download-line melo-bar-icon"
                :class="{ 'disabled-icon': isDownloading }"
                @click="playMusic?.id && handleDownload()"
              />
            </template>
            {{ isDownloading ? t('songItem.message.downloading') : t('player.playBar.download') }}
          </n-tooltip>
        </div>
        <n-tooltip trigger="hover" :z-index="9999999">
          <template #trigger>
            <i class="iconfont icon-list melo-bar-icon" @click="openPlayListDrawer"></i>
          </template>
          {{ t('player.playBar.playList') }}
        </n-tooltip>
      </div>
    </div>

    <template v-else>
      <div class="music-time custom-slider">
        <n-slider
          v-model:value="timeSlider"
          :step="1"
          :max="allTime"
          :min="0"
          :format-tooltip="formatTooltip"
          :show-tooltip="showSliderTooltip"
          @mouseenter="showSliderTooltip = true"
          @mouseleave="showSliderTooltip = false"
          @dragstart="handleSliderDragStart"
          @dragend="handleSliderDragEnd"
        ></n-slider>
      </div>
      <!-- 播放条空白区域点击进入详情页，由根节点的 handleBarClick 统一处理（#751） -->
      <div class="play-bar-img-wrapper">
        <n-image :src="barCover" class="play-bar-img" lazy preview-disabled />
        <div v-if="playMusic?.playLoading" class="loading-overlay">
          <i class="ri-loader-4-line loading-icon"></i>
        </div>
        <div class="hover-arrow">
          <div class="hover-content">
            <!-- <i class="ri-arrow-up-s-line text-3xl" :class="{ 'ri-arrow-down-s-line': musicFullVisible }"></i> -->
            <i
              class="text-3xl"
              :class="musicFullVisible ? 'ri-arrow-down-s-line' : 'ri-arrow-up-s-line'"
            ></i>
            <span class="hover-text">{{
              musicFullVisible ? t('player.playBar.collapse') : t('player.playBar.expand')
            }}</span>
          </div>
        </div>
      </div>
      <div class="music-content">
        <div class="music-content-title flex items-center">
          <n-ellipsis class="text-ellipsis" line-clamp="1">
            <p v-html="playMusic?.name || ''"></p>
          </n-ellipsis>
          <span v-if="playbackRate !== 1.0" class="playback-rate-badge"> {{ playbackRate }}x </span>
        </div>
        <div class="music-content-name">
          <n-ellipsis
            class="text-ellipsis"
            line-clamp="1"
            :tooltip="{
              contentStyle: { maxWidth: '600px' },
              zIndex: 99999
            }"
          >
            <span
              v-for="(artists, artistsindex) in artistList"
              :key="artistsindex"
              class="cursor-pointer hover:text-green-500"
              @click.stop="handleArtistClick(artists.id)"
            >
              {{ artists.name }}{{ artistsindex < artistList.length - 1 ? ' / ' : '' }}
            </span>
          </n-ellipsis>
        </div>
      </div>
      <div class="music-buttons">
        <div class="music-buttons-prev" @click="handlePrev">
          <i class="iconfont icon-prev"></i>
        </div>
        <div class="music-buttons-play" @click="playMusicEvent">
          <i class="iconfont icon" :class="play ? 'icon-stop' : 'icon-play'"></i>
        </div>
        <div class="music-buttons-next" @click="handleNext">
          <i class="iconfont icon-next"></i>
        </div>
      </div>
      <div class="audio-button">
        <div class="audio-volume custom-slider" @wheel.prevent="handleVolumeWheel">
          <div class="volume-icon" @click="mute">
            <i class="iconfont" :class="getVolumeIcon"></i>
          </div>
          <div class="volume-slider">
            <div class="volume-percentage" :class="{ 'volume-percentage-disabled': isMuted }">
              {{ Math.round(volumeSlider) }}%
            </div>
            <n-slider
              v-model:value="volumeSlider"
              :step="0.01"
              :tooltip="false"
              :disabled="isMuted"
              vertical
            ></n-slider>
          </div>
        </div>
        <n-tooltip v-if="!isMobile" trigger="hover" :z-index="9999999">
          <template #trigger>
            <i
              class="iconfont"
              :class="[playModeIcon, { 'intelligence-active': playMode === 3 }]"
              @click="togglePlayMode"
            ></i>
          </template>
          {{ playModeText }}
        </n-tooltip>
        <n-tooltip trigger="hover" :z-index="9999999">
          <template #trigger>
            <i
              class="iconfont ri-chat-3-line"
              :class="{ 'text-green-500': meloCommentsOpen }"
              @click="toggleComments"
            ></i>
          </template>
          评论
        </n-tooltip>
        <n-tooltip v-if="!isMobile" trigger="hover" :z-index="9999999">
          <template #trigger>
            <i
              class="iconfont"
              :class="{
                'like-active': isFavorite,
                'ri-heart-3-fill': isFavorite,
                'ri-heart-3-line': !isFavorite
              }"
              @click="toggleFavorite"
            ></i>
          </template>
          {{ t('player.playBar.like') }}
        </n-tooltip>
        <n-tooltip v-if="isElectron" class="music-lyric" trigger="hover" :z-index="9999999">
          <template #trigger>
            <i
              class="iconfont ri-netease-cloud-music-line"
              :class="{ 'text-green-500': isLyricWindowOpen, 'disabled-icon': !playMusic?.id }"
              @click="playMusic?.id && openLyricWindow()"
            ></i>
          </template>
          {{ playMusic?.id ? t('player.playBar.lyric') : t('player.playBar.noSongPlaying') }}
        </n-tooltip>
        <n-tooltip v-if="playMusic?.id && isElectron" trigger="hover" :z-index="9999999">
          <template #trigger>
            <reparse-popover v-if="playMusic?.id" />
          </template>
          {{ t('player.playBar.reparse') }}
        </n-tooltip>
        <n-tooltip v-if="playMusic?.id && isElectron" trigger="hover" :z-index="9999999">
          <template #trigger>
            <i
              class="iconfont ri-download-line"
              :class="{ 'disabled-icon': isDownloading }"
              @click="playMusic?.id && handleDownload()"
            />
          </template>
          {{ isDownloading ? t('songItem.message.downloading') : t('player.playBar.download') }}
        </n-tooltip>

        <!-- 高级控制菜单按钮（整合了 EQ、定时关闭、播放速度） -->
        <advanced-controls-popover />

        <n-tooltip trigger="hover" :z-index="9999999">
          <template #trigger>
            <i
              class="iconfont icon-list text-2xl hover:text-green-500 transition-colors cursor-pointer"
              @click="openPlayListDrawer"
            ></i>
          </template>
          {{ t('player.playBar.playList') }}
        </n-tooltip>
      </div>
    </template>
    <!-- 全屏播放器 -->
    <music-full-wrapper ref="MusicFullRef" v-model="musicFullVisible" :background="background" />
  </div>
</template>

<script lang="ts" setup>
import { useThrottleFn } from '@vueuse/core';
import { storeToRefs } from 'pinia';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import MusicFullWrapper from '@/components/lyric/MusicFullWrapper.vue';
import AdvancedControlsPopover from '@/components/player/AdvancedControlsPopover.vue';
import ReparsePopover from '@/components/player/ReparsePopover.vue';
import { meloCommentsOpen } from '@/hooks/meloComments';
import {
  allTime,
  artistList,
  isLyricWindowOpen,
  nowTime,
  openLyric,
  playMusic,
  textColors
} from '@/hooks/MusicHook';
import { useArtist } from '@/hooks/useArtist';
import { useDownload } from '@/hooks/useDownload';
import { useFavorite } from '@/hooks/useFavorite';
import { usePlaybackControl } from '@/hooks/usePlaybackControl';
import { usePlayMode } from '@/hooks/usePlayMode';
import { useVolumeControl } from '@/hooks/useVolumeControl';
import { audioService } from '@/services/audioService';
import { usePlayerStore } from '@/store/modules/player';
import { useSettingsStore } from '@/store/modules/settings';
import { getImgUrl, isElectron, isMobile, secondToMinute, setAnimationClass } from '@/utils';
import { useCachedImage } from '@/utils/imageCache';

const playerStore = usePlayerStore();
const settingsStore = useSettingsStore();
const { t } = useI18n();

const barCover = useCachedImage(() => getImgUrl(playMusic.value?.picUrl, '100y100'));

// 播放控制
const { isPlaying: play, playMusicEvent, handleNext, handlePrev } = usePlaybackControl();

// 音量控制
const {
  isMuted,
  volumeSlider,
  volumeIcon: getVolumeIcon,
  mute,
  handleVolumeWheel
} = useVolumeControl();

// 收藏
const { isFavorite, toggleFavorite } = useFavorite();

// 下载
const { downloadMusic, isDownloading } = useDownload();
const handleDownload = () => {
  if (!playMusic.value || isDownloading.value) return;
  downloadMusic(playMusic.value);
};

// 播放模式
const { playMode, playModeIcon, playModeText, togglePlayMode } = usePlayMode();

// 播放速度控制
const { playbackRate } = storeToRefs(playerStore);

// 背景颜色
const background = ref('#000');

watch(
  () => playerStore.playMusic,
  async () => {
    if (playMusic && playMusic.value && playMusic.value.backgroundColor) {
      background.value = playMusic.value.backgroundColor as string;
    }
  },
  { immediate: true, deep: true }
);

// 节流版本的 seek 函数
const throttledSeek = useThrottleFn((value: number) => {
  audioService.seek(value);
  nowTime.value = value;
}, 50);

// 拖动时的临时值
const dragValue = ref(0);
const isDragging = ref(false);

const timeSlider = computed({
  get: () => (isDragging.value ? dragValue.value : nowTime.value),
  set: (value) => {
    if (isDragging.value) {
      dragValue.value = value;
      return;
    }
    throttledSeek(value);
  }
});

const handleSliderDragStart = () => {
  isDragging.value = true;
  dragValue.value = nowTime.value;
};

const handleSliderDragEnd = () => {
  isDragging.value = false;
  audioService.seek(dragValue.value);
  nowTime.value = dragValue.value;
};

const formatTooltip = (value: number) => {
  return `${secondToMinute(value)} / ${secondToMinute(allTime.value)}`;
};

const MusicFullRef = ref<any>(null);
const showSliderTooltip = ref(false);

const musicFullVisible = computed({
  get: () => playerStore.musicFull,
  set: (value) => {
    playerStore.setMusicFull(value);
  }
});

// Melo 全屏页自带浅色背景，播放条保持首页原样，不透明也不改字色
const isMeloStyle = computed(() => settingsStore.setData?.playerStyle === 'melo');

const artistText = computed(() =>
  (artistList.value || [])
    .map((artist) => artist?.name)
    .filter(Boolean)
    .join(' / ')
);

// 全屏沉浸时字色跟随 Melo 页面的明暗主题，避免深色主题下白字看不见
const barColor = computed(() => {
  if (musicFullVisible.value) {
    if (isMeloStyle.value) return settingsStore.theme === 'dark' ? '#f0f1f6' : '#191a20';
    return textColors.value.theme === 'dark' ? '#000000' : '#ffffff';
  }
  return settingsStore.theme === 'dark' ? '#ffffff' : '#000000';
});

const setMusicFull = () => {
  musicFullVisible.value = !musicFullVisible.value;
  playerStore.setMusicFull(musicFullVisible.value);
  if (musicFullVisible.value) {
    settingsStore.showArtistDrawer = false;
  }
};

/**
 * 点击底部播放条的任意空白区域都能进入（退出）详情页（#751）
 * 只排除真正的交互控件，其余位置（封面、歌曲信息、按钮之间的空白）都可点击。
 * 全屏播放器由 n-drawer teleport 到 #layout-main，不在播放条节点内，无需额外排除。
 */
const IGNORE_FULL_TRIGGER_SELECTOR = [
  '.music-time', // 进度条（绝对定位覆盖播放条顶边）
  '.music-buttons-prev',
  '.music-buttons-play',
  '.music-buttons-next',
  '.audio-button', // 音量、播放模式、收藏、歌词、下载、更多、播放列表
  '.melo-bar-sub',
  '.melo-bar-center',
  '.melo-bar-right'
].join(', ');

const handleBarClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement | null;
  if (!target || target.closest(IGNORE_FULL_TRIGGER_SELECTOR)) return;
  setMusicFull();
};

const openLyricWindow = () => {
  openLyric();
};

const { navigateToArtist } = useArtist();

const handleArtistClick = (id: number) => {
  musicFullVisible.value = false;
  navigateToArtist(id);
};

const openPlayListDrawer = () => {
  playerStore.setPlayListDrawerVisible(true);
};

const toggleComments = () => {
  if (!playMusic.value) return;
  if (meloCommentsOpen.value) {
    meloCommentsOpen.value = false;
    return;
  }
  musicFullVisible.value = true;
  meloCommentsOpen.value = true;
};
</script>

<style lang="scss" scoped>
.text-ellipsis {
  width: 100%;
}

.music-play-bar {
  @apply h-20 w-full absolute bottom-0 left-0 flex items-center box-border px-6 py-2 pt-3;
  @apply bg-light dark:bg-dark shadow-2xl shadow-gray-300;
  z-index: 9999;
  animation-duration: 0.5s !important;
  /* 空白区域可点击展开详情页（#751） */
  cursor: pointer;

  .music-time {
    cursor: default;
  }

  &.play-bar-opcity {
    @apply bg-transparent !important;
    box-shadow: 0 0 20px 5px #0000001d;
  }

  &.animate__slideOutDown {
    animation-duration: 0.3s !important;
    pointer-events: none;
  }

  .music-content {
    width: 200px;
    @apply ml-4;

    &-title {
      @apply text-base;
    }

    &-name {
      @apply text-xs mt-1 opacity-80;
    }
  }
}

/* ---------- 第二风格（Melo）播放条 ---------- */
.music-play-bar.is-melo-bar {
  height: 92px;
  @apply px-6 py-0;
}

/* 全屏页打开时彻底融进 Melo 页面：没有底色、没有阴影，只剩悬浮控件 */
.music-play-bar.is-melo-bar.is-immersive {
  background: transparent !important;
  box-shadow: none !important;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.melo-bar {
  display: grid;
  grid-template-columns: minmax(200px, 1fr) minmax(360px, 1.8fr) minmax(170px, 1fr);
  align-items: center;
  gap: 24px;
  width: 100%;
  height: 100%;
}

.melo-bar-icon {
  font-size: 22px;
  cursor: pointer;
  transition: color 0.2s ease;
  &:hover {
    color: #22c16b;
  }
}

.melo-bar-left {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
  min-width: 0;
}

.melo-bar-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.melo-bar-title {
  font-size: 15px;
  font-weight: 600;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.melo-bar-artist {
  font-size: 13px;
  opacity: 0.6;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.melo-bar-loading {
  font-size: 14px;
  opacity: 0.6;
  animation: spin 1s linear infinite;
}

.melo-bar-sub {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-left: -2px;

  :deep(.advanced-controls-btn) {
    margin: 0;
  }
}

.melo-bar-center {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.melo-bar-transport {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 22px;
}

.melo-bar-play {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  flex: none;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  color: #fff;
  background: #22c16b;
  box-shadow: 0 6px 16px rgba(34, 193, 107, 0.32);
  transition:
    transform 0.15s ease,
    background 0.2s ease;

  &:hover {
    background: #1fae60;
    transform: scale(1.04);
  }

  .iconfont {
    font-size: 24px;
  }
}

.melo-bar-volume {
  display: flex;
  align-items: center;
  gap: 8px;
}

.melo-bar-vol-slider {
  width: 72px;
  flex: none;
}

.melo-bar-progress {
  display: flex;
  align-items: center;
  gap: 10px;

  .n-slider {
    flex: 1;
    min-width: 0;
  }
}

.melo-bar-time {
  font-size: 11px;
  opacity: 0.55;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.melo-bar-right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 18px;

  :deep(.advanced-controls-btn) {
    margin: 0;
  }
}

.melo-bar-extra {
  display: flex;
  align-items: center;
  gap: 18px;
}

@media (max-width: 1180px) {
  .melo-bar {
    grid-template-columns: minmax(150px, 1fr) minmax(320px, 1.6fr) auto;
    gap: 16px;
  }

  .melo-bar-transport {
    gap: 16px;
  }

  .melo-bar-extra {
    display: none;
  }
}

@media (max-width: 960px) {
  .melo-bar {
    grid-template-columns: minmax(120px, 1fr) minmax(280px, 1.7fr) auto;
    gap: 12px;
  }

  .melo-bar-artist,
  .melo-bar-vol-slider {
    display: none;
  }
}

.play-bar-img {
  @apply w-14 h-14 rounded-2xl;
}

.music-buttons {
  @apply mx-6 flex-1 flex justify-center;

  .iconfont {
    @apply text-2xl transition;
    @apply hover:text-green-500;
  }

  .icon {
    @apply text-3xl;
    @apply hover:text-green-500;
  }

  @apply flex items-center;

  > div {
    @apply cursor-pointer;
  }

  &-play {
    @apply flex justify-center items-center w-20 h-12 rounded-full mx-4 transition text-gray-500;
    @apply bg-gray-100 bg-opacity-60 dark:bg-gray-800 dark:bg-opacity-60 hover:bg-gray-200;
  }
}

.audio-volume {
  @apply flex items-center relative;
  &:hover {
    .volume-slider {
      @apply opacity-100 visible;
    }
  }
  .volume-icon {
    @apply cursor-pointer;
  }

  .iconfont {
    @apply text-2xl transition;
    @apply hover:text-green-500;
  }

  .volume-slider {
    @apply absolute opacity-0 invisible transition-all duration-300 bottom-[30px] left-1/2 -translate-x-1/2 h-[180px] px-2 py-4 rounded-xl;
    @apply bg-light dark:bg-dark-200;
    @apply border border-gray-200 dark:border-gray-700;

    .volume-percentage {
      @apply absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-medium bg-light dark:bg-dark-200 px-2 py-1 rounded-md;
      @apply border border-gray-200 dark:border-gray-700;
      @apply text-gray-800 dark:text-white;
      white-space: nowrap;

      &.volume-percentage-disabled {
        @apply text-gray-400 dark:text-gray-500;
      }
    }
  }
}

.audio-button {
  @apply flex items-center;

  .iconfont {
    @apply text-2xl transition cursor-pointer mx-3;
    @apply hover:text-green-500;
  }
}

.music-play {
  &-list {
    height: 50vh;
    width: 300px;
    @apply relative rounded-3xl overflow-hidden py-2;
    &-back {
      backdrop-filter: blur(20px);
      @apply absolute top-0 left-0 w-full h-full;
      @apply bg-light dark:bg-black bg-opacity-75;
    }
    &-content {
      @apply mx-2;
    }
  }
}

.mobile {
  .music-play-bar {
    @apply px-4 bottom-[56px] transition-all duration-300;
  }
  .music-time {
    display: none;
  }
  .ri-netease-cloud-music-line {
    display: none;
  }
  .audio-volume {
    display: none;
  }
  .audio-button {
    @apply mx-0;
  }
  .music-buttons {
    @apply m-0;
    &-prev,
    &-next {
      display: none;
    }
    &-play {
      @apply m-0;
    }
  }
  .music-content {
    flex: 1;
  }
}

// 自定义滑块样式
.custom-slider {
  :deep(.n-slider) {
    --n-rail-height: 4px;
    --n-rail-color: theme('colors.gray.200');
    --n-rail-color-dark: theme('colors.gray.700');
    --n-fill-color: theme('colors.green.500');
    --n-handle-size: 12px;
    --n-handle-color: theme('colors.green.500');

    &.n-slider--vertical {
      height: 100%;

      .n-slider-rail {
        width: 4px;
      }

      &:hover {
        .n-slider-rail {
          width: 6px;
        }

        .n-slider-handle {
          width: 14px;
          height: 14px;
        }
      }
    }

    .n-slider-rail {
      @apply overflow-hidden transition-all duration-200;
      @apply bg-gray-500 dark:bg-dark-300 bg-opacity-10 !important;
    }

    .n-slider-handle {
      @apply transition-all duration-200;
      opacity: 0;
    }

    &:hover {
      .n-slider-handle {
        opacity: 1;
      }
    }

    // 确保悬停时提示样式正确
    .n-slider-tooltip {
      @apply bg-dark-200 text-white text-xs py-1 px-2 rounded;
      z-index: 999999;
    }
  }
}

.play-bar-img-wrapper {
  @apply relative cursor-pointer w-14 h-14;

  .hover-arrow {
    @apply absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 rounded-2xl;
    background: rgba(0, 0, 0, 0.5);

    .hover-content {
      @apply flex flex-col items-center justify-center;

      i {
        @apply text-white mb-0.5;
      }

      .hover-text {
        @apply text-white text-xs scale-90;
      }
    }
  }

  &:hover {
    .hover-arrow {
      @apply opacity-100;
    }
  }
}

.tooltip-content {
  @apply text-sm py-1 px-2;
}

.play-bar-img {
  @apply w-14 h-14 rounded-2xl;
}

.like-active {
  @apply text-red-500 hover:text-red-600 !important;
}

.intelligence-active {
  @apply text-green-500 hover:text-green-600 !important;
}

.disabled-icon {
  @apply opacity-50 cursor-not-allowed !important;
  &:hover {
    @apply text-inherit !important;
  }
}

.icon-loop,
.icon-single-loop {
  font-size: 1.5rem;
}

.music-time .n-slider {
  position: absolute;
  top: 0;
  left: 0;
  padding: 0;
  border-radius: 0;
}

.music-eq {
  @apply p-4 rounded-3xl;
  backdrop-filter: blur(20px);
  @apply bg-light dark:bg-black bg-opacity-75;
}

.music-play-list-content {
  @apply mx-2;

  .delete-btn {
    @apply p-2 rounded-full transition-colors duration-200 cursor-pointer;
    @apply hover:bg-red-50 dark:hover:bg-red-900/20;

    .iconfont {
      @apply text-lg;
    }
  }
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.loading-overlay {
  @apply absolute inset-0 flex items-center justify-center rounded-2xl;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 2;
}

.loading-icon {
  font-size: 24px;
  color: white;
  animation: spin 1s linear infinite;
}

.play-speed {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0 8px;
}

.speed-button {
  font-size: 14px;
  color: var(--text-color);
  padding: 4px 8px;
  border-radius: 4px;
  background: var(--hover-color);
}

.speed-button:hover {
  background: var(--hover-color-dark);
}

.playback-rate-badge {
  @apply ml-2 px-1.5 h-4 flex items-center text-xs rounded bg-green-500 bg-opacity-15 text-green-600 dark:text-green-400;
  font-weight: 500;
  vertical-align: 1px;
}
</style>
