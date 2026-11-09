import { ref } from 'vue';

// 缩放相关常量
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.1;

// 模块级共享状态：搜索栏与快捷键操作同一份缩放比例
const zoomFactor = ref(1);
let initialized = false;
let shortcutsBound = false;

// 初始化获取当前缩放比例
const initZoomFactor = async () => {
  if (!window.ipcRenderer) return;
  try {
    const currentZoom = await window.ipcRenderer.invoke('get-content-zoom');
    zoomFactor.value = currentZoom;
  } catch (error) {
    console.error('获取缩放比例失败:', error);
  }
};

// 设置缩放比例
const setZoomFactor = (zoom: number) => {
  const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(zoom * 100) / 100));
  window.ipcRenderer?.send('set-content-zoom', next);
  zoomFactor.value = next;
};

// 增加缩放比例，保证100%为节点
const increaseZoom = () => {
  if (zoomFactor.value < 1.0 && zoomFactor.value + ZOOM_STEP > 1.0) {
    setZoomFactor(1.0);
    return;
  }

  setZoomFactor(zoomFactor.value + ZOOM_STEP);
};

// 减少缩放比例，保证100%为节点
const decreaseZoom = () => {
  if (zoomFactor.value > 1.0 && zoomFactor.value - ZOOM_STEP < 1.0) {
    setZoomFactor(1.0);
    return;
  }

  setZoomFactor(zoomFactor.value - ZOOM_STEP);
};

// 重置缩放比例
const resetZoom = () => {
  setZoomFactor(1);
};

// 设置为100%标准缩放
const setZoom100 = () => {
  setZoomFactor(1.0);
};

// 检查是否为100%缩放
const isZoom100 = () => {
  return Math.abs(zoomFactor.value - 1.0) < 0.001;
};

const handleZoomKeyDown = (event: KeyboardEvent) => {
  if (!(event.metaKey || event.ctrlKey) || event.altKey) {
    return;
  }

  switch (event.key) {
    case '=':
    case '+':
      event.preventDefault();
      increaseZoom();
      break;
    case '-':
    case '_':
      event.preventDefault();
      decreaseZoom();
      break;
    case '0':
      event.preventDefault();
      resetZoom();
      break;
    default:
      break;
  }
};

// 绑定 Cmd/Ctrl + = / - / 0 快捷键，仅需初始化一次
export function setupZoomShortcuts() {
  if (!window.ipcRenderer) return;

  if (!initialized) {
    initialized = true;
    void initZoomFactor();
  }

  if (shortcutsBound) return;
  shortcutsBound = true;

  document.addEventListener('keydown', handleZoomKeyDown);
}

export function useZoom() {
  return {
    zoomFactor,
    initZoomFactor,
    increaseZoom,
    decreaseZoom,
    resetZoom,
    setZoom100,
    setZoomFactor,
    isZoom100,
    MIN_ZOOM,
    MAX_ZOOM,
    ZOOM_STEP
  };
}
