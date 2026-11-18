/**
 * 离线直连配置助手（2026-11-18 M1.5 用户裁定「完整直连配置+自动合流」）。
 *
 * 52581 不可达（察元OS 未运行）时，面板经 ZCode 自身 providerSettingsService
 * （RPC→host 进程内 ProviderConfigService→provider_config.json 原子写+1s 热加载）
 * 写「厂商直连 personal provider」：真实 baseUrl+真实 apiKey（明文落盘，本机
 * 0600 文件，同 CLI 工具惯例）。ZCode 独立跑立即可用（对齐原版面板能力）。
 *
 * 察元OS 启动后由 chatop-models 常驻同步器 adopt 合流（zcode-sync.js
 * adoptOfflineZcodeConfig）：Key 提升进凭据库+llm-pi-ai profile+代理路由，
 * 随后文件被重物化为代理形态。providerId 由 host 生成（createPersonalProvider
 * 不可指定、未知 templateId 即 throw——config-service.ts:229），映射靠
 * chatop-* 前缀 / baseUrl 目录匹配 / 名称 slug 三级（见服务端）。
 *
 * Key 展示沿用 Q15 察元式明文：provider_config.json 的 access.apiKey 本就
 * 明文（resolver 透传），视图可直接回显。
 */

/** harness api 协议名 ↔ ZCode api.type（openai-chat-completions 同义 openai-completions）。 */
export const HARNESS_TO_ZCODE_API: Record<string, string> = {
  "openai-completions": "openai-chat-completions",
  "anthropic-messages": "anthropic-messages",
  "openai-responses": "openai-responses",
}

/** 逆向映射（离线视图的 api.type → 面板 Select 的 harness 协议名）。 */
export const ZCODE_TO_HARNESS_API: Record<string, string> = {
  "openai-chat-completions": "openai-completions",
  "anthropic-messages": "anthropic-messages",
  "openai-responses": "openai-responses",
}

/** 手动模型规则（scripts/zcode-materialize-provider.mjs 四轮真机验证形状的镜像：
 *  四布尔+inputFormat 三布尔必填、reasoningLevel.map 必填、maxOutputTokens 只认 max）。 */
const MANUAL_MODEL_CONFIG = {
  properties: {
    contextWindow: 200000,
    supportsJsonSchemaOutput: false,
    supportsNativeWebSearch: false,
    supportsMidConversationSystem: false,
    inputFormat: { supportsImage: true, supportsVideo: false, supportsPdf: true },
  },
  optionSpecs: {
    reasoningLevel: { values: ["disabled", "enabled"], map: "{}" },
    maxOutputTokens: { max: 4096 },
  },
}

/** providerSettingsService 的结构面（避免深 import 服务类型；RPC 代理同形）。 */
export interface ChatopProviderSettingsService {
  getView(): Promise<unknown>
  createPersonalProvider(input: { providerName?: string }): Promise<{ providerId: string }>
  savePersonalProviderOverlay(
    providerId: string,
    config: Record<string, unknown>,
    metadata?: { providerName?: string; enabled?: boolean },
  ): Promise<unknown>
  deletePersonalProvider(providerId: string): Promise<unknown>
  addPersonalModel(providerId: string, modelId: string, config: unknown, useRecommendedConfig?: boolean): Promise<unknown>
  deletePersonalModel(providerId: string, modelId: string): Promise<unknown>
}

export interface ZcodeProviderViewEntry {
  providerId: string
  providerName?: string
  enabled: boolean
  isProxyForm: boolean
  apiKey: string
  baseUrl: string
  apiType: string
  modelIds: string[]
}

/** 读 ZCode 视图 → 直连条目清单（只取 personal api-key 形态；builtin/account 不动）。 */
export function extractZcodeProviderEntries(view: unknown): ZcodeProviderViewEntry[] {
  const providers = (view as { providers?: unknown[] })?.providers
  if (!Array.isArray(providers)) return []
  const out: ZcodeProviderViewEntry[] = []
  for (const p of providers) {
    const pid = String((p as { providerId?: unknown })?.providerId ?? "")
    if (!pid) continue
    const cfg = (p as { effectiveConfig?: Record<string, unknown> })?.effectiveConfig ?? {}
    const access = (cfg.access ?? {}) as { type?: string; apiKey?: string | null }
    const api = (cfg.api ?? {}) as { type?: string; baseUrl?: string | null }
    const group = String((cfg as { group?: unknown }).group ?? "")
    if (group !== "standard-personal") continue // 只看 personal（同步器与离线面板写的都是这组）
    const key = access.type === "api-key" ? String(access.apiKey ?? "") : ""
    const baseUrl = String(api.baseUrl ?? "")
    const isProxyForm = key === "chayuan-local" || baseUrl.includes("127.0.0.1:52581")
    const models = (p as { models?: Array<{ modelId?: unknown }> })?.models
    out.push({
      providerId: pid,
      providerName: String((p as { providerName?: unknown })?.providerName ?? pid),
      enabled: (p as { enabled?: unknown })?.enabled !== false,
      isProxyForm,
      apiKey: isProxyForm ? "" : key,
      baseUrl,
      apiType: String(api.type ?? "openai-chat-completions"),
      modelIds: Array.isArray(models) ? models.map((m) => String(m?.modelId ?? "")).filter(Boolean) : [],
    })
  }
  return out
}

const normUrl = (u: string) => u.trim().toLowerCase().replace(/\/+$/, "")
const stripVersion = (u: string) => normUrl(u).replace(/\/v\d+$/, "")

/** baseUrl 对目录快照匹配（与服务端 adopt matchVendorByBaseUrl 同算法：/v1 尾段归一）。 */
export function matchCatalogVendor(baseUrl: string, catalog: Array<{ id: string; defaultUrl: string }>): string | null {
  if (!baseUrl) return null
  const a1 = normUrl(baseUrl)
  const a2 = stripVersion(baseUrl)
  for (const v of catalog) {
    if (!v.defaultUrl) continue
    if (a1 === normUrl(v.defaultUrl) || a2 === stripVersion(v.defaultUrl)) return v.id
  }
  return null
}

export interface SaveOfflineVendorInput {
  services: ChatopProviderSettingsService
  providerId: string | null // 已有直连条目则原位改（id 保留→adopt 前缀直配）
  providerName: string
  apiUrl: string
  apiType: string // ZCode api.type
  apiKey: string // 空串=不覆盖已有（稀疏 overlay）
  modelIds: string[]
}

/** 离线保存：创建（或原位改）直连 provider + 模型清单对齐（补增/删多余）。 */
export async function saveOfflineVendor(input: SaveOfflineVendorInput): Promise<string> {
  const { services } = input
  let pid = input.providerId
  if (pid === null || pid === "") {
    const created = await services.createPersonalProvider({ providerName: input.providerName })
    pid = created.providerId
  }
  await services.savePersonalProviderOverlay(
    pid,
    {
      group: "standard-personal",
      access: { type: "api-key", ...(input.apiKey ? { apiKey: input.apiKey } : {}) },
      api: { type: input.apiType, baseUrl: input.apiUrl },
    },
    { providerName: input.providerName },
  )
  // 模型清单 diff：视图现值 vs 目标（addPersonalModel 幂等追加；多余删除）
  const view = (await services.getView()) as { providers?: Array<{ providerId?: string; models?: Array<{ modelId?: string }> }> }
  const current = view?.providers?.find((p) => p.providerId === pid)?.models ?? []
  const currentIds = current.map((m) => String(m?.modelId ?? "")).filter(Boolean)
  for (const id of input.modelIds) {
    if (!currentIds.includes(id)) await services.addPersonalModel(pid, id, MANUAL_MODEL_CONFIG, false)
  }
  for (const id of currentIds) {
    if (!input.modelIds.includes(id)) await services.deletePersonalModel(pid, id)
  }
  return pid
}

/** 离线停用：chatop-* 条目落 enabled:false（同步器 adopt 传播停用到 harness 后
 *  由物化清除）；host 生成 id 的条目直接删除（harness 从未见过它）。 */
export async function disableOfflineVendor(services: ChatopProviderSettingsService, providerId: string): Promise<void> {
  if (providerId.startsWith("chatop-")) {
    await services.savePersonalProviderOverlay(providerId, {}, { enabled: false })
  } else {
    await services.deletePersonalProvider(providerId)
  }
}
