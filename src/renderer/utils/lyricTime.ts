import { secondToMinute } from './time';

/** 拖动歌词时展示的时间范围：当前句开始时间到下一句开始时间 */
export function formatLyricTimeRange(start: number, end: number): string {
  const safeStart = Number.isFinite(start) && start > 0 ? start : 0;
  const safeEnd = Number.isFinite(end) && end > safeStart ? end : safeStart;
  return `${secondToMinute(safeStart)} – ${secondToMinute(safeEnd)}`;
}

/** 当前句已唱到的字符数，用于跨行连续着色 */
export function lyricSungCharCount(text: string, start: number, end: number, now: number): number {
  if (!text || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  const progress = Math.min(1, Math.max(0, (now - start) / (end - start)));
  return Math.round(text.length * progress);
}
