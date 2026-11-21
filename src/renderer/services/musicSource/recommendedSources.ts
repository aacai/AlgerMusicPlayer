export interface RecommendedMusicSource {
  name: string;
  url: string;
}

/** 已在本机沙箱里实测能成功装载的 LX 音源 */
export const recommendedMusicSources: RecommendedMusicSource[] = [
  {
    name: 'Huibq',
    url: 'https://raw.githubusercontent.com/pdone/lx-music-source/main/huibq/latest.js'
  },
  {
    name: '野花',
    url: 'https://raw.githubusercontent.com/pdone/lx-music-source/main/flower/latest.js'
  },
  {
    name: '星海',
    url: 'https://raw.githubusercontent.com/tfappstore/lx-music-source/main/xinghai/latest.js'
  },
  {
    name: '念心',
    url: 'https://raw.githubusercontent.com/tfappstore/lx-music-source/main/nianxin/latest.js'
  },
  {
    name: '长青',
    url: 'https://raw.githubusercontent.com/tfappstore/lx-music-source/main/changqing/latest.js'
  },
  {
    name: '野草',
    url: 'https://raw.githubusercontent.com/tfappstore/lx-music-source/main/grass/latest.js'
  },
  {
    name: 'Kulao',
    url: 'https://raw.githubusercontent.com/tfappstore/lx-music-source/main/kulao/latest.js'
  },
  {
    name: '全都要',
    url: 'https://raw.githubusercontent.com/tfappstore/lx-music-source/main/quandouyao/latest.js'
  },
  {
    name: '音音',
    url: 'https://raw.githubusercontent.com/tfappstore/lx-music-source/main/yiyin/latest.js'
  },
  {
    name: '下载器',
    url: 'https://raw.githubusercontent.com/tfappstore/lx-music-source/main/xiazaiqi/latest.js'
  }
];
