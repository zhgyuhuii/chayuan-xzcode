/**
 * 剪贴板写入（察元定制，2026-11-27）：navigator.clipboard.writeText 在
 * Electron <webview> guest 里即使权限放行也可能 NotAllowedError（mojo 剪贴板
 * 通道对 guest frame 的连接缺陷，真机实锤：独立 BrowserWindow 正常、内嵌
 * webview 会话历史复制按钮无反应）。本工具先走标准异步 API，失败回退
 * execCommand('copy')（经典编辑栈路径，不依赖任何剪贴板权限，点击手势内
 * 稳定可用）。
 */
export async function writeClipboardText(text: string): Promise<void> {
  if (!text) return;
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      /* webview guest / 失焦 / 权限拒绝：走 execCommand 后备 */
    }
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.top = "-9999px";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  ta.remove();
  if (!ok) throw new Error("clipboard write failed (both async API and execCommand)");
}
