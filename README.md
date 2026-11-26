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

### 察元AI OS 全功能一览

察元AI OS 是家族的桌面旗舰——「如果整个操作系统围绕 AI 重建，会是什么样？」的答案。五大特质：**本地优先断网可用**（数据 0 出网）、**一切皆插件**（桌面本身也是可热插拔插件）、**智能体内核**（技能/MCP/权限分级/全局记忆）、**一套桌面多端呈现**（Electron / 浏览器 / 手机镜像 / Docker 云桌面 / DDS 跨端）、**架构级隐私**（全服务绑 127.0.0.1、远端功能默认关闭、政企私有化部署含麒麟/统信 UOS 信创）。

| 类别 | 你得到的能力 |
| --- | --- |
| 🖥️ **AI 桌面环境** | macOS 风格桌面、多用户锁屏、开机动画、菜单栏、Dock（自动隐藏+放大）、窗口管理、Finder（废纸篓+快捷方式）、小组件、通知中心、深浅色主题、高清在线+动态 WebGL 壁纸、主题包、无障碍（降动效/缩放）、中英双语 UI、自愈服务链（统一端口注册表+发现文件+自动重启） |
| 🤖 **智能体运行时** | 流式工具调用对话、多会话、智能体技能（SKILL.md）+技能商店、70+ 内置 MCP 工具、T0/T1/T2 权限分级（T0 免审/T1 每会话问一次/T2 每次必问、超时=拒绝 fail-closed）+审批卡+审计、运行时插件创建（`cordos_define`）、智能体商店、常驻定时任务 |
| 🧠 **本地模型服务** | 一键 GGUF 模型下载、llama.cpp 引擎池、OpenAI 兼容代理（端口 52581）、chat/responses/Anthropic 三协议互译、AI 图像与视频生成路由、语音识别（STT）与语音合成（TTS）、类型化决策模型、云↔本地自动回退、统一模型配置向导，兼容 Ollama / LM Studio / vLLM 或任意 OpenAI 兼容端点 |
| 📚 **RAG 知识库** | 导入 docx/xlsx/pdf/csv/html/扫描件（本地 OCR）；sqlite-vec 向量 + trigram 全文混合检索；本地 embedding 与 rerank 模型；交互式知识图谱；`kb_search/kb_list/kb_read_doc` 智能体工具；`/ask` SSE 端点答案带引用 |
| 🧬 **全局智能体记忆** | 全机单一记忆源（全局/每智能体/每项目三作用域），被动投影进每个 CLI 智能体的 AGENTS.md / CLAUDE.md；写入带出处（谁写了什么，设置页可见）；T1 审批门 |
| 🏢 **察元AI Office 插件** | 六编辑器 AI 办公套件作为桌面插件随 OS 发行（详见下节） |
| 📧 **AI 邮件** | 多账号 IMAP/SMTP（QQ/163/126/新浪/腾讯&阿里企业邮/Gmail/iCloud/Yahoo 授权码）、统一收件箱、IDLE 推送+低峰轮询、FTS5 全文搜索（中文分词）、AI 撰写/阅读/发送工具、发信标记 `X-Chayuan-AI-Sent`、提示注入加固渲染（DOMPurify 沙箱、远程图片点击前不加载） |
| 🎮 **察元竞技场（大模型对战）** | 五子棋 / 中国象棋 / 斗地主 / 四川血战麻将；人人、人机、**LLM 对 LLM 观赛**（逐手推理流可见）与循环挂机锦标赛；每步都是真实模型调用（非法步可见告警自动替换）；TrueSkill 天梯段位（青铜→王者）、对局记录与回放（时延/Token 用量/模型自注解）；人类挑战者战绩独立统计不污染模型分 |
| 🐾 **桌面灵宠与多智能体群聊** | 每个运行中的智能体都是一只灵宠（体型/行为反映记忆负载）、可装备技能包、流式对话气泡、灵宠工坊壁纸模式、宠物窝、多智能体群聊（一起讨论工作）、灵宠挂载常驻任务 |
| 👨‍💻 **编码智能体管理** | 安装/启动/切换供应商/监督 Claude Code、OpenAI Codex、OpenCode、OpenClaw；自动检测 13+ CLI 智能体家族（**XZCode**、Kimi Code、Cursor CLI、Copilot CLI、Droid、Amp、Grok Build、CodeBuddy、Crush…）；node-pty 终端；**每智能体模型注入**（统一模型代理喂饱每个智能体） |
| 🌐 **远程与跨端互联** | WebRTC 桌面镜像到手机浏览器（虚拟键盘+横竖屏）、限时云聊天链接（`/h/<roomId>`）、NAT 友好出站云中继（可自托管，`docker/relay`）、LAN 转发、DDS 对等发现与配对（分类共享、远端调用走对端权限门带审计）、DDS 跨设备聊天与文件传输（进度/取消/重试）、远程模型调用、Docker 多用户云桌面、Android 壳 + <500KB 手机查看器 |
| 🛍️ **插件与应用商店** | npm / npmmirror / 精选源 / 离线 `.cop.tgz` 四通道 dsh 插件、MCP 服务商店、技能市场（GitHub）、5,300+ Tabler 图标、应用内插件创建器、察元智能广场 |
| 📦 **内置应用** | Finder 文件管理、终端、文本编辑器、Markdown 查看器、Monaco 代码编辑器、图片查看器、PDF 阅读器、二进制查看器、浏览器、音乐/视频播放器、画图、SD 式图像生成应用、邮件、便签、笔记、四合一日历、提醒、联系人、帮助中心、博客/广场、废纸篓——全部可打开本地文件、全部可被智能体寻址 |
| 🔒 **安全与隐私** | 仅回环服务、权限分级+审批卡+完整审计、沙箱终端、scrypt 账户+签名 cookie（web 模式）、不可信内容（邮件正文/网页）提示注入纪律、离线优先架构、面向政企私有化部署（麒麟 Kylin / 统信 UOS 信创） |

### 察元AI Office（家族开源办公套件）

六编辑器 AI 办公套件：**Word 兼容文档（.docx）／电子表格（.xlsx）／演示文稿（.pptx）／真文 PDF／Markdown／HTML**。核心能力：**字节级保真往返**（打开-编辑-另存不掉格式）、AI 校对、一句话生成文档/表格/PPT、离线 PDF→Word 转换、OCR、**4,576 个领域助手**（覆盖法务/财务/研发/市场等域）。既作为插件住在察元AI OS 里，也可在 **Windows / macOS / Linux / 麒麟 / 统信 UOS** 独立安装（Apache-2.0，[`chayuan-office`](https://github.com/zhgyuhuii/chayuan-office)）。

### 察元AI文档助手（WPS 加载项）

面向 WPS 用户的 AI 办公加载项：**4,500+ 领域助手**（写作/改写/翻译/总结/代码解释等场景直达）、**AI 校对**（错别字/语法/一致性）、**保密检查**（敏感信息识别与脱敏建议，政企合规场景）、**内置本地 MCP 服务**——外部智能体（Claude Code、XZCode 等）可直接驱动 WPS 文档能力，与察元家族的其他成员同一套助手库。

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
