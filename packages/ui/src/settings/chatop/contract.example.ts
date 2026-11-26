/**
 * settings-chatop 标准调用示例：agent 靠模仿写代码，这里放的就是该模仿的那份。
 */
import { createElement } from "react";

import { ChatopProviderPanel } from "@/settings/chatop/index.js";

/** 标准调用示例：SettingsPage 的 modelProvider 分支原样挂载（无 props、
 *  数据自取——在线 52581 / 离线 providerSettingsService 双模式都在面板内部）。 */
export const chatopModelSettingsPanelNode = createElement(ChatopProviderPanel);
