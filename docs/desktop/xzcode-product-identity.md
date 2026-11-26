# XZCode 发行版产品身份

## Feature Summary

| Field                 | Value                                                                                                                                                     |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Change                | 桌面安装包的产品身份从上游 `ZCode` 改为发行版 `XZCode`，与用户机器上已安装的官方 ZCode 完全共存（安装、运行、数据、deep link 四个层面都不冲突） |
| User-visible surfaces | 安装包文件名、应用名、macOS bundle id、Windows AUMID、Linux 包名/可执行名/desktop entry、deep link scheme、userData 目录、DMG 安装背景、安装日志名        |
| Existing docs         | `docs/desktop/zcode-preview-packaging.md`（Preview 身份边界，本 spec 修正其 deep link 决策）、`docs/desktop/dev-deep-link.md`                             |
| Existing code owners  | `packages/desktop/scripts/desktop-product-identity.mjs`、`packages/desktop/src/main/desktopRuntimeEnv.ts`、`packages/desktop/src/main/desktopOAuthDeepLink.ts`、`packages/desktop/src/main/desktopLinuxDeepLinkRegistration.ts`、`packages/desktop/electron-builder.config.js` |
| Out of scope          | 代码内部标识符（`ZCODE_*` 环境变量、socket 名、进程 label）、图标体系、业务数据目录 `~/.zcode`（与上游共享是有意行为）                                      |

## Clarification Log

| Round | Question | User answer | Boundary fixed | Follow-up needed |
| --- | --- | --- | --- | --- |
| 1 | 包名与应用名 | 统一 `XZCode` | production/preview 两个 flavor 的 productName 均带 XZCode 前缀 | no |
| 1 | deep link scheme | 改为 `xzcode://` | 与官方 ZCode 的 `zcode://` 互不抢占默认 handler | OAuth 提供商控制台需新增 `xzcode://oauth/callback` 白名单（运营侧） |
| 1 | appId/AUMID | `dev.xzcode.app` | macOS LaunchServices 与 Windows Shell 的系统级唯一标识 | no |

## Boundary Decisions

| Boundary | Decision | Includes | Excludes / prunes | Source |
| --- | --- | --- | --- | --- |
| 构建期身份 | `desktop-product-identity.mjs` 是唯一所有者 | appId `dev.xzcode.app`（preview 为 `dev.xzcode.app.preview`）、productName `XZCode`（preview 为 `XZCode Preview`）、linuxExecutableName/linuxPackageName `xzcode`（preview 为 `xzcode-preview`） | 新增第三 flavor；开发态 AUMID `cn.aminer.zcode` 保持不变（非打包产物） | single-owner invariant |
| 运行时身份 | `desktopRuntimeEnv.ts` 的 `runtimeApplicationName` 与构建期 productName 同步 | userData/session 目录（`appData/XZCode`）、Electron 单实例锁、`app.setName` | 官方 ZCode 的 userData（隔离是有意行为） | simultaneous-run invariant |
| Deep link | scheme 改为 `xzcode://` | macOS/Windows 协议注册、Linux `xzcode.desktop` + `x-scheme-handler/xzcode`、web 分享链接生成、OAuth redirect URI | 旧 `zcode://` 链接的接收方（归官方 ZCode）；Linux 归属标记 `Comment=ZCode Desktop App` 改为 `Comment=XZCode Desktop App`（文件名已不同，marker 仅语义同步） | user decision 2026-11-26 |
| 更新通道 | 打包态使用 GitHub Releases（`zhgyuhuii/chayuan-xzcode`） | electron-builder `publish.provider=github`；打包态运行时 feed 用 electron-updater 原生 GitHub provider；preview 通道映射 release 的 Pre-release 标记（`allowPrerelease`） | 服务端 manifest API（`/api/v1/releases/electron/manifest`，官方灰度/设备维度能力不再使用）；开发态 e2e 仍走本地 manifest provider | user decision 2026-11-26 |
| 发布版本号 | preview 版本建议使用 semver prerelease 号（如 `4.1.0-rc.1`） | electron-updater 以 semver 比较版本；stable 与 preview 同号会导致已装 preview 用户无更新可发现 | 改动 electron-builder 的 version 注入 | semver invariant |
| 数据迁移 | 不迁移官方 ZCode 的 userData | `mcpUserDirectory/legacy.ts` 读 `appData/ZCode` 的 legacy 逻辑原样保留（只读迁移源） | 双写、启动时全量拷贝 | isolation invariant |
| CUA Helper | 本次不改 helper 身份常量 | 打包态 helper 在各 app 包内 Resources（天然隔离）；开源树为占位包无 helper runtime | 闭源 producer 的 launcher app-id allowlist（接入 `dev.xzcode.app` 属闭源仓库工作项） | placeholder boundary |

## 残余冲突清单（代码外，需运营/发布侧配合）

| 冲突点 | 影响 | 处理 |
| --- | --- | --- |
| OAuth 提供商白名单 | 智谱/Zai 控制台只登记了 `zcode://oauth/callback`，XZCode OAuth 登录回调会被拒绝 | 在各提供商控制台新增 `xzcode://oauth/callback` |
| 已分发 deep link | 历史 `zcode://share/import` 分享链接仍由官方 ZCode 响应 | 新分享链接由 web 端生成 `xzcode://`；旧链接自然过期 |
| 更新通道 | ~~官方 manifest 源不可用~~ 已切换到 GitHub Releases（见 Boundary Decisions「更新通道」）；发布时需将安装包、blockmap 与 `latest*.yml` 上传到 GitHub Release，preview 版本勾选 Pre-release 标记 | 发布流程配合 |
| macOS TCC 授权 | 屏幕录制、辅助功能、麦克风等授权按 bundle id 记账，`dev.xzcode.app` 首次使用需重新授权 | 预期内，无动作 |
| Windows 已装官方版 | NSIS 卸载键、AUMID、安装目录均按新 appId/productName 独立 | 预期内，无动作 |

## Acceptance Scenarios

1. `pnpm bundle:desktop -- --os mac --arch arm64` 产出 `XZCode-<version>-mac-arm64.dmg`，挂载后应用名为 `XZCode.app`，`Info.plist` 的 `CFBundleIdentifier` 为 `dev.xzcode.app`。
2. 与官方 ZCode 同时安装并运行：两者各自持有单实例锁（userData 目录不同），互不激活对方窗口。
3. Linux deb 安装后包名为 `xzcode`，可执行文件 `/usr/bin/xzcode`，desktop entry 为 `xzcode.desktop`，与官方 `zcode` 包并排安装互不替换。
4. 浏览器点击 `xzcode://` 链接仅唤起 XZCode；`zcode://` 链接仅唤起官方 ZCode（若安装）。
5. Windows 安装后开始菜单条目、任务栏 AUMID、卸载注册表项均归属 `dev.xzcode.app`，与官方 ZCode 的卸载项互不覆盖。
