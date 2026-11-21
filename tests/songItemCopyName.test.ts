import { afterEach, describe, expect, it, vi } from 'vitest';

import { copyText } from '@/utils/clipboard';

import en from '../src/i18n/lang/en-US/songItem';
import ja from '../src/i18n/lang/ja-JP/songItem';
import ko from '../src/i18n/lang/ko-KR/songItem';
import zhCN from '../src/i18n/lang/zh-CN/songItem';
import zhHant from '../src/i18n/lang/zh-Hant/songItem';

describe('song item 长按复制歌名', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('优先使用 Clipboard API', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    await expect(copyText('Cruel Summer')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('Cruel Summer');
  });

  it('Clipboard API 不可用时回退到 execCommand', async () => {
    const textarea = { value: '', style: {}, select: vi.fn(), remove: vi.fn() };
    const execCommand = vi.fn().mockReturnValue(true);
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('document', {
      createElement: () => textarea,
      body: { appendChild: vi.fn() },
      execCommand
    });

    await expect(copyText('本地歌曲')).resolves.toBe(true);
    expect(textarea.value).toBe('本地歌曲');
    expect(textarea.select).toHaveBeenCalled();
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(textarea.remove).toHaveBeenCalled();
  });

  it('空歌名返回失败', async () => {
    await expect(copyText('')).resolves.toBe(false);
  });

  it('五种语言都有复制歌名文案', () => {
    for (const locale of [zhCN, zhHant, en, ja, ko]) {
      expect(locale.menu.copyName).toBeTruthy();
    }
  });
});
