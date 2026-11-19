import { useEffect, useRef } from "react";

/**
 * 察元定制（2026-11-18）：web 远控模式不落官方 WelcomeScreen 登录门——
 * 断开连接/会话过期时自动走伪 OAuth 重登（种 session 后整页重载回主页）。
 * 仅在 main.tsx 的 web-remote 渲染分支传入 onRelogin 时启用（桌面形态不受影响）。
 */
export function WebRemoteReloginGate({ onRelogin }: { onRelogin: () => void }): React.ReactNode {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    onRelogin();
  }, [onRelogin]);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#161616] text-[#eee]">
      <p className="text-base">正在返回登录…</p>
      <p className="mt-2 text-sm text-[#999]">即将进入微信扫码 / 直接进入页</p>
    </div>
  );
}
