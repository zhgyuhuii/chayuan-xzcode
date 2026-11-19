import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

/**
 * 察元定制登录页（2026-11-18 用户裁定：替代「欢迎来到 ZCode/中国/全球」官方登录）。
 *
 * 三通道（全部复用 zcode-relay-svc 既有端点，手机页协议零侵入）：
 * 1. 微信内打开：按钮直跳 /wxgate?f&s&r（公众号静默授权 → 服务端标记 flow ready +
 *    本设备种 session 跳回）。
 * 2. 浏览器打开：二维码内容 = 同一 wxgate URL——微信扫码后在手机微信里完成静默授权，
 *    服务端标记 flow ready；本页轮询 cli/poll 拿 JWT 种 session 进主页（跨设备闭环）。
 * 3. 「直接进入」：客户端直接 POST authorize（一按即签同款），零微信依赖。
 */

type Phase = "init" | "qr" | "entering" | "error";

interface FlowInfo {
  flowId: string;
  state: string;
  pollToken: string;
  returnTo: string;
}

function randomHex64(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (v) =>
    v.toString(16).padStart(2, "0"),
  ).join("");
}

async function postJson(path: string, body: unknown, headers: Record<string, string>): Promise<Record<string, unknown>> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const payload = (await res.json()) as { code?: number; data?: Record<string, unknown> };
  if (payload.code !== 0 || !payload.data) throw new Error("bad response");
  return payload.data;
}

export function WebWechatLoginPage(): React.ReactNode {
  const [phase, setPhase] = useState<Phase>("init");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const flowRef = useRef<FlowInfo | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const stoppedRef = useRef(false);
  const inWechat = /MicroMessenger/i.test(navigator.userAgent);
  // qr 模式（2026-11-18 用户裁定）：桌面登录弹窗=纯二维码大图（无「直接进入」）
  const qrOnly = new URLSearchParams(window.location.search).get("qr") === "1";
  // embed 模式：嵌在 ZCode 应用内小窗 iframe——ready 后 postMessage 给宿主并本页显示 ✓
  const embed = new URLSearchParams(window.location.search).get("embed") === "1";
  const [done, setDone] = useState(false);

  const commitAndEnter = useCallback(
    (jwt: string, userId: string, name: string, avatar = "") => {
      const flow = flowRef.current;
      try {
        window.localStorage.setItem(
          "oauth:browser_session",
          JSON.stringify({
            version: 1,
            provider: "zai_cn",
            userInfo: {
              id: userId,
              username: name,
              displayName: name,
              ...(avatar !== "" ? { avatarUrl: avatar } : {}),
            },
            zcodeJwtToken: jwt,
            revision: String(Date.now()),
          }),
        );
      } catch {
        /* localStorage 不可用时直接刷新重走 */
      }
      window.location.replace(flow?.returnTo || "/remote/v4");
    },
    [],
  );

  // 轮询（2s，静默失败不刷错误——授权完成前是常态）。embed 模式（ZCode 应用内 iframe）：
  // ready 后 postMessage 给宿主（宿主轮询 window.__zcPendingLogin 拿 JWT 写键），页面显示 ✓。
  const pollOnce = useCallback(async () => {
    const flow = flowRef.current;
    if (flow === null || stoppedRef.current) return;
    try {
      const res = await fetch(`/api/v1/oauth/cli/poll/${encodeURIComponent(flow.flowId)}`, {
        headers: { authorization: `Bearer ${flow.pollToken}` },
      });
      if (!res.ok) return;
      const payload = (await res.json()) as {
        code?: number;
        data?: { status?: string; token?: string; user?: { user_id?: string; name?: string; avatar?: string } };
      };
      if (payload.code === 0 && payload.data?.status === "ready" && payload.data.token) {
        stoppedRef.current = true;
        if (pollTimerRef.current !== null) window.clearInterval(pollTimerRef.current);
        const userId = payload.data.user?.user_id || "chayuan-user";
        const name = payload.data.user?.name || "察元用户";
        const avatar =
          typeof payload.data.user?.avatar === "string" ? payload.data.user.avatar : "";
        if (embed) {
          try {
            // avatar：微信昵称头像（2026-11-19）——宿主写 user_info.avatar，菜单原生渲染头像
            window.parent?.postMessage(
              { type: "zc-login-done", jwt: payload.data.token, id: userId, name, avatar },
              "*",
            );
          } catch {
            /* 宿主不在时静默 */
          }
          setDone(true);
          setPhase("entering");
          return;
        }
        commitAndEnter(payload.data.token, userId, name, avatar);
      }
    } catch {
      /* 网络抖动静默重试 */
    }
  }, [commitAndEnter, embed]);

  // 建 flow → 出码 → 起轮询
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // 手机回跳目标（2026-11-19 裁定：扫码后微信里**直入远控主页**）——剥掉本页
        // 专用参数 qr/embed，只保留 sid/mid 等配对参数；不带配对参数时落 /remote/v4 主页。
        const phoneParams = new URLSearchParams(window.location.search);
        phoneParams.delete("qr");
        phoneParams.delete("embed");
        const phoneQuery = phoneParams.toString();
        const returnTo =
          window.location.pathname + (phoneQuery !== "" ? `?${phoneQuery}` : "") ||
          "/remote/v4";
        // 外部 flow 复用（2026-11-18 独立版 sidecar）：URL 带 f&s → 用外部 flow（sidecar
        // 自持轮询写键），本页只负责出码+提示；否则自建 flow（dsh 弹窗/直接打开）。
        const extF = new URLSearchParams(window.location.search).get("f") ?? "";
        const extS = new URLSearchParams(window.location.search).get("s") ?? "";
        let flowId = "";
        let state = "";
        let pollToken = "";
        if (extF !== "" && extS !== "") {
          flowId = extF;
          state = extS;
        } else {
          pollToken = randomHex64();
          const data = await postJson(
            "/api/v1/oauth/cli/init",
            { provider: "zai_cn" },
            { authorization: `Bearer ${pollToken}` },
          );
          if (cancelled) return;
          flowId = String(data.flow_id ?? "");
          state = new URL(String(data.authorize_url)).searchParams.get("state") ?? "";
        }
        if (flowId === "" || state === "") throw new Error("bad flow");
        flowRef.current = { flowId, state, pollToken, returnTo };
        const wxgateUrl =
          `${window.location.origin}/wxgate?f=${encodeURIComponent(flowId)}` +
          `&s=${encodeURIComponent(state)}&r=${encodeURIComponent(returnTo)}`;
        const qr = await QRCode.toDataURL(wxgateUrl, { width: qrOnly ? 280 : 232, margin: 1 });
        if (cancelled) return;
        setQrDataUrl(qr);
        setPhase("qr");
        // 外部 flow（无 pollToken）不轮询——凭据写入由 sidecar 完成，页面只出码提示
        if (pollToken !== "") {
          pollTimerRef.current = window.setInterval(() => void pollOnce(), 2000);
        }
      } catch {
        if (!cancelled) {
          setErrorMsg("连接服务失败，请刷新重试");
          setPhase("error");
        }
      }
    })();
    return () => {
      cancelled = true;
      stoppedRef.current = true;
      if (pollTimerRef.current !== null) window.clearInterval(pollTimerRef.current);
    };
  }, [pollOnce]);

  // 直接进入：客户端自动授权（同一 flow，下轮 poll 即 ready）
  const enterDirectly = useCallback(async () => {
    const flow = flowRef.current;
    if (flow === null) return;
    setPhase("entering");
    try {
      await fetch("/api/v1/oauth/authorize", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: `flow=${encodeURIComponent(flow.flowId)}&state=${encodeURIComponent(flow.state)}`,
      });
      await pollOnce();
    } catch {
      setPhase("qr");
    }
  }, [pollOnce]);

  const wxgateHref =
    flowRef.current !== null
      ? `${window.location.origin}/wxgate?f=${encodeURIComponent(flowRef.current.flowId)}` +
        `&s=${encodeURIComponent(flowRef.current.state)}&r=${encodeURIComponent(flowRef.current.returnTo)}`
      : "#";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#161616] px-6 text-[#eee]">
      <div className="w-full max-w-[420px] text-center">
        <h1 className="text-xl font-semibold">{done ? "✓ 已登录" : qrOnly ? "微信扫码登录" : "察元远程控制"}</h1>
        <p className="mt-2 text-sm text-[#999]">
          {done ? "请回到 ZCode 继续" : qrOnly ? "扫码后自动登录" : "微信扫码登录，或直接进入"}
        </p>

        {phase === "init" ? <p className="mt-10 text-sm text-[#888]">正在准备…</p> : null}

        {phase === "qr" || phase === "entering" ? (
          <>
            {inWechat ? (
              <a
                href={wxgateHref}
                className="mt-8 inline-block w-full rounded-xl bg-[#07c160] px-6 py-3.5 text-base font-medium text-white"
              >
                微信授权登录
              </a>
            ) : qrOnly ? (
              // 察元定制（2026-11-19）：桌面登录弹窗=居中卡片，顶部微信绿图标（官方网
              // 页登录同构），二维码居中带内边距
              <div className="mx-auto mt-6 w-[300px] rounded-2xl bg-white px-5 pb-5 pt-5 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-[#07c160]">
<svg viewBox="0 0 36 30" width="30" height="26" aria-hidden="true">
                    <ellipse cx="14" cy="12" rx="13" ry="11" fill="#ffffff" />
                    <circle cx="9.5" cy="10.5" r="1.7" fill="#07c160" />
                    <circle cx="17.5" cy="10.5" r="1.7" fill="#07c160" />
                    <path d="M8 19 L5.5 24.5 L12 20.5 Z" fill="#ffffff" />
                    <ellipse cx="24.5" cy="18.5" rx="10.5" ry="9.5" fill="#ffffff" stroke="#07c160" strokeWidth="1.5" />
                    <circle cx="21" cy="17" r="1.4" fill="#07c160" />
                    <circle cx="28" cy="17" r="1.4" fill="#07c160" />
                    <path d="M30 25.5 L32.5 29.5 L26.5 26.5 Z" fill="#ffffff" />
                  </svg>
                </div>
                <p className="mt-3 text-base font-medium text-[#111]">微信扫码登录</p>
                <div className="mt-4 flex items-center justify-center">
                  {qrDataUrl !== "" ? (
                    <img src={qrDataUrl} alt="微信扫码登录" width={264} height={264} className="rounded-lg border border-[#eee]" />
                  ) : (
                    <div className="flex h-[264px] w-[264px] items-center justify-center text-sm text-[#999]">生成中…</div>
                  )}
                </div>
                <p className="mt-3 text-xs text-[#666]">请使用微信「扫一扫」· 扫码后自动登录</p>
              </div>
            ) : (
              <div className="mt-6 rounded-2xl bg-white p-3">
                {qrDataUrl !== "" ? (
                  <img src={qrDataUrl} alt="微信扫码登录" width={232} height={232} />
                ) : (
                  <div className="flex h-[232px] items-center justify-center text-sm text-[#999]">生成中…</div>
                )}
              </div>
            )}
            {!inWechat ? (
              <p className="mt-3 text-xs leading-5 text-[#999]">
                请使用微信「扫一扫」
                <br />
                已关注公众号：扫码直接登录
                <br />
                未关注：关注后自动登录
              </p>
            ) : null}
            {qrOnly ? null : (
              <button
                type="button"
                onClick={() => void enterDirectly()}
                disabled={phase === "entering"}
                className="mt-6 w-full rounded-xl border border-[#3a3a3a] bg-transparent px-6 py-3 text-base text-[#ccc] disabled:opacity-60"
              >
                {phase === "entering" ? "正在进入…" : "直接进入"}
              </button>
            )}
            <p className="mt-3 text-xs text-[#777]">{phase === "entering" ? "正在建立连接" : qrOnly ? "等待扫码中…" : "等待扫码中，扫码后自动进入"}</p>
          </>
        ) : null}

        {phase === "error" ? (
          <div className="mt-10">
            <p className="text-sm text-[#e88]">{errorMsg}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-xl bg-[#3b82f6] px-8 py-2.5 text-sm text-white"
            >
              重试
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
