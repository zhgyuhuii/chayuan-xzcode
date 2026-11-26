/**
 * 察元模型设置面板（chayuan-harness docs/zcode-model-settings-plan.md）。
 *
 * 替换 ZCode 设置页「模型设置」右侧面板（挂载点见 SettingsPage.tsx 的
 * modelProvider 分支——原 ModelProviderSection 停止渲染、代码保留）。与
 * 察元OS「设置→模型设置」同源（Q2）：厂商目录来自构建时快照
 * vendor-catalog.generated.json（85 家，scripts/zcode-gen-catalog.mjs 生成）。
 *
 * 双模式（2026-11-18 M1.5 用户裁定「完整直连配置+自动合流」）：
 * - 在线（52581 可达）：读写走 /api/model-config/*，写 harness 真源（凭据/
 *   llm-pi-ai/代理路由），常驻同步器自动物化 provider_config（1s 热加载）。
 * - 离线（察元OS 未运行）：经 ZCode 自身 providerSettingsService 写「厂商
 *   直连 personal provider」（真实地址+真实 Key）——ZCode 独立跑立即可用
 *   （对齐原版面板能力，零回退）；察元OS 启动后同步器 adopt 自动合流
 *   （zcodeOffline.ts / 服务端 zcode-sync.js adoptOfflineZcodeConfig）。
 *
 * 布局仿原生 ModelProviderSection 的 SectionLayout（左列表右表单 grid）；
 * 组件观感全用 ZCode 原生 ui 件。文案中文（察元体系单语）。
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button.js";
import { Input } from "@/components/ui/input.js";
import { Switch } from "@/components/ui/switch.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.js";
import { useBaseWorkspaceServices } from "@/hooks/useWorkspaceServices.js";
import catalogDoc from "./vendor-catalog.generated.json";
import {
  discoverChatopModels,
  errorText,
  fetchChatopCredential,
  saveChatopDefaultModel,
  saveChatopVendor,
  type ChatopVendorState,
} from "./api.js";
import {
  HARNESS_TO_ZCODE_API,
  ZCODE_TO_HARNESS_API,
  disableOfflineVendor,
  extractZcodeProviderEntries,
  matchCatalogVendor,
  saveOfflineVendor,
  type ChatopProviderSettingsService,
  type ZcodeProviderViewEntry,
} from "./zcodeOffline.js";
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
  searchPlaceholder: "搜索厂商…",
  filterAll: "全部",
  filterNokey: "免Key",
  filterFreeTier: "免费额度",
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
  addModel: "添加模型 id",
  addModelPlaceholder: "模型 id，如 glm-4-plus",
  saveEnable: "保存并启用",
  disable: "停用",
  setDefault: "默认",
  defaultModel: "默认模型",
  enabled: "已启用",
  disabled: "未启用",
  customGroup: "自定义供应商",
  emptyPick: "选择左侧厂商查看配置",
  errPickModel: "请至少勾选一个模型",
  errApiKey: "请填写 API Key（或在察元OS 侧已配置）",
  okEnabledOnline: "已启用（切换器约 1 秒内可见新厂商分组）",
  okEnabledOffline: "已保存直连配置（切换器约 1 秒内可用）",
  okDisabled: "已停用",
  okModels: (n: number) => `获取到 ${n} 个模型`,
  okDefault: "已设为默认模型（全家共享，谁最后切换谁赢）",
  busyFetch: "获取中…",
  busySave: "保存中…",
};

const slugify = (name: string) =>
  name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "custom";

/** 免费过滤（与察元 ModelSettings.matchesFreeFilter 同语义）：nokey=完全免Key
 *  （含 ollamaLike）；free-tier=免费Key 或有免费额度。 */
const matchesFreeFilter = (v: CatalogVendor, mode: string): boolean => {
  if (mode === "nokey") return v.free === "nokey" || v.ollamaLike === true;
  if (mode === "free-tier") return v.free === "freekey" || v.free === "tier";
  return true;
};

const FREE_LABELS: Record<string, string> = { nokey: "免Key", freekey: "免费Key", tier: "免费额度" };

/** 统一厂商态（在线来自 52581 /state；离线映射自 ZCode provider 视图）。 */
interface UnifiedVendorState {
  enabled: boolean;
  keyConfigured: boolean;
  keyRef?: string;
  routeId?: string;
  apiUrl: string; // 离线直连真实地址（proxy 条目=空，回落目录默认）
  api: string;
  models: { id: string; enabled: boolean }[];
  offlineProviderId?: string; // 离线模式：ZCode personal provider id
}

export function ChatopProviderPanel() {
  // 状态文案裁定（2026-11-18 用户）：离线/在线提示一律不显示——面板静默双模式
  const { state, online, refresh } = useChatopModelConfig();
  const baseServices = useBaseWorkspaceServices() as unknown as {
    providerSettingsService?: ChatopProviderSettingsService;
  };
  const providerSettings = baseServices?.providerSettingsService ?? null;

  const [search, setSearch] = useState("");
  // 免费过滤（2026-11-18 用户裁定：做进搜索框内部左侧下拉，不放框外）——
  // 语义与察元 ModelSettings.matchesFreeFilter 同款
  const [freeFilter, setFreeFilter] = useState("all");
  // 厂商组默认折叠（2026-11-18 用户裁定：分组可展开/收起，不再全量平铺遮挡）
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set(GROUPS.map((g) => g.id)));
  const toggleGroup = useCallback((id: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
  const [manualModel, setManualModel] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // 离线数据源：ZCode provider 视图（personal api-key 条目）
  const [offlineEntries, setOfflineEntries] = useState<ZcodeProviderViewEntry[]>([]);
  const loadOfflineView = useCallback(async () => {
    if (providerSettings === null) return;
    try {
      setOfflineEntries(extractZcodeProviderEntries(await providerSettings.getView()));
    } catch { /* 视图不可达：仅目录可用 */ }
  }, [providerSettings]);
  useEffect(() => {
    if (!online) void loadOfflineView();
  }, [online, loadOfflineView]);

  const flash = (kind: "ok" | "err", text: string) => {
    setMsg({ kind, text });
    setTimeout(() => setMsg(null), 4000);
  };

  const onlineStateById = useMemo(() => {
    const map = new Map<string, ChatopVendorState>();
    for (const v of state?.vendors ?? []) map.set(v.id, v);
    return map;
  }, [state]);

  // 离线条目 → 目录厂商 id 归位（chatop- 前缀 / baseUrl 匹配）；归位不了的做自定义行
  const offlineCustoms = useMemo(() => {
    const out: CatalogVendor[] = [];
    for (const e of offlineEntries) {
      if (e.providerId.startsWith("chatop-")) continue
      if (e.isProxyForm) continue
      const matched = matchCatalogVendor(e.baseUrl, CATALOG)
      if (matched !== null) continue
      out.push({ id: e.providerId, name: e.providerName || e.providerId, group: "__custom", defaultUrl: e.baseUrl, api: "openai-completions", keyUrl: "", ollamaLike: false })
    }
    return out
  }, [offlineEntries])

  const offlineStateById = useMemo(() => {
    const map = new Map<string, UnifiedVendorState>()
    for (const e of offlineEntries) {
      const vid = e.providerId.startsWith("chatop-")
        ? e.providerId.slice("chatop-".length)
        : (e.isProxyForm ? null : matchCatalogVendor(e.baseUrl, CATALOG))
      if (vid === null) continue // 直连但归位不了的 → offlineCustoms 自定义行（按 providerId 键）
      const prev = map.get(vid)
      // 代理形态条目的模型 id 带命名空间（chatop-zhipu/glm-x）：剥回裸 id——
      // 离线直连保存后模型名要原样发厂商，带前缀必 404
      const bareIds = e.modelIds.map((id) => (id.startsWith(`${e.providerId}/`) ? id.slice(e.providerId.length + 1) : id))
      const entry: UnifiedVendorState = {
        enabled: e.enabled,
        keyConfigured: prev?.keyConfigured || e.apiKey !== "" || e.isProxyForm,
        apiUrl: e.isProxyForm ? "" : e.baseUrl,
        api: e.isProxyForm || e.apiType === "" ? "" : (ZCODE_TO_HARNESS_API[e.apiType] ?? "openai-completions"),
        models: bareIds.map((id) => ({ id, enabled: true })),
        ...(e.providerId.startsWith("chatop-") ? {} : { offlineProviderId: e.providerId }),
      }
      // 同厂商可能同时有 chatop-*（代理形态，enabled 态）与直连条目（Key/模型）：合并
      map.set(vid, prev === undefined ? entry : {
        enabled: prev.enabled || entry.enabled,
        keyConfigured: prev.keyConfigured || entry.keyConfigured,
        keyRef: prev.keyRef,
        routeId: prev.routeId,
        apiUrl: prev.apiUrl || entry.apiUrl,
        api: prev.api || entry.api,
        models: prev.models.length > 0 ? prev.models : entry.models,
        offlineProviderId: prev.offlineProviderId ?? entry.offlineProviderId,
      })
      // 记录直连条目的 providerId（含 chatop-* 形态——原位改保留 id）
      if (!e.isProxyForm && map.get(vid)?.offlineProviderId === undefined) {
        const cur = map.get(vid)
        if (cur !== undefined) map.set(vid, { ...cur, offlineProviderId: e.providerId })
      }
    }
    // 自定义行（按 providerId 键）
    for (const c of offlineCustoms) {
      const e = offlineEntries.find((x) => x.providerId === c.id)
      if (e === undefined) continue
      map.set(c.id, {
        enabled: e.enabled,
        keyConfigured: e.apiKey !== "",
        apiUrl: e.baseUrl,
        api: ZCODE_TO_HARNESS_API[e.apiType] ?? "openai-completions",
        models: e.modelIds.map((id) => ({ id, enabled: true })),
        offlineProviderId: e.providerId,
      })
    }
    return map
  }, [offlineEntries, offlineCustoms])

  // 统一状态取值：在线走 52581，离线走视图映射
  const unifiedState = (vendorId: string): UnifiedVendorState | null => {
    if (online) {
      const v = onlineStateById.get(vendorId)
      if (v === undefined) return null
      return {
        enabled: v.enabled,
        keyConfigured: v.keyConfigured,
        keyRef: v.keyRef,
        routeId: v.routeId,
        apiUrl: v.apiUrl,
        api: v.api,
        models: v.models.map((m) => ({ id: m.id, enabled: m.enabled })),
      }
    }
    return offlineStateById.get(vendorId) ?? null
  }

  // 列表合成：目录 + （在线=服务端自定义 | 离线=视图自定义）+ 草稿；搜索与
  // 免费过滤叠加（AND）
  const listVendors = useMemo(() => {
    const q = search.trim().toLowerCase();
    const inCatalog = new Set(CATALOG.map((v) => v.id));
    const serverCustom = online
      ? (state?.vendors ?? []).filter((v) => v.custom && !inCatalog.has(v.id))
          .map((v) => ({ id: v.id, name: v.id, group: "__custom", defaultUrl: v.apiUrl, api: v.api, keyUrl: "", ollamaLike: false }))
      : offlineCustoms;
    const all = [...CATALOG, ...serverCustom, ...drafts];
    const bySearch = q ? all.filter((v) => v.id.includes(q) || v.name.toLowerCase().includes(q)) : all;
    return freeFilter === "all" ? bySearch : bySearch.filter((v) => matchesFreeFilter(v, freeFilter));
  }, [search, freeFilter, state, online, drafts, offlineCustoms]);

  const selected = selectedId !== null ? listVendors.find((v) => v.id === selectedId) ?? null : null;
  // 选中态 memo 化（React #185 根治，2026-11-26 真机点智谱实锤）：unifiedState
  // 每次渲染都返回新对象，直接当表单重建 effect 的依赖会形成
  // 「effect → setModels(新数组) → 重渲染 → 依赖(新对象)又变 → effect 再跑」
  // 的无限更新循环（在线模式必炸；离线返回 memo 稳定对象故不炸）。
  // 依赖改为两个状态图 memo + online——只在真换状态时变，引用稳定。
  const selectedState = useMemo(
    () => (selectedId !== null ? unifiedState(selectedId) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unifiedState 闭包即 online+两个状态图 memo
    [selectedId, online, onlineStateById, offlineStateById],
  );

  // 选中厂商 → 表单重建（状态值优先，缺省目录默认）
  useEffect(() => {
    if (selected === null) return;
    setApiUrl(selectedState?.apiUrl || selected.defaultUrl);
    setApi(selectedState?.api || selected.api || "openai-completions");
    setModels((selectedState?.models ?? []).map((m) => ({ id: m.id, enabled: m.enabled })));
    setMsg(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 选中厂商/状态变化时重建
  }, [selectedId, selectedState]);

  // Key 回显（Q15 察元式明文）：在线拉凭据端点；离线视图本就明文
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
    setKeyInput("");
    setKeyEchoed(null);
    setShowKey(false);
    if (selectedState === null || !selectedState.keyConfigured) return;
    if (online && selectedState.keyRef !== undefined) {
      void loadKeyEcho(selectedState.keyRef);
    } else if (!online) {
      const offlineEntry = offlineEntries.find((e) => e.providerId === selectedState.offlineProviderId)
        ?? offlineEntries.find((e) => e.providerId === `chatop-${selectedId}`);
      const key = offlineEntry?.apiKey ?? "";
      if (key !== "") { setKeyInput(key); setKeyEchoed(key); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 选中/模式切换时重建 Key 回显
  }, [selectedId, online, selectedState?.keyConfigured, selectedState?.keyRef, selectedState?.offlineProviderId]);

  const doFetchModels = async () => {
    if (selected === null) return;
    setBusy("fetch");
    try {
      const found = await discoverChatopModels({
        apiUrl: apiUrl.trim() || selected.defaultUrl,
        apiKey: keyInput.trim() || undefined,
      });
      setModels(found.map((id) => ({ id, enabled: true })));
      flash("ok", STRINGS.okModels(found.length));
    } catch (e) {
      flash("err", errorText(e) || String(e));
    } finally {
      setBusy("");
    }
  };

  const addManualModel = () => {
    const id = manualModel.trim();
    if (id === "" || models.some((m) => m.id === id)) { setManualModel(""); return; }
    setModels((prev) => [...prev, { id, enabled: true }]);
    setManualModel("");
  };

  const doSave = async (enabled: boolean) => {
    if (selected === null) return;
    const enabledIds = models.filter((m) => m.enabled).map((m) => m.id);
    if (enabled && enabledIds.length === 0) { flash("err", STRINGS.errPickModel); return; }
    const effectiveUrl = apiUrl.trim() || selected.defaultUrl;
    const key = keyInput.trim();
    if (enabled && !key && !selectedState?.keyConfigured && !selected.ollamaLike) {
      flash("err", STRINGS.errApiKey);
      return;
    }
    setBusy("save");
    try {
      if (online) {
        await saveChatopVendor({
          id: selected.id,
          enabled,
          apiUrl: effectiveUrl,
          api,
          ...(key && key !== keyEchoed ? { apiKey: key } : {}),
          models: enabledIds,
          ...(selected.group === "__custom" || drafts.some((d) => d.id === selected.id) ? { name: selected.name } : {}),
        });
        await refresh();
      } else {
        if (providerSettings === null) { flash("err", "ZCode 模型服务不可用"); return; }
        if (enabled) {
          await saveOfflineVendor({
            services: providerSettings,
            providerId: selectedState?.offlineProviderId ?? null,
            providerName: selected.name,
            apiUrl: effectiveUrl,
            apiType: HARNESS_TO_ZCODE_API[api] ?? "openai-chat-completions",
            apiKey: key || (keyEchoed ?? ""),
            modelIds: enabledIds,
          });
        } else if (selectedState?.offlineProviderId !== undefined) {
          await disableOfflineVendor(providerSettings, selectedState.offlineProviderId);
        }
        await loadOfflineView();
      }
      flash("ok", enabled ? (online ? STRINGS.okEnabledOnline : STRINGS.okEnabledOffline) : STRINGS.okDisabled);
    } catch (e) {
      flash("err", errorText(e) || String(e));
    } finally {
      setBusy("");
    }
  };

  const doSetDefault = async (modelId: string) => {
    if (selectedState?.routeId === undefined) return;
    try {
      await saveChatopDefaultModel(selectedState.routeId, modelId);
      await refresh();
      flash("ok", STRINGS.okDefault);
    } catch (e) {
      flash("err", errorText(e) || String(e));
    }
  };

  const doAddVendor = () => {
    const name = addName.trim();
    const url = addUrl.trim();
    if (name === "" || url === "") return;
    const id = `my-${slugify(name)}`;
    if (listVendors.some((v) => v.id === id)) { setSelectedId(id); setAddOpen(false); return; }
    setDrafts((prev) => [...prev, { id, name, group: "__custom", defaultUrl: url, api: "openai-completions", keyUrl: "", ollamaLike: false }]);
    setSelectedId(id);
    setAddOpen(false);
    setAddName("");
    setAddUrl("");
  };

  const isDefaultVendor = selectedState !== null && state?.defaultModel != null
    && state.defaultModel.provider === (selectedState.routeId ?? `chatop-${selectedId}`);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium text-foreground">{STRINGS.title}</div>
          <div className="text-xs text-foreground-subtlest">{STRINGS.subtitle}</div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {online && <span className="text-emerald-500">● 已连接察元OS</span>}
          {online && state?.defaultModel != null && (
            <span className="text-foreground-subtle">
              {STRINGS.defaultModel}: {state.defaultModel.provider}/{state.defaultModel.model}
            </span>
          )}
        </div>
      </div>

      <div className="overflow-clip rounded-xl border border-border bg-card">
        <div className="grid min-h-[36rem] grid-cols-[56px_minmax(0,1fr)] md:grid-cols-[224px_minmax(0,1fr)]">
          {/* 左栏：搜索 + 分组列表 + 添加 */}
          <div className="flex min-h-0 flex-col border-r border-border">
            <div className="p-2">
              {/* 组合搜索框：免费过滤下拉嵌在框内左侧（用户裁定 2026-11-18，
                  不放框外）——外框复刻 Input(sm) 的边框/底色/聚焦态 */}
              <div className="flex h-6 w-full items-center gap-1 rounded-md border border-input-border bg-input pl-1 pr-2 transition-colors hover:border-input-border-hover focus-within:border-input-border-focused focus-within:bg-input-focused">
                <Select value={freeFilter} onValueChange={setFreeFilter}>
                  <SelectTrigger
                    size="xs"
                    variant="ghost"
                    className="h-5 w-fit gap-0.5 rounded-sm px-1 text-ui-base text-foreground-subtle hover:text-foreground"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{STRINGS.filterAll}</SelectItem>
                    <SelectItem value="nokey">{STRINGS.filterNokey}</SelectItem>
                    <SelectItem value="free-tier">{STRINGS.filterFreeTier}</SelectItem>
                  </SelectContent>
                </Select>
                <span className="h-3 w-px shrink-0 bg-input-border" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={STRINGS.searchPlaceholder}
                  className="h-5 min-w-0 flex-1 bg-transparent text-ui-base/relaxed text-foreground outline-none placeholder:text-foreground-subtlest"
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pb-2">
              {[...GROUPS.map((g) => ({ id: g.id, label: g.label })), { id: "__custom", label: STRINGS.customGroup }].map((group) => {
                const items = listVendors.filter((v) => v.group === group.id);
                if (items.length === 0) return null;
                // 组内排序（用户裁定 2026-11-18，察元 ModelSettings 同语义）：
                // 已开启 → 已配 Key → 其余；稳定排序保留目录序
                const rank = (v: CatalogVendor): number => {
                  const s = unifiedState(v.id);
                  if (s?.enabled) return 0;
                  if (s?.keyConfigured) return 1;
                  return 2;
                };
                const sorted = [...items].sort((a, b) => rank(a) - rank(b));
                const enabledCount = sorted.filter((v) => unifiedState(v.id)?.enabled === true).length;
                // 搜索/过滤进行中自动展开（结果可见性优先）；平时尊重折叠态
                const expanded = search.trim() !== "" || freeFilter !== "all" || !collapsedGroups.has(group.id);
                return (
                  <div key={group.id}>
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.id)}
                      className="flex w-full items-center gap-1 px-3 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wide text-foreground-subtlest hover:text-foreground-subtle"
                    >
                      {expanded
                        ? <ChevronDownIcon className="size-3 shrink-0" />
                        : <ChevronRightIcon className="size-3 shrink-0" />}
                      <span>{group.label}</span>
                      {enabledCount > 0 && <span className="text-emerald-500">{enabledCount} 启用</span>}
                      <span>（{items.length}）</span>
                    </button>
                    {expanded && sorted.map((v) => {
                      const vs = unifiedState(v.id);
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
                    <Button size="xs" onClick={doAddVendor} disabled={addName.trim() === "" || addUrl.trim() === ""}>{STRINGS.addCreate}</Button>
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
                    onCheckedChange={(v) => { void doSave(v); }}
                    disabled={busy !== "" || (!online && providerSettings === null)}
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="text-xs font-medium text-foreground-subtle">{STRINGS.apiUrl}</div>
                  <Input size="sm" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} placeholder={selected.defaultUrl} />
                </div>

                <div className="space-y-1.5">
                  <div className="text-xs font-medium text-foreground-subtle">{STRINGS.protocol}</div>
                  <Select value={api} onValueChange={setApi}>
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
                    placeholder={selectedState?.keyConfigured && keyEchoed === null ? "••••••（已配置）" : "sk-…"}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void doFetchModels()}
                    disabled={busy !== ""}
                  >
                    {busy === "fetch" ? STRINGS.busyFetch : STRINGS.fetchModels}
                  </Button>
                  <Button size="sm" onClick={() => void doSave(true)} disabled={busy !== "" || (!online && providerSettings === null)}>
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
                      获取模型列表或手动添加模型 id
                    </div>
                  ) : (
                    <div className="max-h-72 space-y-0.5 overflow-y-auto rounded-lg border border-border p-1.5">
                      <div className="flex items-center gap-2 px-1 pb-1">
                        <button type="button" className="text-[11px] text-primary hover:underline"
                          onClick={() => setModels((prev) => prev.map((m) => ({ ...m, enabled: true })))}>全选</button>
                        <button type="button" className="text-[11px] text-foreground-subtle hover:text-foreground"
                          onClick={() => setModels((prev) => prev.map((m) => ({ ...m, enabled: false })))}>全不选</button>
                        {isDefaultVendor && <span className="text-[11px] text-foreground-subtlest">★ {STRINGS.defaultModel}</span>}
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
                          {online && selectedState?.enabled && (
                            <button
                              type="button"
                              className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${
                                isDefaultVendor && state?.defaultModel?.model === m.id
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
                  <div className="flex gap-1.5">
                    <Input
                      size="xs"
                      placeholder={STRINGS.addModelPlaceholder}
                      value={manualModel}
                      onChange={(e) => setManualModel(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addManualModel(); } }}
                    />
                    <Button variant="outline" size="xs" onClick={addManualModel} disabled={manualModel.trim() === ""}>
                      ＋ {STRINGS.addModel}
                    </Button>
                  </div>
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
