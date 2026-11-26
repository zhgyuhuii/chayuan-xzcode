/**
 * 模型类型分组（Q17 裁定，2026-11-26，chayuan-harness
 * docs/zcode-model-settings-plan.md）：对话/视觉理解/图像生成/视频生成/
 * 语音/向量/重排 7 类。
 *
 * discover 只回模型 id 串（api.ts discoverChatopModels——厂商原始元数据
 * owned_by/modality 在 52581/52596 外部中继内消费、不透传到 ZCode 树），
 * 类型只能按 id 命名规则前端推断。纯函数、渲染层派生，不复制 models
 * state（唯一所有者仍是面板的 models useState）。识别不出的 id 一律归
 * 「对话模型」兜底（Q17 裁定）。
 */
import type { ChatopModelEntry } from "./api.js";

export interface ModelCategoryDef {
  id: string;
  label: string;
}

/** 组序即展示序（对话优先；空组在渲染层滤掉）。 */
export const MODEL_CATEGORIES: ModelCategoryDef[] = [
  { id: "chat", label: "对话模型" },
  { id: "vision", label: "视觉理解" },
  { id: "image", label: "图像生成" },
  { id: "video", label: "视频生成" },
  { id: "audio", label: "语音" },
  { id: "embedding", label: "向量 Embedding" },
  { id: "rerank", label: "重排 Rerank" },
];

/** 分类规则（数组序=优先级）：词元全等为主，复合子串兜底词元切不开的
 *  连写命名，词元正则处理 glm-4v 这类「数字+v」尾缀形态。 */
interface CategoryRule {
  category: string;
  tokens: string[];
  substrings: string[];
  tokenPatterns?: RegExp[];
}

/** rerank 排在 embedding 之前：bge-reranker 系 id 同时命中两类的词元，
 *  重排语义优先（Q17 类目里重排是更具体的用途）。 */
const RULES: CategoryRule[] = [
  {
    category: "vision",
    tokens: ["vl", "qvq"],
    substrings: ["vision", "llava", "internvl", "minicpm-v", "cogvlm"],
    tokenPatterns: [/^\d+v$/, /^vl\d+$/], // glm-4v / glm-4.5v / step-1v；deepseek-vl2
  },
  {
    category: "image",
    tokens: ["sd3", "t2i", "i2i", "kolors", "hidream", "ideogram", "recraft", "imagen", "seedream", "seededit"],
    substrings: ["cogview", "dall", "flux", "diffusion", "image", "wanx"],
  },
  {
    category: "video",
    tokens: ["veo", "t2v", "i2v", "seedance", "kling", "vidu", "sora"],
    substrings: ["cogvideo", "video"],
  },
  {
    category: "audio",
    tokens: ["tts", "asr", "whisper", "speech", "voice", "audio", "sensevoice", "cosyvoice", "paraformer"],
    substrings: [],
  },
  { category: "rerank", tokens: ["rerank", "reranker", "ranker"], substrings: [] },
  {
    category: "embedding",
    tokens: ["bge", "m3e", "voyage", "nomic", "gte"],
    substrings: ["embedding", "embed"],
  },
];

/** 按模型 id 推断类型（Q17：识别不出 → chat 对话模型兜底）。 */
export function classifyModelId(id: string): string {
  const lower = id.toLowerCase();
  const tokens = lower.split(/[^a-z0-9]+/);
  for (const rule of RULES) {
    if (rule.tokens.some((t) => tokens.includes(t))) return rule.category;
    if (rule.substrings.some((s) => lower.includes(s))) return rule.category;
    if (rule.tokenPatterns?.some((re) => tokens.some((t) => re.test(t)))) return rule.category;
  }
  return "chat";
}

export interface ModelCategoryGroup {
  category: ModelCategoryDef;
  models: ChatopModelEntry[];
}

/** 按类别分组、滤空组、保持 MODEL_CATEGORIES 展示序与原清单内顺序。 */
export function groupModelsByCategory(models: readonly ChatopModelEntry[]): ModelCategoryGroup[] {
  const byCategory = new Map<string, ChatopModelEntry[]>();
  for (const m of models) {
    const category = classifyModelId(m.id);
    const bucket = byCategory.get(category);
    if (bucket === undefined) byCategory.set(category, [m]);
    else bucket.push(m);
  }
  return MODEL_CATEGORIES.flatMap((category) => {
    const group = byCategory.get(category.id);
    return group === undefined ? [] : [{ category, models: group }];
  });
}
