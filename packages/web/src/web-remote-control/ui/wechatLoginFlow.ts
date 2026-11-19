/**
 * 察元定制（2026-11-18）：web 远控模式「断开连接」/会话失效的落点。
 * 用户裁定：断开后落新登录页（微信扫码 + 直接进入），不回官方 WelcomeScreen。
 * 做法：清本地会话（browser_session + 旧式散键 + JWT 失效重启标记）→ 整页回
 * /remote/v4 → bootstrap 检不到会话 → 渲染 WebWechatLoginPage。
 */

const SESSION_KEYS = [
  "oauth:browser_session",
  "oauth:active_provider",
  "zcodejwttoken",
  "oauth:zai_cn:access_token",
  "oauth:zai_cn:user_info",
  "oauth:zai:access_token",
  "oauth:zai:user_info",
  "zcode:auth:jwt-invalid-restart",
];

export function exitRemoteToLoginPage(): void {
  try {
    for (const key of SESSION_KEYS) window.localStorage.removeItem(key);
  } catch {
    /* localStorage 不可用——直接重载，bootstrap 自行判定 */
  }
  window.location.replace("/remote/v4");
}
