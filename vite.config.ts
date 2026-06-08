import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  // 防止 Vite 遮蔽 Tauri Rust 核心的加载错误
  clearScreen: false,

  // Tauri 需要在开发模式下使用固定的端口
  server: {
    port: 1420,
    strictPort: true,
    host: true,
  },

  // 暴露以 VITE_ 和 TAURI_ENV_ 开头的环境变量
  envPrefix: ['VITE_', 'TAURI_ENV_'],

  build: {
    // Tauri 在 Windows 上使用 Chromium (WebView2)，在 macOS 上使用 WebKit
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    // 调试模式下不压缩代码，且生成 SourceMap，便于故障排查
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
