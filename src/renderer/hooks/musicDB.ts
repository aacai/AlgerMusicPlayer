import useIndexedDB from '@/hooks/IndexDBHook';

// 单独成模块：MusicHook 里做 top-level await 会和 audioService →
// musicSource/cache → MusicHook 形成 TLA 循环，生产构建下缓存模块先执行，
// 解构 musicDB 时命中 TDZ 导致整个渲染进程白屏
export const musicDB = await useIndexedDB(
  'musicDB',
  [
    { name: 'music', keyPath: 'id' },
    { name: 'music_lyric', keyPath: 'id' },
    { name: 'api_cache', keyPath: 'id' },
    { name: 'music_url_cache', keyPath: 'id' },
    { name: 'music_failed_cache', keyPath: 'id' }
  ],
  3
);
