<template>
  <transition name="melo-comments-fade">
    <div v-if="modelValue" class="melo-comments-layer" @click.self="close">
      <aside class="melo-comments">
        <header class="melo-comments-head">
          <div class="min-w-0">
            <h3 class="melo-comments-title">评论</h3>
            <p class="melo-comments-song">{{ songLine }}</p>
          </div>
          <button class="melo-comments-close" aria-label="关闭评论" @click="close">
            <i class="ri-close-line" />
          </button>
        </header>

        <div class="melo-comments-tabs">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            class="melo-comments-tab"
            :class="{ 'is-active': provider === tab.key }"
            @click="switchProvider(tab.key)"
          >
            {{ tab.label }}
          </button>
          <span v-if="total" class="melo-comments-total">{{ totalLabel }}</span>
        </div>

        <div ref="bodyRef" class="melo-comments-body">
          <div v-if="loading" class="melo-comments-hint">评论加载中…</div>
          <div v-else-if="error" class="melo-comments-hint">
            <span>{{ error }}</span>
            <button class="melo-comments-retry" @click="load(0, true)">重试</button>
          </div>
          <div v-else-if="!items.length" class="melo-comments-hint">还没有评论</div>
          <template v-else>
            <template v-if="hot.length">
              <p class="melo-comments-section">热门评论</p>
              <melo-comment-item
                v-for="comment in hot"
                :key="`hot-${comment.id}`"
                :comment="comment"
                :provider="provider"
                :song-id="songId"
                hot
              />
              <p class="melo-comments-section">最新评论</p>
            </template>
            <melo-comment-item
              v-for="comment in items"
              :key="comment.id"
              :comment="comment"
              :provider="provider"
              :song-id="songId"
            />
            <div class="melo-comments-more">
              <button v-if="hasMore" :disabled="loadingMore" @click="load(page + 1)">
                {{ loadingMore ? '加载中…' : '加载更多' }}
              </button>
              <span v-else>没有更多评论了</span>
            </div>
          </template>
        </div>
      </aside>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

import type { CommentItem, CommentProvider } from '../../../shared/comments';
import MeloCommentItem from './MeloCommentItem.vue';

const props = defineProps<{
  modelValue: boolean;
  name: string;
  artist: string;
  neteaseId?: number;
}>();

const emit = defineEmits(['update:modelValue']);

const tabs: { key: CommentProvider; label: string }[] = [
  { key: 'netease', label: '网易云' },
  { key: 'qq', label: 'QQ 音乐' }
];

const provider = ref<CommentProvider>(
  localStorage.getItem('alger.melo.comments.provider') === 'qq' ? 'qq' : 'netease'
);
const bodyRef = ref<HTMLElement | null>(null);
const items = ref<CommentItem[]>([]);
const hot = ref<CommentItem[]>([]);
const total = ref(0);
const songId = ref<number>();
const page = ref(0);
const loading = ref(false);
const loadingMore = ref(false);
const error = ref('');
let seq = 0;

const songLine = computed(() => {
  const name = props.name?.trim();
  if (!name) return '';
  return props.artist ? `${name} · ${props.artist}` : name;
});

const totalLabel = computed(() =>
  total.value >= 10000 ? `${(total.value / 10000).toFixed(1)} 万条` : `${total.value} 条`
);

const hasMore = computed(() => items.value.length > 0 && items.value.length < total.value);

function close(): void {
  emit('update:modelValue', false);
}

function reset(): void {
  items.value = [];
  hot.value = [];
  total.value = 0;
  songId.value = undefined;
}

async function load(targetPage: number, isReset = false): Promise<void> {
  if (!window.api?.getComments || !props.name) return;
  const mySeq = ++seq;
  if (isReset) {
    loading.value = true;
    error.value = '';
  } else {
    loadingMore.value = true;
  }
  try {
    const result = await window.api.getComments(
      provider.value,
      props.name,
      props.artist,
      targetPage,
      provider.value === 'netease' ? props.neteaseId : undefined
    );
    if (mySeq !== seq) return;
    if (!result.ok) {
      if (isReset) reset();
      error.value = result.error || '获取评论失败';
      return;
    }
    error.value = '';
    total.value = result.total;
    songId.value = result.songId;
    page.value = targetPage;
    if (isReset) {
      items.value = result.items;
      hot.value = result.hot;
      bodyRef.value?.scrollTo({ top: 0 });
    } else {
      const seen = new Set(items.value.map((item) => item.id));
      items.value = [...items.value, ...result.items.filter((item) => !seen.has(item.id))];
    }
  } finally {
    if (mySeq === seq) {
      loading.value = false;
      loadingMore.value = false;
    }
  }
}

function switchProvider(next: CommentProvider): void {
  if (next === provider.value) return;
  provider.value = next;
  localStorage.setItem('alger.melo.comments.provider', next);
  reset();
  void load(0, true);
}

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) void load(0, true);
  }
);

// 从底栏入口直接打开时，全屏页可能是挂载时才首次可见
onMounted(() => {
  if (props.modelValue) void load(0, true);
});

// 全屏页里切歌时，面板如果开着就跟着刷新
watch(
  () => [props.name, props.artist] as const,
  () => {
    if (!props.modelValue) return;
    reset();
    void load(0, true);
  }
);
</script>

<style scoped>
.melo-comments-layer {
  position: absolute;
  inset: 0;
  z-index: 6;
  display: flex;
  justify-content: flex-end;
  background: var(--melo-scrim, rgba(25, 26, 32, 0.14));
}

.melo-comments {
  display: flex;
  flex-direction: column;
  width: min(400px, 92%);
  height: 100%;
  background: var(--melo-panel, rgba(255, 255, 255, 0.94));
  backdrop-filter: blur(32px) saturate(1.4);
  border-radius: 28px 0 0 28px;
  box-shadow: var(--melo-panel-shadow, -20px 0 56px rgba(25, 26, 32, 0.14));
  overflow: hidden;
}

.melo-comments-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 26px 22px 0;
}

.melo-comments-title {
  font-size: 19px;
  font-weight: 700;
  line-height: 1.2;
}

.melo-comments-song {
  margin-top: 6px;
  font-size: 12px;
  color: var(--melo-text-soft, rgba(25, 26, 32, 0.5));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 300px;
}

.melo-comments-close {
  flex: none;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 50%;
  background: var(--melo-fill, rgba(25, 26, 32, 0.06));
  color: var(--melo-text-soft, rgba(25, 26, 32, 0.6));
  font-size: 17px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease;
}

.melo-comments-close:hover {
  background: var(--melo-fill-strong, rgba(25, 26, 32, 0.12));
}

.melo-comments-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 16px 22px 0;
  padding: 3px;
  border-radius: 999px;
  background: var(--melo-fill, rgba(25, 26, 32, 0.05));
}

.melo-comments-tab {
  flex: 1;
  border: none;
  border-radius: 999px;
  padding: 7px 0;
  background: transparent;
  color: var(--melo-text-soft, rgba(25, 26, 32, 0.55));
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition:
    background 0.15s ease,
    color 0.15s ease;
}

.melo-comments-tab.is-active {
  background: var(--melo-tab-active, #fff);
  color: #22c16b;
  font-weight: 600;
  box-shadow: 0 2px 8px var(--melo-fill, rgba(25, 26, 32, 0.08));
}

.melo-comments-total {
  flex: none;
  padding-right: 10px;
  font-size: 11px;
  color: var(--melo-text-faint, rgba(25, 26, 32, 0.4));
}

.melo-comments-body {
  flex: 1;
  min-height: 0;
  margin-top: 10px;
  padding: 0 22px 24px;
  overflow-y: auto;
  scrollbar-width: none;
}

.melo-comments-body::-webkit-scrollbar {
  display: none;
}

.melo-comments-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 80px 0;
  font-size: 13px;
  color: var(--melo-text-muted, rgba(25, 26, 32, 0.45));
  text-align: center;
}

.melo-comments-retry {
  border: none;
  border-radius: 999px;
  padding: 6px 16px;
  background: rgba(34, 193, 107, 0.12);
  color: #22c16b;
  font-size: 12px;
  cursor: pointer;
}

.melo-comments-section {
  margin: 14px 0 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--melo-text-muted, rgba(25, 26, 32, 0.42));
}

.melo-comments-more {
  padding: 18px 0 8px;
  text-align: center;
  font-size: 12px;
  color: var(--melo-text-time, rgba(25, 26, 32, 0.36));
}

.melo-comments-more button {
  border: none;
  border-radius: 999px;
  padding: 7px 20px;
  background: var(--melo-fill, rgba(25, 26, 32, 0.05));
  color: var(--melo-text-soft, rgba(25, 26, 32, 0.6));
  font-size: 12px;
  cursor: pointer;
}

.melo-comments-more button:hover {
  background: var(--melo-fill-strong, rgba(25, 26, 32, 0.09));
}

.melo-comments-fade-enter-active,
.melo-comments-fade-leave-active {
  transition: opacity 0.18s ease;
}

.melo-comments-fade-enter-active .melo-comments,
.melo-comments-fade-leave-active .melo-comments {
  transition: transform 0.22s ease;
}

.melo-comments-fade-enter-from,
.melo-comments-fade-leave-to {
  opacity: 0;
}

.melo-comments-fade-enter-from .melo-comments,
.melo-comments-fade-leave-to .melo-comments {
  transform: translateX(28px);
}
</style>
