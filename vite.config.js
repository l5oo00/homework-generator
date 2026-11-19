import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// 构建产物是一个把 JS/CSS 全部内联进去的自包含 index.html。
// 既能部署到 GitHub Pages，也能下载下来本地双击打开。
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: {
    cssCodeSplit: false,
    assetsInlineLimit: 100000000,
    rollupOptions: { output: { inlineDynamicImports: true } }
  }
})
