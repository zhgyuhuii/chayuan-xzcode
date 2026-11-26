/**
 * 察元模型配置 API 客户端（52581 模型代理 /api/model-config/*）。
 *
 * docs/zcode-model-settings-plan.md（chayuan-harness 仓）§三.1：ZCode 模型
 * 设置面板与察元「设置→模型设置」同源（Q2）、即时生效无草稿（Q3）、默认
 * 模型双向谁最后切换谁赢（Q14）、Key 明文可切换（Q15）。通道技术事实：
 * 52581 固定口 + CORS 全放行 + loopback 围栏——ZCode 主渲染树（file:// 无
 * CSP）唯一直连可达的察元服务面；dsh web 口动态口无 ACAO、RPC 要 cookie。
 *
 * 服务不可达（察元未运行）= 面板只读目录快照 + 离线提示（Q8 降级语义）。
 * 「获取模型列表」通道顺序见 docs/chayuan-model-settings-discovery.md：
 * 52581 同源 → ZCode host RPC（discoverVendorModels）兜底，独立运行可用。
 */

export const CHATOP_GATEWAY = "http://127.0.0.1:52581";

export interface ChatopModelEntry {
  id: string;
  enabled: boolean;
}

export interface ChatopVendorState {
  id: string;
  routeId: string;
  custom: boolean;
  enabled: boolean;
  keyConfigured: boolean;
  keyRef: string;
  apiUrl: string;
  api: string;
  models: ChatopModelEntry[];
  inProxy: boolean;
}

export interface ChatopDefaultModel {
  provider: string;
  model: string;
}

export interface ChatopState {
  gatewayPort: number;
  vendors: ChatopVendorState[];
  defaultModel: ChatopDefaultModel | null;
  settingsAvailable: boolean;
}

/** 错误提取：吃 string / {message} / {error} 三种形状（旧版 52581 代理的 404
 *  返回 error 为对象——直接 String() 会出 "[object Object]"，2026-11-18 真机实锤）。 */
export function errorText(x: unknown): string {
  if (typeof x === "string" && x !== "") return x;
  if (x instanceof Error) return x.message;
  if (x !== null && typeof x === "object") {
    const o = x as { message?: unknown; error?: unknown };
    if (typeof o.message === "string" && o.message !== "") return o.message;
    if (o.error !== undefined) return errorText(o.error);
  }
  return "";
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${CHATOP_GATEWAY}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
    signal: AbortSignal.timeout(8000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(errorText((body as { error?: unknown }).error) || `HTTP ${res.status}`);
  }
  return body as T;
}

export async function fetchChatopState(): Promise<ChatopState> {
  return call<ChatopState>("/api/model-config/state");
}

export async function probeGateway(): Promise<boolean> {
  try {
    await fetch(`${CHATOP_GATEWAY}/health`, { signal: AbortSignal.timeout(2500) });
    return true;
  } catch {
    return false;
  }
}

export interface SaveVendorInput {
  id: string;
  enabled: boolean;
  apiUrl?: string;
  api?: string;
  apiKey?: string;
  models?: string[];
  name?: string;
}

export async function saveChatopVendor(input: SaveVendorInput): Promise<{ ok: true; routeId: string }> {
  return call("/api/model-config/vendor", { method: "POST", body: JSON.stringify(input) });
}

export async function fetchChatopCredential(ref: string): Promise<string | null> {
  const r = await call<{ value: string | null }>(
    `/api/model-config/credential?ref=${encodeURIComponent(ref)}`,
  );
  return r.value;
}

export async function saveChatopDefaultModel(provider: string, model: string): Promise<{ ok: true; unchanged?: boolean }> {
  return call("/api/model-config/default-model", {
    method: "POST",
    body: JSON.stringify({ provider, model }),
  });
}

export interface DiscoverChatopModelsInput {
  apiUrl: string;
  apiKey?: string;
}

/** host 兜底通道签名（IProviderSettingsService.discoverVendorModels 的结构面）。 */
export type HostModelDiscoverer = (
  input: DiscoverChatopModelsInput,
) => Promise<{ models: string[] }>;

export async function discoverChatopModels(
  input: DiscoverChatopModelsInput,
  hostDiscover?: HostModelDiscoverer,
): Promise<string[]> {
  // 主路：52581 发现中继（察元OS 新版在场时；可解析 harness keyRef 凭据）。
  let primaryError: Error | null = null;
  try {
    const r = await call<{ models: string[] }>("/api/model-config/discover", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return r.models;
  } catch (e) {
    primaryError = e instanceof Error ? e : new Error(errorText(e) || String(e));
  }
  // 兜底：ZCode 自身 host 进程发现（IProviderSettingsService.discoverVendorModels，
  // Node 无 CORS 限制）——察元OS / ZCodeHarvest 均不在场（ZCode 独立运行）时
  // 「获取模型列表」同样可用。host 错误（真到了厂商的业务错误 / 如实报网络
  // 不可达）原样抛出，不叠加误导性提示。
  // （2026-11-26 用户裁定：移除原 52596 发现中继兜底分支，host 路径全面接位。）
  if (hostDiscover !== undefined) {
    return (await hostDiscover(input)).models;
  }
  throw primaryError?.message !== "" && primaryError?.message !== "Error"
    ? primaryError
    : new Error("获取模型列表失败：察元OS 与 ZCode 模型服务均不可用");
}
