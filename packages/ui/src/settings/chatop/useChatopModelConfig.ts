/**
 * 察元模型配置数据 hook：mount / 操作后拉 52581 state；generation 防回退
 *（useSourceServerManagementSnapshot 同款形状）。服务不可达时 online=false，
 * 面板降级只读目录快照（离线可看，操作禁用）。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchChatopState, probeGateway, type ChatopState } from "./api.js";

export interface ChatopModelConfigSnapshot {
  state: ChatopState | null;
  online: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useChatopModelConfig(): ChatopModelConfigSnapshot {
  const [state, setState] = useState<ChatopState | null>(null);
  const [online, setOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    const gen = ++generation.current;
    setLoading(true);
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
      if (gen === generation.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { state, online, loading, error, refresh };
}
