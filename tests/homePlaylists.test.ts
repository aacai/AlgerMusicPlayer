import { describe, expect, it } from 'vitest';

import { normalizePersonalizedPlaylists } from '../src/renderer/api/homeResponse';

const playlists = [
  { id: 1, name: '歌单一', picUrl: 'https://example.com/1.jpg' },
  { id: 2, name: '歌单二', picUrl: 'https://example.com/2.jpg' }
];

describe('normalizePersonalizedPlaylists', () => {
  it('从 axios 响应中取出 result 数组', () => {
    expect(normalizePersonalizedPlaylists({ data: { code: 200, result: playlists } })).toEqual(
      playlists
    );
  });

  it('兼容双层 data 包装', () => {
    expect(
      normalizePersonalizedPlaylists({ data: { data: { code: 200, result: playlists } } })
    ).toEqual(playlists);
  });

  it('直接传 result 数组也能识别', () => {
    expect(normalizePersonalizedPlaylists(playlists)).toEqual(playlists);
  });

  it('空响应返回空数组而不是对象', () => {
    expect(normalizePersonalizedPlaylists({ data: { code: 200 } })).toEqual([]);
    expect(normalizePersonalizedPlaylists(undefined)).toEqual([]);
    expect(normalizePersonalizedPlaylists(null)).toEqual([]);
  });
});
