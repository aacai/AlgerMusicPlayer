// 网络图片本地缓存（歌曲封面等）：
// 主进程按 LRU 落盘，渲染进程拿 local:// 直接加载，命中时不再走网络。

export type CachedImageResult =
  { ok: true; url: string; cached: boolean } | { ok: false; error: string };
