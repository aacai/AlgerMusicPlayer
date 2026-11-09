<template>
  <n-drawer
    v-model:show="isVisible"
    height="100%"
    placement="bottom"
    :mask-closable="false"
    :style="{ background: isDark ? '#101116' : '#F6F7FB' }"
    :to="`#layout-main`"
    :z-index="2500"
  >
    <div class="melo-page" :class="{ 'is-dark': isDark }">
      <!-- 背景：封面重度柔化 + 主色光斑 + 白色薄纱 -->
      <div class="melo-bg">
        <img v-if="displayCover" :src="displayCover" class="melo-bg-cover" alt="" />
        <span class="melo-blob melo-blob--a"></span>
        <span class="melo-blob melo-blob--b"></span>
        <span class="melo-blob melo-blob--c"></span>
        <span class="melo-veil"></span>
      </div>

      <div class="melo-shell" :class="{ 'is-wide': wideLayout }">
        <div class="melo-stage" :class="{ 'is-wide': wideLayout }">
          <!-- 宽屏常驻左侧歌词，窄屏点击唱盘后切到歌词 -->
          <section
            class="melo-lyrics-pane"
            :class="{ 'is-off': !wideLayout && !showLyrics }"
            @dblclick="closeLyrics"
          >
            <div v-if="!lrcArray.length" class="melo-lyrics-empty">
              <span>暂无歌词</span>
              <button class="melo-lyrics-back" @click="closeLyrics">返回唱片</button>
            </div>
            <div v-else ref="lyricScrollRef" class="melo-lyrics-scroller">
              <div class="melo-lyrics-pad"></div>
              <div
                v-for="(line, index) in lrcArray"
                :key="index"
                :data-index="index"
                class="melo-lyric-line"
                :class="{
                  'is-active': index === nowIndex,
                  'is-near': Math.abs(index - nowIndex) === 1
                }"
                @click="seekToLine(index)"
              >
                <span class="melo-lyric-text" :style="lineStyle(index)">{{ line.text }}</span>
                <span v-if="line.trText" class="melo-lyric-trans">{{ line.trText }}</span>
              </div>
              <div class="melo-lyrics-pad"></div>
            </div>
          </section>

          <section class="melo-disc-pane" :class="{ 'is-off': !wideLayout && showLyrics }">
            <div class="melo-deck-wrap">
              <div class="melo-deck" @click="openLyrics">
                <div class="melo-arm">
                  <span class="melo-arm-base"></span>
                  <span class="melo-arm-rod"></span>
                  <span class="melo-arm-head"></span>
                </div>
                <div class="melo-disc" :class="{ 'is-paused': !playerStore.isPlay }">
                  <span class="melo-vinyl"></span>
                  <img v-if="displayCover" :src="displayCover" class="melo-disc-cover" alt="" />
                  <span v-else class="melo-disc-cover melo-disc-fallback">{{ initial }}</span>
                  <span class="melo-spindle"></span>
                </div>
              </div>
              <div class="melo-song">
                <div class="melo-song-title">{{ songTitle }}</div>
                <div class="melo-song-artist">
                  <span>{{ artistText || '未知歌手' }}</span>
                  <span v-if="isLocal" class="melo-badge">本地</span>
                </div>
              </div>
              <button class="melo-mini-lyric" @click="openLyrics">
                <template v-if="currentLine">
                  <span class="melo-mini-current">{{ currentLine.text || '…' }}</span>
                  <span v-if="currentLine.trText" class="melo-mini-trans">
                    {{ currentLine.trText }}
                  </span>
                </template>
                <span v-else class="melo-mini-empty">
                  {{ lrcArray.length ? '…' : '暂无歌词' }}
                </span>
              </button>
            </div>
          </section>
        </div>
      </div>

      <melo-comments
        v-model="meloCommentsOpen"
        :name="songTitle"
        :artist="artistText"
        :netease-id="neteaseId"
      />
    </div>
  </n-drawer>
</template>

<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core';
import { computed, nextTick, ref, watch } from 'vue';

import { meloCommentsOpen } from '@/hooks/meloComments';
import { lrcArray, lrcTimeArray, nowIndex, nowTime, setAudioTime } from '@/hooks/MusicHook';
import { usePlayerStore } from '@/store/modules/player';
import { useSettingsStore } from '@/store/modules/settings';
import type { SongResult } from '@/types/music';
import { getImgUrl } from '@/utils';
import { useCachedImage } from '@/utils/imageCache';

import MeloComments from './MeloComments.vue';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:modelValue']);

const playerStore = usePlayerStore();
const settingsStore = useSettingsStore();
const isDark = computed(() => settingsStore.theme === 'dark');

const isVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});

const playMusic = computed(() => playerStore.playMusic as SongResult | null);
const cover = computed(() => getImgUrl(playMusic.value?.picUrl, '500y500') || '');
const displayCover = useCachedImage(cover);
const songTitle = computed(() => playMusic.value?.name || '还没有播放的歌曲');
const initial = computed(() => (playMusic.value?.name || 'M').slice(0, 1));

function songArtist(song: SongResult | null | undefined): string {
  if (!song) return '';
  const list = song.ar || song.song?.artists || [];
  return list
    .map((artist) => artist?.name)
    .filter(Boolean)
    .join(' / ');
}

const artistText = computed(() => songArtist(playMusic.value));
const isLocal = computed(() => !!playMusic.value?.playMusicUrl?.startsWith('local:///'));

const neteaseId = computed(() => {
  const song = playMusic.value;
  if (!song || song.source !== 'netease') return undefined;
  const id = Number(song.id);
  return Number.isFinite(id) && id > 0 ? id : undefined;
});

const showLyrics = ref(false);

// 大屏改为沉浸式双栏：左侧歌词常驻，右上角唱片
const wideLayout = useMediaQuery('(min-width: 960px)');
const lyricsVisible = computed(() => wideLayout.value || showLyrics.value);

const openLyrics = () => {
  if (wideLayout.value) return;
  showLyrics.value = true;
};

const closeLyrics = () => {
  if (wideLayout.value) return;
  showLyrics.value = false;
};

const currentLine = computed(() => {
  if (!lrcArray.value.length) return null;
  return lrcArray.value[nowIndex.value] || lrcArray.value[0];
});

const seekToLine = (index: number) => {
  setAudioTime(index);
};

// 当前高亮行进度：绿→灰渐变填充，形似 Melo 的逐句颜色推进
function lineStyle(index: number): Record<string, string> {
  if (index !== nowIndex.value) return {};
  const start = lrcTimeArray.value[index];
  const end = lrcTimeArray.value[index + 1];
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return {};
  const progress = Math.min(100, Math.max(0, ((nowTime.value - start) / (end - start)) * 100));
  const rest = isDark.value ? 'rgba(240, 241, 246, 0.34)' : 'rgba(25, 26, 32, 0.32)';
  return {
    backgroundImage: `linear-gradient(to right, #22C16B ${progress}%, ${rest} ${progress}%)`,
    backgroundClip: 'text',
    WebkitBackgroundClip: 'text',
    color: 'transparent'
  };
}

const lyricScrollRef = ref<HTMLElement | null>(null);

const scrollToActiveLine = async (smooth = true) => {
  if (!lyricsVisible.value) return;
  await nextTick();
  const container = lyricScrollRef.value;
  if (!container) return;
  const el = container.querySelector<HTMLElement>(`[data-index="${nowIndex.value}"]`);
  if (!el) return;
  // offsetTop 相对的是定位祖先（.melo-page），换算成滚动容器内的偏移再居中
  const offset =
    el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
  container.scrollTo({
    top: offset - container.clientHeight / 2 + el.clientHeight / 2,
    behavior: smooth ? 'smooth' : 'auto'
  });
};

watch(
  () => nowIndex.value,
  () => {
    if (lyricsVisible.value) void scrollToActiveLine();
  }
);

// 每次打开全屏页都先回到唱片页（宽屏双栏下歌词本就常驻）；关闭时收起评论面板
watch(isVisible, async (visible) => {
  if (visible) {
    showLyrics.value = false;
    await nextTick();
    void scrollToActiveLine(false);
  } else {
    meloCommentsOpen.value = false;
  }
});

// 切到歌词 / 跨过宽屏断点时，立即定位当前句
watch(lyricsVisible, (visible) => {
  if (visible) void scrollToActiveLine(false);
});
</script>

<style scoped>
.melo-page {
  --melo-bg: #f6f7fb;
  --melo-text: #191a20;
  --melo-text-soft: rgba(25, 26, 32, 0.55);
  --melo-text-body: rgba(25, 26, 32, 0.78);
  --melo-text-faint: rgba(25, 26, 32, 0.4);
  --melo-text-muted: rgba(25, 26, 32, 0.45);
  --melo-text-time: rgba(25, 26, 32, 0.36);
  --melo-text-ghost: rgba(25, 26, 32, 0.3);
  --melo-chip: rgba(255, 255, 255, 0.6);
  --melo-cover-opacity: 0.5;
  --melo-blob-opacity: 1;
  --melo-veil: linear-gradient(
    to bottom,
    rgba(255, 255, 255, 0.46),
    rgba(255, 255, 255, 0.2) 45%,
    rgba(255, 255, 255, 0.56)
  );
  --melo-deck-bg: linear-gradient(145deg, #edeef3, #c6c9d2);
  --melo-deck-shadow: 0 22px 48px rgba(25, 26, 32, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.8);
  --melo-arm-base: #9a9da6;
  --melo-arm-rod: #848894;
  --melo-arm-head: #6f7280;
  --melo-arm-highlight: rgba(255, 255, 255, 0.6);
  --melo-lyric: rgba(25, 26, 32, 0.34);
  --melo-lyric-near: rgba(25, 26, 32, 0.5);
  --melo-lyric-wide: rgba(25, 26, 32, 0.3);
  --melo-lyric-wide-near: rgba(25, 26, 32, 0.46);
  --melo-lyric-trans: rgba(25, 26, 32, 0.42);
  --melo-lyric-trans-active: rgba(25, 26, 32, 0.58);
  --melo-scrim: rgba(25, 26, 32, 0.14);
  --melo-panel: rgba(255, 255, 255, 0.94);
  --melo-panel-shadow: -20px 0 56px rgba(25, 26, 32, 0.14);
  --melo-fill: rgba(25, 26, 32, 0.06);
  --melo-fill-strong: rgba(25, 26, 32, 0.12);
  --melo-tab-active: #fff;
  --melo-divider: rgba(25, 26, 32, 0.06);

  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  color: var(--melo-text);
  font-family: var(--current-font-family, inherit);
}

.melo-page.is-dark {
  --melo-bg: #101116;
  --melo-text: #f0f1f6;
  --melo-text-soft: rgba(240, 241, 246, 0.62);
  --melo-text-body: rgba(240, 241, 246, 0.82);
  --melo-text-faint: rgba(240, 241, 246, 0.42);
  --melo-text-muted: rgba(240, 241, 246, 0.46);
  --melo-text-time: rgba(240, 241, 246, 0.36);
  --melo-text-ghost: rgba(240, 241, 246, 0.3);
  --melo-chip: rgba(255, 255, 255, 0.1);
  --melo-cover-opacity: 0.26;
  --melo-blob-opacity: 0.55;
  --melo-veil: linear-gradient(
    to bottom,
    rgba(16, 17, 22, 0.52),
    rgba(16, 17, 22, 0.3) 45%,
    rgba(16, 17, 22, 0.68)
  );
  --melo-deck-bg: linear-gradient(145deg, #2c2e36, #14151a);
  --melo-deck-shadow: 0 26px 56px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.08);
  --melo-arm-base: #71747f;
  --melo-arm-rod: #5b5e69;
  --melo-arm-head: #4a4d58;
  --melo-arm-highlight: rgba(255, 255, 255, 0.14);
  --melo-lyric: rgba(240, 241, 246, 0.3);
  --melo-lyric-near: rgba(240, 241, 246, 0.48);
  --melo-lyric-wide: rgba(240, 241, 246, 0.26);
  --melo-lyric-wide-near: rgba(240, 241, 246, 0.44);
  --melo-lyric-trans: rgba(240, 241, 246, 0.4);
  --melo-lyric-trans-active: rgba(240, 241, 246, 0.6);
  --melo-scrim: rgba(0, 0, 0, 0.42);
  --melo-panel: rgba(28, 29, 36, 0.94);
  --melo-panel-shadow: -20px 0 56px rgba(0, 0, 0, 0.45);
  --melo-fill: rgba(255, 255, 255, 0.07);
  --melo-fill-strong: rgba(255, 255, 255, 0.12);
  --melo-tab-active: #2c2e36;
  --melo-divider: rgba(255, 255, 255, 0.07);
}

/* ---------- 背景 ---------- */
.melo-bg {
  position: absolute;
  inset: 0;
  background: var(--melo-bg);
  overflow: hidden;
}

.melo-bg-cover {
  position: absolute;
  inset: -20%;
  width: 140%;
  height: 140%;
  object-fit: cover;
  filter: blur(64px) saturate(1.25);
  opacity: var(--melo-cover-opacity);
}

.melo-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(48px);
  opacity: var(--melo-blob-opacity);
}

.melo-blob--a {
  width: 62vmax;
  height: 62vmax;
  left: -22vmax;
  top: -24vmax;
  background: radial-gradient(circle, rgba(34, 193, 107, 0.42), rgba(34, 193, 107, 0));
}

.melo-blob--b {
  width: 66vmax;
  height: 66vmax;
  right: -28vmax;
  top: 20%;
  background: radial-gradient(circle, rgba(168, 214, 43, 0.34), rgba(168, 214, 43, 0));
}

.melo-blob--c {
  width: 58vmax;
  height: 58vmax;
  left: 6%;
  bottom: -32vmax;
  background: radial-gradient(circle, rgba(126, 140, 240, 0.32), rgba(126, 140, 240, 0));
}

.melo-veil {
  position: absolute;
  inset: 0;
  background: var(--melo-veil);
}

/* ---------- 骨架 ---------- */
.melo-shell {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  max-width: 560px;
  margin: 0 auto;
  /* 顶部让开应用标题栏，底部为播放条留出空间，全屏页不再自带控制条 */
  padding: calc(44px + 12px) 20px calc(112px + env(safe-area-inset-bottom));
}

.melo-shell.is-wide {
  max-width: 1180px;
  padding: calc(52px + 8px) 48px calc(112px + env(safe-area-inset-bottom));
}

.melo-stage {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* 窄屏：唱盘 / 歌词叠放切换 */
.melo-stage:not(.is-wide) > section {
  position: absolute;
  inset: 0;
  transition:
    opacity 0.24s ease,
    transform 0.24s ease;
}

.melo-stage:not(.is-wide) > section.is-off {
  opacity: 0;
  visibility: hidden;
  transform: translateY(10px);
  pointer-events: none;
  transition:
    opacity 0.24s ease,
    transform 0.24s ease,
    visibility 0s linear 0.24s;
}

/* 宽屏：左侧歌词常驻，右上角唱盘 */
.melo-stage.is-wide {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(300px, 380px);
  gap: clamp(28px, 4vw, 64px);
  align-items: stretch;
}

.melo-stage.is-wide .melo-lyrics-pane {
  min-width: 0;
  padding-left: clamp(0px, 2vw, 24px);
}

.melo-stage.is-wide .melo-disc-pane {
  min-width: 0;
}

.melo-stage.is-wide .melo-deck-wrap {
  justify-content: flex-start;
  padding-top: clamp(0px, 3vh, 28px);
}

.melo-stage.is-wide .melo-deck {
  flex: none;
  width: min(100%, clamp(260px, 27vw, 360px));
  max-width: none;
  max-height: none;
  margin: 0;
  border-radius: 26px;
}

.melo-stage.is-wide .melo-song {
  padding: 18px 8px 0;
}

.melo-stage.is-wide .melo-song-title {
  font-size: 22px;
}

.melo-stage.is-wide .melo-mini-lyric {
  display: none;
}

.melo-disc-pane {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  padding-top: 4px;
}

.melo-deck-wrap {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  align-items: center;
}

/* ---------- 唱盘 ---------- */
.melo-deck {
  position: relative;
  flex: 1;
  min-height: 0;
  width: 100%;
  max-width: 400px;
  max-height: 400px;
  aspect-ratio: 1 / 1;
  margin: auto 0;
  border-radius: 28px;
  background: var(--melo-deck-bg);
  box-shadow: var(--melo-deck-shadow);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.melo-arm {
  position: absolute;
  top: 0;
  right: 34px;
  width: 20px;
  height: 140px;
  transform-origin: 50% 0;
  transform: rotate(34deg);
  pointer-events: none;
}

.melo-arm-base {
  position: absolute;
  top: 0;
  left: 50%;
  width: 22px;
  height: 22px;
  margin-left: -11px;
  border-radius: 50%;
  background: var(--melo-arm-base);
  box-shadow: inset 0 1px 2px var(--melo-arm-highlight);
}

.melo-arm-rod {
  position: absolute;
  top: 12px;
  left: 50%;
  width: 6px;
  height: 112px;
  margin-left: -3px;
  border-radius: 3px;
  background: var(--melo-arm-rod);
}

.melo-arm-head {
  position: absolute;
  bottom: 0;
  left: 50%;
  width: 14px;
  height: 26px;
  margin-left: -7px;
  border-radius: 4px;
  background: var(--melo-arm-head);
}

.melo-disc {
  position: relative;
  width: 82%;
  aspect-ratio: 1 / 1;
  border-radius: 50%;
  animation: melo-spin 22s linear infinite;
}

.melo-disc.is-paused {
  animation-play-state: paused;
}

.melo-vinyl {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background:
    repeating-radial-gradient(circle at 50% 50%, #14151b 0 1.5px, #0b0c11 1.5px 3px),
    radial-gradient(circle at 32% 28%, rgba(255, 255, 255, 0.16), transparent 46%);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
}

.melo-disc-cover {
  position: absolute;
  left: 28%;
  top: 28%;
  width: 44%;
  height: 44%;
  border-radius: 50%;
  object-fit: cover;
}

.melo-disc-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #7e8cf0, #b08bf0);
  color: #fff;
  font-size: 40px;
  font-weight: 700;
}

.melo-spindle {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 12px;
  height: 12px;
  margin: -6px 0 0 -6px;
  border-radius: 50%;
  background: #0c0c12;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.12);
}

@keyframes melo-spin {
  to {
    transform: rotate(360deg);
  }
}

/* ---------- 歌曲信息 / 迷你歌词 ---------- */
.melo-song {
  flex: none;
  width: 100%;
  text-align: center;
  padding: 14px 8px 10px;
}

.melo-song-title {
  font-size: 24px;
  font-weight: 700;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.melo-song-artist {
  margin-top: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 14px;
  color: var(--melo-text-soft);
}

.melo-badge {
  border-radius: 10px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 500;
  color: #22c16b;
  background: var(--melo-chip);
}

.melo-mini-lyric {
  flex: none;
  width: 100%;
  height: 120px;
  border: none;
  cursor: pointer;
  background: transparent;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 20px;
  color: #22c16b;
}

.melo-mini-current {
  max-width: 100%;
  font-size: 17px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.melo-mini-trans {
  max-width: 100%;
  font-size: 14px;
  color: var(--melo-text-soft);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.melo-mini-empty {
  font-size: 13px;
  color: var(--melo-text-faint);
}

/* ---------- 完整歌词 ---------- */
.melo-lyrics-pane {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.melo-lyrics-scroller {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: none;
  -webkit-mask-image: linear-gradient(
    to bottom,
    transparent 0,
    #000 10%,
    #000 90%,
    transparent 100%
  );
  mask-image: linear-gradient(to bottom, transparent 0, #000 10%, #000 90%, transparent 100%);
}

.melo-lyrics-scroller::-webkit-scrollbar {
  display: none;
}

.melo-lyrics-pad {
  height: 38vh;
}

.melo-lyric-line {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 16px;
  border-radius: 10px;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.melo-lyric-text {
  font-size: 17px;
  line-height: 1.4;
  text-align: center;
  color: var(--melo-lyric);
  transition:
    font-size 0.2s ease,
    color 0.2s ease;
}

.melo-lyric-line.is-near .melo-lyric-text {
  color: var(--melo-lyric-near);
}

.melo-lyric-line.is-active .melo-lyric-text {
  font-size: 23px;
  font-weight: 700;
}

.melo-lyric-trans {
  font-size: 17px;
  line-height: 1.45;
  color: var(--melo-lyric-trans);
  text-align: center;
}

.melo-lyric-line.is-active .melo-lyric-trans {
  font-size: 18px;
  color: var(--melo-lyric-trans-active);
}

.melo-lyrics-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-size: 14px;
  color: var(--melo-text-muted);
}

.melo-lyrics-back {
  border: none;
  background: transparent;
  color: var(--melo-text-faint);
  font-size: 12px;
  cursor: pointer;
}

/* ---------- 宽屏歌词 ---------- */
.melo-stage.is-wide .melo-lyrics-pad {
  height: 30vh;
}

.melo-stage.is-wide .melo-lyric-line {
  align-items: flex-start;
  padding: 9px 0 9px 4px;
}

.melo-stage.is-wide .melo-lyric-text {
  font-size: 21px;
  text-align: left;
  color: var(--melo-lyric-wide);
}

.melo-stage.is-wide .melo-lyric-line.is-near .melo-lyric-text {
  color: var(--melo-lyric-wide-near);
}

.melo-stage.is-wide .melo-lyric-line.is-active .melo-lyric-text {
  font-size: 30px;
}

.melo-stage.is-wide .melo-lyric-trans {
  font-size: 20px;
  text-align: left;
}

.melo-stage.is-wide .melo-lyric-line.is-active .melo-lyric-trans {
  font-size: 21px;
}

.melo-stage.is-wide .melo-lyrics-back {
  display: none;
}
</style>
