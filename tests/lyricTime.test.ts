import { describe, expect, it } from 'vitest';

import { formatLyricTimeRange, lyricSungCharCount } from '@/utils/lyricTime';

describe('歌词拖动时间提示', () => {
  it('显示当前句到下一句的时间范围', () => {
    expect(formatLyricTimeRange(82, 88)).toBe('01:22 – 01:28');
  });

  it('最后一句没有结束时间时只显示开始时间', () => {
    expect(formatLyricTimeRange(82, 0)).toBe('01:22 – 01:22');
  });

  it('非法时间回退到 00:00', () => {
    expect(formatLyricTimeRange(Number.NaN, Number.NaN)).toBe('00:00 – 00:00');
  });

  it('长句换行的着色进度按整句字符连续计算', () => {
    const text = 'And I cried like a baby coming home from the bar (Oh)';
    expect(lyricSungCharCount(text, 0, 10, 5)).toBe(Math.round(text.length / 2));
    expect(lyricSungCharCount(text, 0, 10, 20)).toBe(text.length);
    expect(lyricSungCharCount(text, 0, 0, 5)).toBe(0);
  });
});
