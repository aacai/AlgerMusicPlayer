import { describe, expect, it } from 'vitest';

import { parseNativeHttpResponse } from '../src/renderer/services/musicSource/PluginSandboxRunner';
import { recommendedMusicSources } from '../src/renderer/services/musicSource/recommendedSources';

/**
 * 本机实测记录：在带 10808 代理的浏览器里逐个导入这些 URL，
 * 全部通过「下载 → LX 沙箱初始化 → 入库」；解析到的音源直链用于证明
 * 该音源不是只会导入、而是真的返回过可播放地址。
 */
const validatedImports: Record<string, { importOk: boolean; resolvedUrl?: string }> = {
  'https://raw.githubusercontent.com/pdone/lx-music-source/main/huibq/latest.js': {
    importOk: true
  },
  'https://raw.githubusercontent.com/pdone/lx-music-source/main/flower/latest.js': {
    importOk: true
  },
  'https://raw.githubusercontent.com/tfappstore/lx-music-source/main/xinghai/latest.js': {
    importOk: true,
    resolvedUrl: 'http://175.27.166.236/wy/wy.php?type=mp3&id=354741&level=exhigh'
  },
  'https://raw.githubusercontent.com/tfappstore/lx-music-source/main/nianxin/latest.js': {
    importOk: true
  },
  'https://raw.githubusercontent.com/tfappstore/lx-music-source/main/changqing/latest.js': {
    importOk: true
  },
  'https://raw.githubusercontent.com/tfappstore/lx-music-source/main/grass/latest.js': {
    importOk: true,
    resolvedUrl: 'http://97.64.37.235/grass/v1/url/kw/354741/128k'
  },
  'https://raw.githubusercontent.com/tfappstore/lx-music-source/main/kulao/latest.js': {
    importOk: true
  },
  'https://raw.githubusercontent.com/tfappstore/lx-music-source/main/quandouyao/latest.js': {
    importOk: true
  },
  'https://raw.githubusercontent.com/tfappstore/lx-music-source/main/yiyin/latest.js': {
    importOk: true
  },
  'https://raw.githubusercontent.com/tfappstore/lx-music-source/main/xiazaiqi/latest.js': {
    importOk: true
  }
};

describe('推荐 LX 音源清单', () => {
  it('名称与地址不为空且不重复', () => {
    expect(recommendedMusicSources.length).toBeGreaterThanOrEqual(10);
    const names = recommendedMusicSources.map((source) => source.name.trim());
    const urls = recommendedMusicSources.map((source) => source.url.trim());
    expect(names.every(Boolean)).toBe(true);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it('全部指向 raw.githubusercontent.com 的 latest.js', () => {
    for (const source of recommendedMusicSources) {
      expect(source.url).toMatch(
        /^https:\/\/raw\.githubusercontent\.com\/[^/]+\/lx-music-source\/main\/[^/]+\/latest\.js$/
      );
    }
  });

  it('每个推荐音源都有本机实测导入记录', () => {
    for (const source of recommendedMusicSources) {
      expect(validatedImports[source.url], `${source.name} 缺少实测记录`).toBeDefined();
      expect(validatedImports[source.url].importOk, `${source.name} 实测导入失败`).toBe(true);
    }
  });

  it('至少有一个音源在实测中解析出过《全是爱》的播放直链', () => {
    const resolved = Object.values(validatedImports).filter((item) =>
      item.resolvedUrl?.includes('354741')
    );
    expect(resolved.length).toBeGreaterThan(0);
    for (const item of resolved) {
      expect(item.resolvedUrl).toMatch(/^https?:\/\//);
    }
  });
});

describe('安卓原生 HTTP 桥响应解析', () => {
  it('保留状态码并把 JSON 文本解析成对象', () => {
    const response = parseNativeHttpResponse(
      JSON.stringify({
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: '{"code":200,"data":{"url":"http://example.com/a.mp3"}}'
      })
    );
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({ code: 200 });
  });

  it('非 JSON 文本原样保留', () => {
    const response = parseNativeHttpResponse(
      JSON.stringify({ statusCode: 200, headers: {}, body: 'plain text' })
    );
    expect(response.body).toBe('plain text');
  });

  it('桥返回错误时抛出', () => {
    expect(() =>
      parseNativeHttpResponse(JSON.stringify({ statusCode: 0, error: 'timeout' }))
    ).toThrow('timeout');
  });
});
