// 网络图片（歌曲封面等）在渲染进程侧的一层 LRU：
// 主进程负责磁盘缓存，这里避免同一张图反复走 IPC；同 URL 并发请求合并。

import { type MaybeRefOrGetter, ref, toValue, watch } from 'vue';

const MAX_ENTRIES = 400;

const cache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

function remember(url: string, resolved: string): void {
  cache.delete(url);
  cache.set(url, resolved);
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

export function getCachedImageUrl(url?: string): string {
  if (!url) return '';
  const hit = cache.get(url);
  if (!hit) return '';
  remember(url, hit);
  return hit;
}

/**
 * 解析图片地址：优先主进程磁盘缓存返回的 local://，失败时回退原远程地址。
 * 失败结果不缓存，下次仍会重试。
 */
export async function resolveCachedImage(url?: string): Promise<string> {
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) return url;

  const hit = getCachedImageUrl(url);
  if (hit) return hit;

  const pending = inflight.get(url);
  if (pending) return pending;

  const task = (async () => {
    try {
      const result = await window.api?.cacheImage?.(url);
      if (result?.ok && result.url) {
        remember(url, result.url);
        return result.url;
      }
    } catch {
      // 缓存不可用时按原图加载
    }
    return url;
  })();

  inflight.set(url, task);
  void task.then(
    () => inflight.delete(url),
    () => inflight.delete(url)
  );
  return task;
}

/**
 * 响应式封面地址：来源变化时先查会话缓存，再走主进程磁盘缓存，
 * 最终拿不到本地文件时回退远程地址。
 */
export function useCachedImage(source: MaybeRefOrGetter<string | undefined>) {
  const resolved = ref('');
  let seq = 0;

  watch(
    () => toValue(source),
    async (url) => {
      const token = ++seq;
      if (!url) {
        resolved.value = '';
        return;
      }
      const hit = getCachedImageUrl(url);
      if (hit) {
        resolved.value = hit;
        return;
      }
      const local = await resolveCachedImage(url);
      if (token === seq) resolved.value = local || url;
    },
    { immediate: true }
  );

  return resolved;
}
