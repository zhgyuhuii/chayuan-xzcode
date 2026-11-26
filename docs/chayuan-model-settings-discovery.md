# Chayuan Model Settings Vendor Discovery

## Scope

察元模型设置面板（`packages/ui/src/settings/chatop/ChatopProviderPanel.tsx`）的「获取模型列表」按钮，向厂商 OpenAI 兼容 `/models` 端点发起发现。发现通道有两条，按序尝试：

1. **察元OS gateway**（`127.0.0.1:52581 /api/model-config/discover`）——在线同源语义，且能解析 harness `keyRef` 凭据（面板未填 Key 时）。察元OS 未运行即不可达。
2. **ZCode host RPC 兜底**（`IProviderSettingsService.discoverVendorModels`）——host 进程内 Node fetch，无 CORS 限制。察元OS / ZCodeHarvest 均不在场（ZCode 独立运行）时同样可用。

2026-11-26 用户裁定：renderer 不再直连 `127.0.0.1:52596` 发现中继（原 ZCodeHarvest wrapper / 察元OS 主进程拉起的兜底）。harness 仓的中继实现保留，服务旧版 ZCode 构建。

## State Boundary

- 发现是无状态只读操作：不落盘、不进 provider_config、不触发 Registry 事件、不产生 onDidChange。
- 发现结果只进入面板本地表单草稿（`ChatopProviderPanel` 的 `models` state），随「保存并启用」经既有写入路径落盘（在线 `/api/model-config/vendor`；离线 `providerSettingsService` overlay）。
- host 端实现无注入依赖（不同于 `testModelConnectivity` 需要 Environment Registry），任何装配了 `IProviderSettingsService` 的环境（桌面本地 Host / web / 远程）自动具备。

## Interface

```ts
// packages/services IProviderSettingsService
discoverVendorModels(input: { apiUrl: string; apiKey?: string }): Promise<{ models: string[] }>;
```

- `apiUrl` 末段非 `v\d+` 时补 `/v1`（与 harness gateway / 中继 `normBase` 逐字一致）。
- `GET {base}/models` + `authorization: Bearer <apiKey>`（Key 空则不带头），8s 超时。
- 错误文案与 52581/52596 现行为一致：非 2xx `厂商返回 {status}：{text 前 200 字}`；非 JSON `厂商返回非 JSON`；网络失败 `不可达：{message 前 160 字}`。

## Renderer 顺序语义

`discoverChatopModels(input, hostDiscover?)`：

- 52581 成功即返回。
- 52581 失败 → `hostDiscover` 在场则调用；其错误**原样抛出**（要么真到了厂商拿到业务错误，要么如实报网络不可达，不叠加误导性提示）。
- 无 `hostDiscover`（面板基座服务缺席的边缘态）→ 抛简明提示，不再声称「重启 ZCodeHarvest 或察元OS 后自动可用」。

## Acceptance Scenarios

1. **独立运行**：察元OS / ZCodeHarvest 均未运行，独立启动 ZCode → 选厂商填 API 地址与 Key → 获取模型列表 → host 兜底路径直接返回清单。
2. **在线同源**：察元OS 运行中 → 行为与修复前逐字节一致（52581 第一优先，含 keyRef 凭据解析）。
3. **厂商业务错误**：Key 错误 / 地址不可达 → 面板展示 host 路径如实返回的厂商错误（如 `厂商返回 401：…`）。
4. **验证路径**：App 单测在 services 层已退役（docs/testing/unit-test-quality.md），不新增 services 单测；host 端语义以可重复运行时场景验证（本地 mock 厂商 /models 服务器 + 直接调用 `discoverVendorModelsViaFetch`），配合 `pnpm typecheck` / `pnpm lint`。面板完整链路（renderer→RPC→host）以场景 1 的独立运行复测为准。
