/**
 * settings-chatop 公共入口（architecture-governance managed 模块）。
 * 跨模块只经此文件消费；api.ts / zcodeOffline.ts / modelCategories.ts 等
 * 是模块内部实现，不作其他模块的业务状态源。contract.ts 的类型镜像经
 * 值导出即可获得（组件类型），不重复声明同名类型。
 */
export { ChatopProviderPanel } from "@/settings/chatop/ChatopProviderPanel.js";
