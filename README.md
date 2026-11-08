# 设计资产工作台

以 **基础规范 → 组件资产 → 交互模式 → 页面模板 → 项目工作区** 组织通用设计资产，支持配置、复用、版本审阅与设计交付。

[打开在线工作台](https://thechosenonekk07.github.io/gkx-design-asset-workbench/)

## 当前能力

- 基础规范：151 个初始变量、13 个分类，支持创建、编辑、别名引用、深浅色值与 JSON / CSS 导出。
- 组件资产：62 类通用组件与 160 个用法示例，包含配置、规范、状态和引用关系。基于 React Aria、原语组合和语义 HTML，不代表官方独立组件数量。
- 交互模式：6 个可复用任务模式，支持组件组合与步骤维护。
- 页面模板：12 个预置模板，其中 6 个支持字段、动作、样本和结构配置。
- 项目工作区：采用模板、锁定规范版本、独立配置页面与主题、审阅升级差异、记录人工验收、保存交付版本、从历史交付创建新项目。

## 数据保存

这是可操作的静态工作台。用户编辑的数据保存在当前浏览器中，**没有云端账号、多人同步或业务后端**。请通过右上角“资产库 → 导出完整资产库”备份；换浏览器或换地址后可通过“载入资产库 JSON”迁移。

在线版首次打开使用通用初始资产，项目工作区初始为空。原本机预览中的项目不会自动上传。在线版使用独立存储名称，不与本地预览混用。已导入或创建的项目不属于 GitHub 仓库内容。

人工验收用于记录标准、证据和复验状态，不代表自动 Figma 对比或像素级验收。交付包是设计资产与配置，不是自动生成的业务应用源码。预览中的数据操作仅作用于本地样本。

## 开发与验证

使用 Node.js 24：

```sh
cd app
npm ci
npm test
npm run dev
```

发布构建：

```sh
cd app
npm run build:github
```

输出位于 `published/`。相对资源路径与 hash 导航支持 GitHub Pages 仓库子路径。

## 发布流程

向 `main` 推送后，GitHub Actions 执行干净安装、测试和公开构建，再部署 `published/` 到 GitHub Pages。也可在 Actions 手动运行 Deploy Pages。首次部署需在 Settings → Pages 中选择 GitHub Actions。

本仓库仅包含通用系统源码、测试与发布配置，不包含旧版业务资产、分析迁移原文、本机路径、浏览器数据或运行日志。公开构建隐藏仅本地可用的旧业务资产入口。

## 参考与依赖

行为基础来自 [React Aria](https://react-aria.adobe.com/)，组件规范与分类参考 [TDesign](https://tdesign.tencent.com/vue-next/components/button) 和 [Arco Design](https://arco.design/docs/spec/link)。相关链接为参考依据，不表示导入了这些体系的全部能力。

依赖许可证随各 npm 包提供。发布记录见 `RELEASE.md`。
