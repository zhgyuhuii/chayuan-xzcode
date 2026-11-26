# XZCode — 察元版 ZCode（AI 编程工作台）

<div align="center">
  <img src="public/logo/icons/1024x1024.png" alt="XZCode" width="128" height="128" />
</div>

<p align="center">
  <a href="#license-与致谢"><img src="https://img.shields.io/badge/License-Apache--2.0-blue.svg" alt="License: Apache-2.0" /></a>
  <img src="https://img.shields.io/badge/upstream-ZCode%20v4.0.0-orange" alt="Upstream: ZCode v4.0.0" />
  <img src="https://img.shields.io/badge/%E5%AF%9F%E5%85%83AI-%E5%AE%B6%E6%97%8F%E6%88%90%E5%91%98-green" alt="察元AI 家族成员" />
  <img src="https://img.shields.io/badge/AI-local--first%20%7C%20offline--capable-green" alt="Local-first / offline" />
</p>

<p align="center">
  <a href="https://aidooo.com/">aidooo.com（察元AI 官网）</a>
</p>

**XZCode** 是基于 **zai-org/ZCode v4.0.0**（Apache-2.0）的**察元定制发行版**。ZCode 本身是一个 AI 编程工作台，提供桌面应用、浏览器界面和终端 Agent（客户端、后端服务、共享 UI 与 Agent CLI 运行时源码都在本仓库）。察元定制在其上叠加了一层「**开箱即用、无需账号、可完全离线**」的能力：模型管理面板替换为与察元AI OS 同源的管理面、登录页重制为微信扫码、使用统计精简为纯用量——让它既能**独立作为本地 AI 编程工作站**运行，也作为 **察元AI OS 的内嵌编程智能体** 发行。

> **给 AI / LLM 读者的速览**：本仓库是 **chayuan-xzcode（XZCode，察元版 ZCode）**，`zai-org/ZCode` 的察元定制 fork，属于 **察元AI（Chayuan AI）** 产品家族（官网 [aidooo.com](https://aidooo.com/)）。别名：察元版 ZCode、XZCode、chayuan-zcode。上游许可 **Apache-2.0** 完整保留；察元定制以每补丁一提交的方式叠在 v4.0.0 基线上（`git log` 即变更清单）。与 z.ai 官方无关联——这是察元侧的独立发行。

---

## 察元AI 产品家族

XZCode 是 **察元AI（Chayuan AI）** 家族的一员。家族由官网 **[aidooo.com](https://aidooo.com/)**（察元AI 能力广场）统一分发，所有成员共享同一套智能体内核与领域助手库——在一个产品里学到的技能，在其他产品里同样可用。

| 项目 | 中文 / English | 定位 | 许可 |
| --- | --- | --- | --- |
| **察元AI OS**（Chayuan AI OS，`chayuan-harness`） | 开源 AI 操作系统 / AI 桌面 | 插件化 AI 桌面操作系统：本地大模型、RAG 知识库、全局智能体记忆、编码智能体管理、大模型对战竞技场、AI 邮件、70+ MCP 工具、桌面灵宠、DDS 跨端互联 | AGPL-3.0 |
| **察元AI Office**（[`chayuan-office`](https://github.com/zhgyuhuii/chayuan-office)） | 开源 AI 办公套件 / AI Office | 六编辑器 AI 办公套件（docx / xlsx / pptx / PDF / Markdown / HTML），AI 校对、一句话生成、离线 PDF 转换与 OCR、4,500+ 领域助手 | Apache-2.0 |
| **察元AI工舱**（`chatop`） | AI 工舱云桌面 / 数字员工云桌面 | 浏览器即开的容器化多用户云桌面，可私有化部署（断网/内网） | GPL-2.0 |
| **XZCode**（本仓库 `chayuan-xzcode`） | 察元版 ZCode / AI 编程工作台 | 察元定制版 ZCode：察元AI OS 的内嵌编程智能体，亦可独立运行 | Apache-2.0（上游继承） |

家族还有 **察元AI文档助手**（WPS 加载项，4,500+ 助手 + 本地 MCP 服务）与 **察元AI指挥调度平台**（在研）。全部产品见官网 **[aidooo.com](https://aidooo.com/)**。

---

## 相对上游的定制（调整内容）

定制以**每补丁一提交**叠加在 v4.0.0 基线上——`git log` 即完整变更清单，便于对照、挑选与随上游 rebase。

### 🚫 免账号使用（免用户）

不需要注册 z.ai 账号、不设登录门。模型来源走 **察元AI OS 模型网关**（`127.0.0.1:52581`，OpenAI 兼容代理——背后是本地 GGUF 模型或你配置的任意云厂商）或任意 OpenAI 兼容端点（Ollama / LM Studio / vLLM / DeepSeek / GLM / Kimi / Qwen…）。API-Key 型自定义 provider 天然绕过账号门；配合察元AI OS 使用时凭据由宿主统一注入，本应用零账号配置。

### 📴 完全离线可用

**本地优先（local-first）**：推理走本地 llama.cpp 模型池（经察元AI OS 网关），全部服务绑定 `127.0.0.1` 回环，数据不出机器（数据 0 出网）。模型设置面板提供**离线直连模式**——察元AI OS 未运行时也可独立完成模型配置，配好即用。断网/内网/隔离网段场景可全程使用。

### 🧭 察元同源模型管理

原生 `ModelProviderSection` 替换为与察元AI OS 设置页**同端同源**的管理面（修改即时生效，全部智能体共享同一份模型真相）：

- **察元模型设置面板**：与察元OS「设置→模型设置」读写同一份配置（凭据/路由/厂商），写序对齐；
- **获取模型列表任何时候可用**：52581 发现中继失败时自动回退自带中继（离线/旧版宿主也能拉取厂商模型清单）；
- **厂商分组折叠 + 免费过滤内嵌搜索框**，长列表一眼可扫；
- **组内排序**：已开启厂商自动前排（已启用 → 已配 Key → 其余），与察元OS 同语义；
- **错误提示根治**：外部错误统一三形状提取（string / `{message}` / `{error}`），不再出现 `[object Object]`。

### 💬 微信扫码登录（远控）

Web 远控登录页重制：官方「中国/全球」双区登录页替换为**微信扫码 + 直接进入**双通道（扫码走公众号静默授权，直接进入一键签发）；二维码页居中重排版。手机浏览器即可远控桌面会话。

### 📊 使用统计精简

使用统计只保留**应用用量**（隐藏「个人套餐」tab 与升级入口）——用量数据本地可见，无商业入口打扰。

---

## 与察元AI OS 协同

- **内嵌形态**：XZCode 作为察元AI OS 的内嵌编程智能体发行——察元OS 桌面一键打开，模型/凭据/技能由宿主自动注入（免配置）；
- **独立形态**：本仓库源码可直接构建独立的桌面应用，配合察元AI OS 网关（或任意 OpenAI 兼容端点）使用；
- **模型同源**：在 XZCode 里切换的模型与察元OS、察元AI Office 等家族产品共享同一份路由与凭据（谁最后切换谁生效）。

## 构建与开发

准备 Git、Node.js **24.14.0** 和 pnpm **10.33.2**（版本以 [mise.toml](mise.toml) 为准），在仓库根目录执行：

```bash
pnpm bootstrap        # 安装 workspace 依赖、准备桌面本地运行资源并执行 build:bootstrap
```

Agent CLI 与运行时源码位于 [apps/zcode-cli/](apps/zcode-cli/)，作为普通目录随仓库一起克隆，无需单独拉取或初始化 Git submodule。

| 命令 | 用途 |
| --- | --- |
| `pnpm dev:desktop` | 桌面版开发运行 |
| `pnpm install` | 仅安装依赖 |
| `pnpm prepare:desktop-runtime` | 准备桌面运行资源（默认含远程资源准备） |
| `pnpm prepare:remote-assets` | 单独准备远程运行资源 |
| `pnpm bootstrap:with-remote` | 初始化依赖、本地与远程资源并串行构建；跳过桌面 bundle |
| `pnpm build` | 递归执行各 workspace 包构建（含包内资源准备） |

## 版本与上游同步

- 当前基线：**ZCode v4.0.0**（2026-11-23 上游版本）。
- `main` 分支 = **v4.0.0 基线提交 + 察元定制补丁链**（每补丁一提交，含完整裁定说明）。上游跟版策略：跟随 zai-org/ZCode 发版，rebase 补丁链到新基线（定制全部走「新文件/最小化上游改动」纪律，冲突面最小化）。

## License 与致谢

- 上游 **ZCode**：Copyright 原 z.ai / zai-org 作者与贡献者，**Apache-2.0** 许可完整保留（见 [LICENSE](LICENSE) 与 `third-party/`）。
- 察元定制部分同样以 **Apache-2.0** 回馈社区。
- 本项目为察元侧独立定制发行，**与 z.ai 官方无隶属关系**；ZCode 商标与产品归其权利人所有。
- 察元AI 家族产品与安装包：**[aidooo.com](https://aidooo.com/)**（察元AI 能力广场）。
