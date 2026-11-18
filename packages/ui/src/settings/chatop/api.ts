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

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${CHATOP_GATEWAY}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
    signal: AbortSignal.timeout(8000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(String((body as { error?: string }).error ?? `HTTP ${res.status}`));
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

export async function discoverChatopModels(input: { apiUrl: string; apiKey?: string }): Promise<string[]> {
  // 主路：52581 发现中继（察元OS 新版在场时）。
  try {
    const r = await call<{ models: string[] }>("/api/model-config/discover", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return r.models;
  } catch (e) {
    // 回退：ZCodeHarvest 自带发现中继（wrapper 拉起，端口注册表 ZCODE_DISCOVER_PORT
    // =52596；仅回环）——察元OS 未运行/旧版本时「获取模型列表」同样可用。
    try {
      const res = await fetch("http://127.0.0.1:52596/discover", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(10_000),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; models?: string[]; error?: string };
      if (!res.ok || body.ok !== true) {
        throw new Error(String(body.error ?? `HTTP ${res.status}`));
      }
      return body.models ?? [];
    } catch {
      // 两条路都失败：抛主路错误（信息更贴近察元侧状态）
      throw e;
    }
  }
}
