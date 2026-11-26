# settings-chatop

察元模型设置面板：设置页「模型设置」右侧面板，与察元OS 设置→模型设置同源。行为规格真源在 chayuan-harness 仓 `docs/zcode-model-settings-plan.md`（裁定总表 Q1–Q17），本目录是其 ZCode 侧实现。

不变量：

- 挂载点唯一（Q1）：SettingsPage 的 modelProvider 分支经 index.ts 公共入口挂载；面板无 props、数据自取，调用方不注入状态，不持有面板的任何业务状态副本。
- 数据双模式（Q2/Q16）：在线（52581 `/api/model-config/*`）读写 harness 真源；离线经 ZCode 自身 providerSettingsService 写直连 personal provider，察元OS 上线后由同步器 adopt 自动合流——两条写路径都以「勾选模型清单全量 upsert」落库，面板内不缓存第二份。
- 即时生效无草稿（Q3）；默认模型双向谁最后切换谁赢（Q9/Q14）；Key 明文回显（Q15）。
- 模型清单按 7 类前端 id 推断分组（Q17）：分组由 modelCategories.ts 在渲染层从 models state 派生（唯一所有者是面板的 models useState），折叠态与左栏厂商组折叠是两个独立语义、状态不共用；全局全选/全不选 sticky 固定在滚动容器顶部。
- 厂商目录来自构建时快照 vendor-catalog.generated.json（Q8），运行时不拉目录。

与其它模块的交集：

- 唯一外部消费点是 SettingsPage（未受管 ui 根，存量豁免）：只 import index.ts 的 ChatopProviderPanel。
- 离线模式消费 baseServices 的 providerSettingsService（结构面见 zcodeOffline.ts），发现兜底可走 host RPC `discoverVendorModels`（通道顺序见 docs/chayuan-model-settings-discovery.md）。
