# 帅帅练琴屋

一个免费、开源的电吉他练习辅助工具。选一课、看清练习要求、打开老师的原课，再把练习记录留在自己的设备上。

**[打开练琴屋](https://intsheep.github.io/EGuitarOmitrix/) · [下载客户端](https://github.com/intSheep/EGuitarOmitrix/releases/latest) · [反馈问题](https://github.com/intSheep/EGuitarOmitrix/issues)**

## 致谢老师

感谢 **「帅帅是把电吉他」老师**带来的 **「零基础入门电吉他 · 7周自学计划」**课程。本项目的课程结构、教学素材和整理后的课程参考资料均来源于这套课程。欢迎前往原视频学习，也请支持老师的原创教学：

**[在 B 站观看原课程 — BV1FT411Z7iu](https://www.bilibili.com/video/BV1FT411Z7iu/)**

本项目是独立开发的练习辅助工具，**不是老师的官方产品，也不代表老师的认可或背书**。整理后的乐谱和时间对齐可能存在理解或转换误差，请以原课教学为准。课程素材的原创归属不属于本项目，详见[素材来源与许可说明](COURSE_ATTRIBUTION.md)。

## 开始练习

1. 打开网页版，或安装 Windows 客户端。Mac 用户可以直接使用网页版；原生 macOS 安装包目前仍处于实验阶段，尚待正式签名和验收。
2. 选择课程，点击 **开始练习**，按需使用节拍器、乐谱和调音器。
3. 结束后保存练习。稳定 BPM 和熟练度由你自行判断，也可以不填写。
4. 更换浏览器、设备或升级客户端前，通过 **练习回顾 → 备份与管理** 导出备份。

目前提供课程导航、练习要求、前台练习计时、单独确认的看课时长、节拍器、本地麦克风调音、课程乐谱和练习回顾。播放视频或完成计时，不会自动判定你已经掌握某项技巧。

## 选择使用方式

| 版本 | 使用与更新方式 | 当前限制 |
| --- | --- | --- |
| 网页版 | 由 GitHub Pages 托管；练习结束后刷新页面使用新部署的版本 | 加载网站和未缓存资源需要联网，尚未提供完整离线或 PWA 支持。 |
| Windows x64 | 从发布页下载安装器；通过 **帮助 → 检查更新**，确认后下载、安装 | 当前为未签名的试用版，Windows 可能提示安全警告。早于 0.4.0 的版本需要先手动升级一次。 |
| Android | 从发布页下载 APK；更新时下载新版并确认安装 | 发布版使用固定签名。旧调试版可能需要先备份、卸载，再安装并导入记录。不支持静默更新，尚未上架应用商店。 |
| macOS | 优先使用网页版；另有 ARM64 / Intel 原生包的实验性构建流程 | 原生客户端尚待正式签名、公证和 Mac 真机验收。 |

练习记录保存在当前浏览器或客户端的本地数据中。**没有账号、云同步、录音上传或自动跨设备迁移。** 浏览器数据可能被清理，请定期导出备份。Windows 继续使用原有的 `%APPDATA%/EGuitarOmitrix` 数据目录；中文显示名称的变更不会修改应用标识或仓库地址。

网页版按需加载乐谱和图片，不会在打开页面时下载整个课程资源包。原视频在 B 站打开。包含课程资源的客户端内置经过哈希校验的固定版本资源包，可在本地使用乐谱；课程资源与程序源码分别管理版本。

## 本地开发

使用 Node.js 24（见 `.nvmrc`），按仓库中的依赖锁文件安装：

```sh
npm ci
npm run dev
npm test
npm run build
npm run test:web
```

`npm run dev` 会输出本地访问地址，通常为 `http://localhost:5173`。默认构建不包含课程资源。如需打包公开的课程资源：

```sh
node scripts/download-course-resources.mjs
EGUITAR_COURSE_PACK=private/course-resources-2026.10.20.1.zip npm run build
node scripts/verify-distribution.mjs dist
```

`private/` 是沿用至今、被 Git 忽略的暂存目录名称，已发布的课程资源包是公开的。凭证、签名私钥、个人练习记录及未被明确引用的本机文件不会进入分发包。

客户端构建命令和平台环境要求见[构建与发布指南](docs/engineering/releases.md)。CI 会先验证程序与分发内容，再生成安装包。按版本标签发布时先创建草稿；公开稳定版本后，Windows 客户端才能读取对应的更新清单。不要用不同内容覆盖已经发布的同版本附件。

## 参与贡献与许可

本项目自行编写的代码采用 [MIT 许可证](LICENSE)。该许可证**不会重新授权课程素材或第三方依赖**，具体归属见[素材来源与许可说明](COURSE_ATTRIBUTION.md)。反馈问题时，请提供应用版本、设备、复现步骤、预期行为和实际结果；不要上传个人备份或凭证。

README 使用中文，其他项目文档目前主要使用英文；学习界面使用简体中文，并保留原课程标识。修改时请保留白底蓝色的练习工作台风格、课程版本、尚未明确的教学要求和本地练习历史。小范围改进可以直接提交聚焦的 PR，不必为每次修复另建 Issue。

- [产品需求](docs/product/PRD.md)
- [设计参考与取舍](docs/design/references-and-rationale.md)
- [公开分发与验证记录](docs/engineering/public-distribution.md)
- [构建与发布流程](docs/engineering/releases.md)
- [课程资源处理与分发](docs/engineering/course-resources.md)
- [文档目录](docs/README.md)
- [Agent 协作说明](AGENTS.md)
