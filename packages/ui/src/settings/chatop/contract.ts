/**
 * settings-chatop 对外契约：调用方要想正确调用就必须知道的一切都写在这里；其余对外不可见。
 *
 * 唯一意图：挂载察元模型设置面板。面板无 props、数据自取（在线 52581
 * /api/model-config/*；离线经 ZCode providerSettingsService 直连 personal
 * provider，见 chatop/zcodeOffline.ts），调用方不注入任何状态。
 * 行为规格真源：chayuan-harness docs/zcode-model-settings-plan.md（Q2/Q3/
 * Q8/Q9/Q14/Q15/Q16/Q17）。
 */
import type { ChatopProviderPanel as Panel } from "@/settings/chatop/ChatopProviderPanel.js";

export type ChatopProviderPanel = typeof Panel;
