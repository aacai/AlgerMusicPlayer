import './index.css';
import '@/assets/css/mobile.css';
import 'animate.css';
import 'remixicon/fonts/remixicon.css';

import { createApp } from 'vue';

import i18n from '@/../i18n/renderer';
import router from '@/router';
import { installNativeCommentsApi } from '@/services/nativeComments';
import pinia from '@/store';
import { usePlayerStore } from '@/store/modules/player';
import { isElectron } from '@/utils';

import App from './App.vue';
import directives from './directive';

// Web 端注册最小 Service Worker，使站点满足 PWA 可安装条件（#640/#382）
if (!isElectron && import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('[PWA] Service Worker 注册失败:', error);
    });
  });
}

const app = createApp(App);

Object.keys(directives).forEach((key: string) => {
  app.directive(key, directives[key as keyof typeof directives]);
});

app.use(pinia);
app.use(router);
app.use(i18n as any);

// 安卓物理返回键：优先关全屏播放页，其次退回上一路由，首页才交给系统退出
if (!isElectron) {
  // Android 没有 Electron preload，这里补上评论 API
  installNativeCommentsApi();
  (window as unknown as { __algerBack?: () => boolean }).__algerBack = () => {
    // Melo 歌词详情页优先退回唱片页，不直接关闭全屏播放页
    const meloBack = (window as unknown as { __algerMeloBack?: () => boolean }).__algerMeloBack;
    if (meloBack?.()) return true;
    const playerStore = usePlayerStore();
    if (playerStore.musicFull) {
      playerStore.setMusicFull(false);
      return true;
    }
    const historyState = window.history.state as { back?: number } | null;
    if (typeof historyState?.back === 'number') {
      router.back();
      return true;
    }
    if (router.currentRoute.value.path !== '/') {
      router.push('/');
      return true;
    }
    return false;
  };
}

app.mount('#app');
