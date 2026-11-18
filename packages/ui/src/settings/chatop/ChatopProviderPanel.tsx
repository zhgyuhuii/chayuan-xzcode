/**
 * 察元模型设置面板（chayuan-harness docs/zcode-model-settings-plan.md）。
 *
 * 替换 ZCode 设置页「模型设置」右侧面板（挂载点见 SettingsPage.tsx 的
 * modelProvider 分支——原 ModelProviderSection 停止渲染、代码保留）。与
 * 察元OS「设置→模型设置」同源（Q2）：厂商目录来自构建时快照
 * vendor-catalog.generated.json（85 家，scripts/zcode-gen-catalog.mjs 生成），
 * 启用状态/Key/模型清单/默认模型运行时读写 52581 /api/model-config/*——
 * 即时生效无草稿（Q3）、保存即写 harness 真源（凭据/llm-pi-ai/代理路由），
 * 常驻同步器自动物化 provider_config（ZCode 1s 轮询热加载，切换器即时可见）。
 *
 * 布局仿原生 ModelProviderSection 的 SectionLayout（左列表右表单 grid）；
 * 组件观感全用 ZCode 原生 ui 件。文案中文（察元体系单语）。
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button.js";
import { Input } from "@/components/ui/input.js";
import { Switch } from "@/components/ui/switch.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.js";
import catalogDoc from "./vendor-catalog.generated.json";
import {
  discoverChatopModels,
  fetchChatopCredential,
  saveChatopDefaultModel,
  saveChatopVendor,
  type ChatopVendorState,
} from "./api.js";
import { useChatopModelConfig } from "./useChatopModelConfig.js";

interface CatalogVendor {
  id: string;
  name: string;
  group: string;
  defaultUrl: string;
  api: string;
  keyUrl: string;
  ollamaLike: boolean;
  free?: string;
}

const CATALOG = catalogDoc.vendors as CatalogVendor[];
const GROUPS = catalogDoc.groups as { id: string; label: string }[];

const STRINGS = {
  title: "模型设置",
  subtitle: "与察元OS 模型设置同源 · 修改即时生效，全部智能体共享",
  offline: "察元OS 模型服务不可达（52581 未运行）——以下为只读目录，启动察元OS 后可配置",
  searchPlaceholder: "搜索厂商…",
  addVendor: "添加供应商",
  addName: "供应商名称",
  addUrl: "API 地址（如 https://api.example.com/v1）",
  addCreate: "创建",
  apiUrl: "API 地址",
  apiKey: "API Key",
  apiKeyConfigured: "已配置密钥",
  apiKeyNotConfigured: "未配置密钥",
  getKey: "获取密钥",
  showKey: "显示",
  hideKey: "隐藏",
  protocol: "协议",
  modelsLabel: "模型清单",
  fetchModels: "获取模型列表",
  saveEnable: "保存并启用",
  disable: "停用",
  setDefault: "默认",
  defaultModel: "默认模型",
  enabled: "已启用",
  disabled: "未启用",
  inProxy: "已在代理",
  customGroup: "自定义供应商",
  emptyPick: "选择左侧厂商查看配置",
  errPickModel: "请至少勾选一个模型",
  errApiKey: "请填写 API Key（或在察元OS 侧已配置）",
  okEnabled: "已启用（切换器约 1 秒内可见新厂商分组）",
  okDisabled: "已停用",
  okModels: (n: number) => `获取到 ${n} 个模型`,
  okDefault: "已设为默认模型（全家共享，谁最后切换谁赢）",
  busyFetch: "获取中…",
  busySave: "保存中…",
};

const slugify = (name: string) =>
  name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "custom";

const FREE_LABELS: Record<string, string> = { nokey: "免Key", freekey: "免费Key", tier: "免费额度" };

export function ChatopProviderPanel() {
  const { state, online, loading, error, refresh } = useChatopModelConfig();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // 本地自定义草稿（添加供应商：仅面板态，保存并启用后落服务端——Q3 无草稿
  // 语义：不启用即不持久化）
  const [drafts, setDrafts] = useState<CatalogVendor[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addUrl, setAddUrl] = useState("");

  // 表单态（随选中厂商重建）
  const [apiUrl, setApiUrl] = useState("");
  const [api, setApi] = useState("openai-completions");
  const [keyInput, setKeyInput] = useState("");
  const [keyEchoed, setKeyEchoed] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [models, setModels] = useState<{ id: string; enabled: boolean }[]>([]);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const flash = (kind: "ok" | "err", text: string) => {
    setMsg({ kind, text });
    setTimeout(() => setMsg(null), 4000);
  };

  const vendorStateById = useMemo(() => {
    const map = new Map<string, ChatopVendorState>();
    for (const v of state?.vendors ?? []) map.set(v.id, v);
    return map;
  }, [state]);

  // 列表合成：内置目录四组 + 服务端自定义 + 本地草稿
  const listVendors = useMemo(() => {
    const q = search.trim().toLowerCase();
    const inCatalog = new Set(CATALOG.map((v) => v.id));
    const serverCustom = (state?.vendors ?? []).filter((v) => v.custom && !inCatalog.has(v.id));
    const all = [
      ...CATALOG,
      ...serverCustom.map((v) => ({ id: v.id, name: v.id, group: "__custom", defaultUrl: v.apiUrl, api: v.api, keyUrl: "", ollamaLike: false })),
      ...drafts,
    ];
    return q ? all.filter((v) => v.id.includes(q) || v.name.toLowerCase().includes(q)) : all;
  }, [search, state, drafts]);

  const selected = selectedId !== null ? listVendors.find((v) => v.id === selectedId) ?? null : null;
  const selectedState = selectedId !== null ? vendorStateById.get(selectedId) ?? null : null;

  // 选中厂商 → 表单重建（服务端值优先，缺省目录默认）
  useEffect(() => {
    if (!selected) return;
    setApiUrl(selectedState?.apiUrl || selected.defaultUrl);
    setApi(selectedState?.api || selected.api || "openai-completions");
    setKeyInput("");
    setKeyEchoed(null);
    setShowKey(false);
    setModels((selectedState?.models ?? []).map((m) => ({ id: m.id, enabled: m.enabled })));
    setMsg(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 选中厂商/服务端状态变化时重建
  }, [selectedId, selectedState]);

  const loadKeyEcho = useCallback(async (ref: string) => {
    try {
      const value = await fetchChatopCredential(ref);
      if (value !== null) {
        setKeyInput(value);
        setKeyEchoed(value);
      }
    } catch { /* 离线/无值：留空 */ }
  }, []);

  useEffect(() => {
    if (selectedState?.keyConfigured && selectedState?.keyRef && showKey && keyEchoed === null) {
      void loadKeyEcho(selectedState.keyRef);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 明文切换且未取回时拉一次
  }, [showKey, selectedState?.keyConfigured, selectedState?.keyRef]);

  const doFetchModels = async () => {
    if (!selected) return;
    setBusy("fetch");
    try {
      const found = await discoverChatopModels({
        apiUrl: apiUrl.trim() || selected.defaultUrl,
        apiKey: keyInput.trim() || undefined,
      });
      setModels(found.map((id) => ({ id, enabled: true })));
      flash("ok", STRINGS.okModels(found.length));
    } catch (e) {
      flash("err", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  };

  const doSave = async (enabled: boolean) => {
    if (!selected) return;
    const enabledIds = models.filter((m) => m.enabled).map((m) => m.id);
    if (enabled && enabledIds.length === 0) { flash("err", STRINGS.errPickModel); return; }
    if (enabled && !keyInput.trim() && !selectedState?.keyConfigured && !selected.ollamaLike) {
      flash("err", STRINGS.errApiKey);
      return;
    }
    setBusy("save");
    try {
      await saveChatopVendor({
        id: selected.id,
        enabled,
        apiUrl: apiUrl.trim() || selected.defaultUrl,
        api,
        ...(keyInput.trim() && keyInput !== keyEchoed ? { apiKey: keyInput.trim() } : {}),
        models: enabledIds,
        ...(selected.group === "__custom" || drafts.some((d) => d.id === selected.id) ? { name: selected.name } : {}),
      });
      await refresh();
      flash("ok", enabled ? STRINGS.okEnabled : STRINGS.okDisabled);
    } catch (e) {
      flash("err", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  };

  const doSetDefault = async (modelId: string) => {
    if (!selectedState) return;
    try {
      await saveChatopDefaultModel(selectedState.routeId, modelId);
      await refresh();
      flash("ok", STRINGS.okDefault);
    } catch (e) {
      flash("err", e instanceof Error ? e.message : String(e));
    }
  };

  const doAddVendor = () => {
    const name = addName.trim();
    const url = addUrl.trim();
    if (!name || !url) return;
    const id = `my-${slugify(name)}`;
    if (listVendors.some((v) => v.id === id)) { setSelectedId(id); setAddOpen(false); return; }
    setDrafts((prev) => [...prev, { id, name, group: "__custom", defaultUrl: url, api: "openai-completions", keyUrl: "", ollamaLike: false }]);
    setSelectedId(id);
    setAddOpen(false);
    setAddName("");
    setAddUrl("");
  };

  const isDefaultModel = selectedState !== null && state?.defaultModel != null
    && state.defaultModel.provider === selectedState.routeId;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium text-foreground">{STRINGS.title}</div>
          <div className="text-xs text-foreground-subtlest">{STRINGS.subtitle}</div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className={online ? "text-emerald-500" : "text-amber-500"}>● {online ? "已连接察元OS" : "离线"}</span>
          {state?.defaultModel != null && (
            <span className="text-foreground-subtle">
              {STRINGS.defaultModel}: {state.defaultModel.provider}/{state.defaultModel.model}
            </span>
          )}
        </div>
      </div>

      {!online && !loading && (
        <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-amber-500">{STRINGS.offline}</div>
      )}
      {error !== null && <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-red-500">{error}</div>}

      <div className="overflow-clip rounded-xl border border-border bg-card">
        <div className="grid min-h-[36rem] grid-cols-[56px_minmax(0,1fr)] md:grid-cols-[224px_minmax(0,1fr)]">
          {/* 左栏：搜索 + 分组列表 + 添加 */}
          <div className="flex min-h-0 flex-col border-r border-border">
            <div className="p-2">
              <Input
                size="sm"
                placeholder={STRINGS.searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pb-2">
              {[...GROUPS.map((g) => ({ id: g.id, label: g.label })), { id: "__custom", label: STRINGS.customGroup }].map((group) => {
                const items = listVendors.filter((v) => v.group === group.id);
                if (items.length === 0) return null;
                return (
                  <div key={group.id}>
                    <div className="px-3 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wide text-foreground-subtlest">
                      {group.label}（{items.length}）
                    </div>
                    {items.map((v) => {
                      const vs = vendorStateById.get(v.id);
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => setSelectedId(v.id)}
                          className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs ${
                            selectedId === v.id ? "bg-surface text-foreground" : "text-foreground-subtle hover:bg-surface/60"
                          }`}
                        >
                          <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] ${
                            vs?.enabled ? "bg-primary text-primary-foreground" : "bg-surface text-foreground-subtle"
                          }`}>
                            {v.name.slice(0, 1)}
                          </span>
                          <span className="min-w-0 flex-1 truncate">{v.name}</span>
                          {v.free !== undefined && v.free in FREE_LABELS && (
                            <span className="shrink-0 rounded bg-surface px-1 text-[10px] text-foreground-subtle">{FREE_LABELS[v.free]}</span>
                          )}
                          {vs?.enabled && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            <div className="border-t border-border p-2">
              {!addOpen ? (
                <Button variant="outline" size="sm" className="w-full" onClick={() => setAddOpen(true)}>
                  ＋ {STRINGS.addVendor}
                </Button>
              ) : (
                <div className="space-y-1.5 p-1">
                  <Input size="xs" placeholder={STRINGS.addName} value={addName} onChange={(e) => setAddName(e.target.value)} />
                  <Input size="xs" placeholder={STRINGS.addUrl} value={addUrl} onChange={(e) => setAddUrl(e.target.value)} />
                  <div className="flex gap-1.5">
                    <Button size="xs" onClick={doAddVendor} disabled={!addName.trim() || !addUrl.trim()}>{STRINGS.addCreate}</Button>
                    <Button size="xs" variant="ghost" onClick={() => setAddOpen(false)}>取消</Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 右栏：厂商表单 */}
          <div className="relative min-w-0 p-4 pb-20 sm:p-6 sm:pb-24">
            {selected === null ? (
              <div className="pt-24 text-center text-xs text-foreground-subtlest">{STRINGS.emptyPick}</div>
            ) : (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{selected.name}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] ${
                      selectedState?.enabled ? "bg-emerald-500/10 text-emerald-500" : "bg-surface text-foreground-subtle"
                    }`}>
                      {selectedState?.enabled ? STRINGS.enabled : STRINGS.disabled}
                    </span>
                    <span className={`text-[10px] ${selectedState?.keyConfigured ? "text-emerald-500" : "text-foreground-subtlest"}`}>
                      {selectedState?.keyConfigured ? STRINGS.apiKeyConfigured : STRINGS.apiKeyNotConfigured}
                    </span>
                  </div>
                  <Switch
                    checked={selectedState?.enabled === true}
                    onCheckedChange={(v) => { if (selectedState) void doSave(v); }}
                    disabled={!online || busy !== ""}
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="text-xs font-medium text-foreground-subtle">{STRINGS.apiUrl}</div>
                  <Input size="sm" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} disabled={!online} placeholder={selected.defaultUrl} />
                </div>

                <div className="space-y-1.5">
                  <div className="text-xs font-medium text-foreground-subtle">{STRINGS.protocol}</div>
                  <Select value={api} onValueChange={setApi} disabled={!online}>
                    <SelectTrigger size="sm" className="w-56"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai-completions">OpenAI 兼容（chat completions）</SelectItem>
                      <SelectItem value="anthropic-messages">Anthropic（messages）</SelectItem>
                      <SelectItem value="openai-responses">OpenAI（responses）</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-medium text-foreground-subtle">{STRINGS.apiKey}</div>
                    {selected.keyUrl !== "" && (
                      <a href={selected.keyUrl} target="_blank" rel="noreferrer" className="text-[11px] text-primary hover:underline">{STRINGS.getKey}</a>
                    )}
                    <button type="button" className="text-[11px] text-foreground-subtle hover:text-foreground" onClick={() => setShowKey((v) => !v)}>
                      {showKey ? STRINGS.hideKey : STRINGS.showKey}
                    </button>
                  </div>
                  <Input
                    size="sm"
                    type={showKey ? "text" : "password"}
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    disabled={!online}
                    placeholder={selectedState?.keyConfigured && keyEchoed === null ? "••••••（已配置）" : "sk-…"}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => void doFetchModels()} disabled={!online || busy !== ""}>
                    {busy === "fetch" ? STRINGS.busyFetch : STRINGS.fetchModels}
                  </Button>
                  <Button size="sm" onClick={() => void doSave(true)} disabled={!online || busy !== ""}>
                    {busy === "save" ? STRINGS.busySave : STRINGS.saveEnable}
                  </Button>
                  {selectedState?.enabled && (
                    <Button variant="ghost" size="sm" onClick={() => void doSave(false)} disabled={busy !== ""}>
                      {STRINGS.disable}
                    </Button>
                  )}
                  {msg !== null && (
                    <span className={`text-xs ${msg.kind === "ok" ? "text-emerald-500" : "text-red-500"}`}>{msg.text}</span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="text-xs font-medium text-foreground-subtle">
                    {STRINGS.modelsLabel}（{models.filter((m) => m.enabled).length}/{models.length}）
                  </div>
                  {models.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-foreground-subtlest">
                      {STRINGS.fetchModels}
                    </div>
                  ) : (
                    <div className="max-h-72 space-y-0.5 overflow-y-auto rounded-lg border border-border p-1.5">
                      <div className="flex items-center gap-2 px-1 pb-1">
                        <button type="button" className="text-[11px] text-primary hover:underline"
                          onClick={() => setModels((prev) => prev.map((m) => ({ ...m, enabled: true })))}>全选</button>
                        <button type="button" className="text-[11px] text-foreground-subtle hover:text-foreground"
                          onClick={() => setModels((prev) => prev.map((m) => ({ ...m, enabled: false })))}>全不选</button>
                        {isDefaultModel && <span className="text-[11px] text-foreground-subtlest">★ {STRINGS.defaultModel}</span>}
                      </div>
                      {models.map((m) => (
                        <label key={m.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-surface/60">
                          <input
                            type="checkbox"
                            checked={m.enabled}
                            onChange={(e) => setModels((prev) => prev.map((x) => (x.id === m.id ? { ...x, enabled: e.target.checked } : x)))}
                            className="h-3.5 w-3.5 accent-[var(--color-primary)]"
                          />
                          <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground-subtle">{m.id}</span>
                          {selectedState?.enabled && (
                            <button
                              type="button"
                              className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${
                                isDefaultModel && state?.defaultModel?.model === m.id
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-surface text-foreground-subtle hover:text-foreground"
                              }`}
                              onClick={(e) => { e.preventDefault(); void doSetDefault(m.id); }}
                            >
                              {STRINGS.setDefault}
                            </button>
                          )}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChatopProviderPanel;
