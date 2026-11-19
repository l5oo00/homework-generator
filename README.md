# 小学生练习题生成器

父母自用的作业题生成小工具：选科目 → 选题型 → 出题 → 定稿 → 打印。纯前端，无后端。

线上地址：<https://l5oo00.github.io/homework-generator/>

## 使用

打开线上地址，勾选题型、配好参数，点「生成预览」→「定稿」，然后打印题目或查看答案。

- 打印只出题、不含答案；打印对话框里选「存储为 PDF」即可存成 PDF。
- 「查看答案」会生成二维码/链接，手机扫码看答案；答案编在链接里，不上传服务器。
- 定稿自动存浏览器本地（7 天）。顶栏「历史记录」可查看旧题、删除、导出 HTML 长期留档。
- 宽屏左右分栏（左配置右预览），窄屏上下排列。

## 新增/修改题型

配置驱动，改 `src/config/types/` 下的模块即可，UI 和出题引擎不用动。改完升 `src/config/meta.js` 的版本号。

## 开发

```bash
npm install
npm run dev      # 本地开发
npm run build    # 手动构建 dist/index.html（单文件）
```

本地只跑 dev；push 到 `main` 后 GitHub Actions 自动构建并部署到 GitHub Pages。
