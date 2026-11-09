<template>
  <article class="melo-comment" :class="{ 'is-hot': hot }">
    <img
      v-if="comment.avatar"
      class="melo-comment-avatar"
      :src="comment.avatar"
      alt=""
      referrerpolicy="no-referrer"
    />
    <span v-else class="melo-comment-avatar is-fallback">
      {{ (comment.nick || '?').slice(0, 1) }}
    </span>
    <div class="melo-comment-main">
      <div class="melo-comment-meta">
        <span class="melo-comment-nick">{{ comment.nick || '匿名用户' }}</span>
        <span class="melo-comment-time">{{ formatTime(comment.time) }}</span>
      </div>
      <p class="melo-comment-content">
        <span v-if="comment.replyTo" class="melo-comment-replyto"
          >回复 @{{ comment.replyTo }}：</span
        >{{ comment.content }}
      </p>
      <div class="melo-comment-foot">
        <span v-if="hot" class="melo-comment-hot">热门</span>
        <span v-if="comment.liked" class="melo-comment-like">
          <i class="ri-heart-3-line" />{{ formatCount(comment.liked) }}
        </span>
        <button v-if="canShowReplies" class="melo-comment-reply-toggle" @click="toggleReplies">
          {{ replyToggleLabel }}
          <i :class="open ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'" />
        </button>
      </div>

      <div v-if="open" class="melo-replies">
        <div v-if="loading" class="melo-replies-hint">回复加载中…</div>
        <div v-else-if="replyError" class="melo-replies-hint">
          {{ replyError }}
          <button @click="loadReplies(0, true)">重试</button>
        </div>
        <div v-else-if="!replies.length" class="melo-replies-hint">还没有回复</div>
        <template v-else>
          <div v-for="reply in replies" :key="reply.id" class="melo-reply">
            <img
              v-if="reply.avatar"
              class="melo-reply-avatar"
              :src="reply.avatar"
              alt=""
              referrerpolicy="no-referrer"
            />
            <span v-else class="melo-reply-avatar is-fallback">
              {{ (reply.nick || '?').slice(0, 1) }}
            </span>
            <div class="melo-reply-main">
              <div class="melo-comment-meta">
                <span class="melo-comment-nick">{{ reply.nick || '匿名用户' }}</span>
                <span class="melo-comment-time">{{ formatTime(reply.time) }}</span>
              </div>
              <p class="melo-reply-content">
                <span v-if="reply.replyTo" class="melo-comment-replyto"
                  >回复 @{{ reply.replyTo }}：</span
                >{{ reply.content }}
              </p>
              <div v-if="reply.liked" class="melo-comment-foot">
                <span class="melo-comment-like">
                  <i class="ri-heart-3-line" />{{ formatCount(reply.liked) }}
                </span>
              </div>
            </div>
          </div>
          <button
            v-if="hasMore"
            class="melo-replies-more"
            :disabled="loadingMore"
            @click="loadReplies(page + 1)"
          >
            {{ loadingMore ? '加载中…' : '加载更多回复' }}
          </button>
        </template>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import type { CommentItem, CommentProvider } from '../../../shared/comments';

const props = defineProps<{
  comment: CommentItem;
  provider: CommentProvider;
  songId?: number;
  hot?: boolean;
}>();

const replies = ref<CommentItem[]>([...(props.comment.replies ?? [])]);
const open = ref(false);
const loaded = ref(props.provider === 'qq');
const loading = ref(false);
const loadingMore = ref(false);
const replyError = ref('');
const total = ref(0);
const page = ref(0);
const hasMore = ref(false);

// 网易云列表不带回复数，点开后才拿到 total；QQ 的回复已在列表里
const canShowReplies = computed(() => {
  if (props.provider === 'qq') return replies.value.length > 0;
  return !props.comment.replyTo && Boolean(props.songId);
});
const replyCount = computed(() => Math.max(total.value, replies.value.length));

const replyToggleLabel = computed(() => {
  if (open.value) return '收起回复';
  if (replyCount.value > 0) return `${replyCount.value} 条回复`;
  return '查看回复';
});

async function loadReplies(targetPage: number, reset = false): Promise<void> {
  if (!window.api?.getCommentReplies || !props.songId) return;
  if (reset) {
    loading.value = true;
    replyError.value = '';
  } else {
    loadingMore.value = true;
  }
  try {
    const result = await window.api.getCommentReplies(
      props.provider,
      props.comment.id,
      props.songId,
      targetPage
    );
    if (!result.ok) {
      replyError.value = result.error || '获取回复失败';
      return;
    }
    replyError.value = '';
    total.value = result.total;
    page.value = targetPage;
    hasMore.value = result.hasMore;
    if (reset) {
      replies.value = result.items;
    } else {
      const seen = new Set(replies.value.map((item) => item.id));
      replies.value = [...replies.value, ...result.items.filter((item) => !seen.has(item.id))];
    }
    loaded.value = true;
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

function toggleReplies(): void {
  if (open.value) {
    open.value = false;
    return;
  }
  open.value = true;
  if (props.provider === 'netease' && !loaded.value && !loading.value) {
    void loadReplies(0, true);
  }
}

function formatTime(ms: number): string {
  if (!ms) return '';
  const diff = Date.now() - ms;
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  if (diff < 30 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`;
  const date = new Date(ms);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatCount(count: number): string {
  return count >= 10000 ? `${(count / 10000).toFixed(1)}万` : String(count);
}
</script>

<style scoped>
.melo-comment {
  display: flex;
  gap: 10px;
  padding: 12px 0;
  border-bottom: 1px solid var(--melo-divider, rgba(25, 26, 32, 0.06));
}

.melo-comment.is-hot .melo-comment-content {
  color: var(--melo-text, rgba(25, 26, 32, 0.9));
}

.melo-comment-avatar {
  flex: none;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  background: var(--melo-fill, rgba(25, 26, 32, 0.06));
}

.melo-comment-avatar.is-fallback,
.melo-reply-avatar.is-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  color: #22c16b;
  background: rgba(34, 193, 107, 0.12);
}

.melo-comment-main {
  flex: 1;
  min-width: 0;
}

.melo-comment-meta {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.melo-comment-nick {
  font-size: 13px;
  font-weight: 600;
  color: var(--melo-text-body, rgba(25, 26, 32, 0.78));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.melo-comment-time {
  flex: none;
  font-size: 11px;
  color: var(--melo-text-time, rgba(25, 26, 32, 0.36));
}

.melo-comment-content {
  margin-top: 5px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--melo-text-body, rgba(25, 26, 32, 0.78));
  white-space: pre-wrap;
  word-break: break-word;
}

.melo-comment-replyto {
  color: #22c16b;
}

.melo-comment-foot {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 6px;
}

.melo-comment-hot {
  padding: 1px 7px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 600;
  color: #22c16b;
  background: rgba(34, 193, 107, 0.1);
}

.melo-comment-like {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: var(--melo-text-faint, rgba(25, 26, 32, 0.4));
}

.melo-comment-reply-toggle {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  border: none;
  padding: 0;
  background: transparent;
  font-size: 11px;
  color: var(--melo-text-muted, rgba(25, 26, 32, 0.45));
  cursor: pointer;
}

.melo-comment-reply-toggle:hover {
  color: #22c16b;
}

.melo-comment-reply-toggle i {
  font-size: 13px;
}

.melo-replies {
  margin-top: 10px;
  padding: 4px 0 2px 10px;
  border-left: 2px solid rgba(34, 193, 107, 0.16);
}

.melo-reply {
  display: flex;
  gap: 8px;
  padding: 7px 0;
}

.melo-reply-avatar {
  flex: none;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  object-fit: cover;
  background: var(--melo-fill, rgba(25, 26, 32, 0.06));
  font-size: 11px;
}

.melo-reply-main {
  flex: 1;
  min-width: 0;
}

.melo-reply-content {
  margin-top: 3px;
  font-size: 13px;
  line-height: 1.55;
  color: var(--melo-text-body, rgba(25, 26, 32, 0.7));
  white-space: pre-wrap;
  word-break: break-word;
}

.melo-replies-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  font-size: 11px;
  color: var(--melo-text-faint, rgba(25, 26, 32, 0.4));
}

.melo-replies-hint button {
  border: none;
  background: transparent;
  color: #22c16b;
  font-size: 11px;
  cursor: pointer;
}

.melo-replies-more {
  border: none;
  background: transparent;
  padding: 6px 0 2px;
  font-size: 11px;
  color: var(--melo-text-muted, rgba(25, 26, 32, 0.45));
  cursor: pointer;
}

.melo-replies-more:hover {
  color: #22c16b;
}
</style>
