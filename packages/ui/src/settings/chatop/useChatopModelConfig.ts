/**
 * 察元模型配置数据 hook：mount / 操作后拉 52581 state；generation 防回退
 *（useSourceServerManagementSnapshot 同款形状）。服务不可达或察元侧为旧版本
 *（/health 通但 /api/model-config/* 404）时 online=false，面板降级离线直连
 * 模式（zcodeOffline.ts——可配置可用，不只读）。
 *
 * 离线期间每 15s 静默重探（silent=不触发 loading，防轮询闪烁；探通才全量
 * refresh）；上线瞬间 +3s 再静默补一刷——察元OS 启动后同步器 adopt 合流需要
 * 片刻把离线直连条目提升进真源，晚一拍的 refresh 能拿到合流后的最终状态。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchChatopState, probeGateway, type ChatopState } from "./api.js";

export interface ChatopModelConfigSnapshot {
  state: ChatopState | null;
  online: boolean;
  loading: boolean;
  error: string | null;
  refresh: (opts?: { silent?: boolean }) => Promise<void>;
}

export function useChatopModelConfig(): ChatopModelConfigSnapshot {
  const [state, setState] = useState<ChatopState | null>(null);
  const [online, setOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    const gen = ++generation.current;
    if (!silent) setLoading(true);
    try {
      const alive = await probeGateway();
      const next = alive ? await fetchChatopState() : null;
      if (gen !== generation.current) return; // 过期响应丢弃（防回退）
      setOnline(alive);
      setState(next);
      setError(null);
    } catch (e) {
      if (gen !== generation.current) return;
      setOnline(false);
      setState(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (!silent && gen === generation.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // 离线静默重探：探通（察元OS 起来了/升级了）才触发一次全量 refresh
  useEffect(() => {
    if (online) return;
    const timer = setInterval(() => {
      void probeGateway().then((alive) => {
        if (alive) void refresh({ silent: true });
      });
    }, 15_000);
    return () => clearInterval(timer);
  }, [online, refresh]);

  // 上线后 +3s 补一刷（等 adopt 合流落定）
  useEffect(() => {
    if (!online) return;
    const t = setTimeout(() => void refresh({ silent: true }), 3000);
    return () => clearTimeout(t);
  }, [online, refresh]);

  return { state, online, loading, error, refresh };
}
