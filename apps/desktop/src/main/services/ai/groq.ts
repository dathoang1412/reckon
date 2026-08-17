import { getGroqApiKey } from "../../utils/settings";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
// llama-3.3-70b-versatile was decommissioned by Groq on 2026-08-16; this is
// their recommended replacement (see console.groq.com/docs/deprecations).
// Good quality/speed balance for the short, structured completions every
// feature in ai.ts needs (a few sentences to a short list) — none of them
// need a bigger/slower model.
const MODEL = "openai/gpt-oss-120b";

export class GroqNotConfiguredError extends Error {
  constructor() {
    super("Chưa cấu hình Groq API key — vào Cài đặt để thêm.");
    this.name = "GroqNotConfiguredError";
  }
}

interface ChatJSONOptions {
  system: string;
  user: string;
  maxTokens?: number;
  // Only set by the Settings "test key" flow, which needs to validate a
  // just-typed key before the user has saved it — everywhere else reads
  // the saved key from settings.ts.
  apiKeyOverride?: string;
}

interface GroqChatResponse {
  choices?: { message?: { content?: string } }[];
}

// Mirrors translate.ts/dictionary.ts's raw-fetch idiom (no SDK anywhere in
// this codebase) — plain fetch, typed response shape, throw on anything
// unexpected. `response_format: json_object` makes Groq itself guarantee
// valid JSON back, so callers can trust the parsed shape matches what their
// prompt asked for.
export async function chatJSON<T>(opts: ChatJSONOptions): Promise<T> {
  const apiKey = opts.apiKeyOverride ?? getGroqApiKey();
  if (!apiKey) throw new GroqNotConfiguredError();

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      temperature: 0.4,
      max_tokens: opts.maxTokens ?? 700,
      response_format: { type: "json_object" },
    }),
  });

  if (res.status === 401) throw new Error("Groq API key không hợp lệ.");
  if (res.status === 429) throw new Error("Groq: vượt quá giới hạn tốc độ — thử lại sau.");
  if (!res.ok) throw new Error(`Groq HTTP ${res.status}`);

  const json = (await res.json()) as GroqChatResponse;
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("Groq: phản hồi rỗng");

  try {
    return JSON.parse(content) as T;
  } catch {
    throw new Error("Groq: phản hồi không đúng định dạng JSON");
  }
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatOptions {
  system: string;
  messages: ChatMessage[];
  maxTokens?: number;
}

// Plain freeform reply, not JSON — used for the word-chat feature (see
// ai.ts's chatAboutWord), which is open-ended Q&A rather than one of the
// other features' fixed-shape completions.
export async function chat(opts: ChatOptions): Promise<string> {
  const apiKey = getGroqApiKey();
  if (!apiKey) throw new GroqNotConfiguredError();

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "system", content: opts.system }, ...opts.messages],
      temperature: 0.5,
      max_tokens: opts.maxTokens ?? 500,
    }),
  });

  if (res.status === 401) throw new Error("Groq API key không hợp lệ.");
  if (res.status === 429) throw new Error("Groq: vượt quá giới hạn tốc độ — thử lại sau.");
  if (!res.ok) throw new Error(`Groq HTTP ${res.status}`);

  const json = (await res.json()) as GroqChatResponse;
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("Groq: phản hồi rỗng");
  return content;
}
