import type { PrismaClient, VocabEntry } from "../../../generated/client";
import type { AiExample, AiRelatedWords, GrammarCheckResult } from "./aiTypes";
import { chat, chatJSON, type ChatMessage } from "./groq";
import { parseTags, parseTargetMeanings, updateVocabEntry } from "./vocab";

function loadEntry(prisma: PrismaClient, vocabId: string): Promise<VocabEntry> {
  return prisma.vocabEntry.findUniqueOrThrow({ where: { id: vocabId } });
}

// ---- Feature 1: example sentences ----

async function examplesContent(sourceText: string, meanings: string[]): Promise<AiExample[]> {
  // response_format: json_object only guarantees syntactically valid JSON,
  // not that the model actually included the "examples" key (or that each
  // item has both fields) — same class of issue relatedWordsContent below
  // already guards against. Without this, a response missing/nulling the
  // key crashed examplesContent with a TypeError that propagated out of the
  // ai:previewExamples/ai:generateExamples IPC call as an uncaught render
  // exception in Popup.tsx, taking the whole popup down with it.
  const raw = await chatJSON<{ examples?: (Partial<AiExample> | null)[] | null }>({
    system:
      `Bạn là trợ lý học từ vựng. Với một từ/cụm từ, tạo chính xác 3 câu ví dụ tự nhiên, ` +
      `đa dạng ngữ cảnh, 8-18 từ, có dùng từ đó. Nếu từ đó là tiếng Anh, câu ví dụ viết bằng ` +
      `tiếng Anh kèm bản dịch tiếng Việt ngắn gọn ở "translation". Nếu là tiếng Việt thì câu ví dụ ` +
      `viết bằng tiếng Việt kèm bản dịch tiếng Anh. Chỉ trả về JSON: ` +
      `{"examples":[{"sentence":string,"translation":string}]}.`,
    user: `Từ/cụm từ: "${sourceText}" — nghĩa: ${meanings.join(", ")}`,
  });
  return (raw.examples ?? [])
    .filter((ex): ex is AiExample => !!ex?.sentence)
    .map((ex) => ({ sentence: ex.sentence, translation: ex.translation ?? "" }))
    .slice(0, 3);
}

// Not tied to a saved vocabId — used by the popup's AI tabs before the
// word has been saved (see Popup.tsx), so nothing here touches Prisma.
export function previewExamples(sourceText: string, meanings: string[]): Promise<AiExample[]> {
  return examplesContent(sourceText, meanings);
}

export async function generateExamples(prisma: PrismaClient, deviceId: string, vocabId: string): Promise<VocabEntry> {
  const entry = await loadEntry(prisma, vocabId);
  const examples = await examplesContent(entry.sourceText, parseTargetMeanings(entry));
  return updateVocabEntry(prisma, deviceId, vocabId, { aiExamples: examples });
}

// ---- Feature 2: nuance/context explanation ----

async function nuanceContent(sourceText: string, meanings: string[]): Promise<string> {
  const { explanation } = await chatJSON<{ explanation: string }>({
    system:
      `Bạn là gia sư ngôn ngữ. Với một từ, cụm động từ hoặc thành ngữ, giải thích ngắn gọn ` +
      `(3-5 câu, tiếng Việt): sắc thái nghĩa, mức độ trang trọng/thân mật, các từ dễ nhầm lẫn ` +
      `(nếu có), và ngữ cảnh sử dụng phù hợp. Nếu là thành ngữ/cụm động từ, giải thích nghĩa bóng. ` +
      `Chỉ trả về JSON: {"explanation": string}.`,
    user: `Từ/cụm từ: "${sourceText}" — nghĩa: ${meanings.join(", ")}`,
  });
  return explanation;
}

export function previewNuance(sourceText: string, meanings: string[]): Promise<string> {
  return nuanceContent(sourceText, meanings);
}

export async function explainNuance(prisma: PrismaClient, deviceId: string, vocabId: string): Promise<VocabEntry> {
  const entry = await loadEntry(prisma, vocabId);
  const explanation = await nuanceContent(entry.sourceText, parseTargetMeanings(entry));
  return updateVocabEntry(prisma, deviceId, vocabId, { aiNuance: explanation });
}

// ---- Feature 3: related words ----

// Same class of defect as the missing-key case below, one level deeper: a
// present "forms" array can still contain a null/malformed item (e.g.
// `[{"pos":"noun","word":"bind"}, null]`) — the renderer used to do
// `f.word`/`f.pos` on every item unconditionally, so one bad item crashed
// the whole related-words view with a "Cannot read properties of null"
// error. Filtering item-by-item here (not just `?? []` on the array itself)
// closes that gap.
function sanitizeStringList(list: unknown, max: number): string[] {
  if (!Array.isArray(list)) return [];
  return list.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, max);
}

function sanitizeForms(list: unknown): { pos: string; word: string }[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter((item): item is { pos: unknown; word: unknown } => !!item && typeof item === "object")
    .filter((item) => typeof item.word === "string" && item.word.trim().length > 0)
    .map((item) => ({ pos: typeof item.pos === "string" ? item.pos : "", word: item.word as string }));
}

async function relatedWordsContent(englishWord: string): Promise<AiRelatedWords> {
  // response_format: json_object only guarantees syntactically valid JSON —
  // not that the model actually included every field it was asked for. A
  // word with no obvious antonym (e.g. "binding") can come back missing
  // that key entirely, and the renderer unconditionally does
  // `.antonyms.length` — normalize here, at the boundary where untrusted
  // model output enters the app, rather than trusting the shape downstream.
  const raw = await chatJSON<Partial<AiRelatedWords>>({
    system:
      `Bạn là từ điển đồng nghĩa tiếng Anh. Với một từ, liệt kê tối đa 5 từ đồng nghĩa, ` +
      `tối đa 5 từ trái nghĩa, và các dạng từ loại liên quan (danh từ/động từ/tính từ/trạng từ). ` +
      `Chỉ trả về JSON: {"synonyms":string[],"antonyms":string[],"forms":[{"pos":string,"word":string}]}.`,
    user: `Từ: "${englishWord}"`,
  });
  return {
    synonyms: sanitizeStringList(raw.synonyms, 5),
    antonyms: sanitizeStringList(raw.antonyms, 5),
    forms: sanitizeForms(raw.forms),
  };
}

// Same englishWord derivation the persisted version below and
// VocabDetailModal's dictionary lookup both use — kept in one place so a
// word that doesn't qualify fails the same way from either path.
function deriveEnglishWord(sourceText: string, sourceLang: string, targetText: string, targetLang: string): string {
  const englishWord = sourceLang === "en" ? sourceText : targetLang === "en" ? targetText : null;
  if (!englishWord) throw new Error("Chỉ hỗ trợ từ liên quan cho từ tiếng Anh.");
  return englishWord;
}

export function previewRelatedWords(
  sourceText: string,
  sourceLang: string,
  targetText: string,
  targetLang: string,
): Promise<AiRelatedWords> {
  return relatedWordsContent(deriveEnglishWord(sourceText, sourceLang, targetText, targetLang));
}

export async function suggestRelatedWords(
  prisma: PrismaClient,
  deviceId: string,
  vocabId: string,
): Promise<VocabEntry> {
  const entry = await loadEntry(prisma, vocabId);
  const englishWord = deriveEnglishWord(entry.sourceText, entry.sourceLang, entry.targetText, entry.targetLang);
  const related = await relatedWordsContent(englishWord);
  return updateVocabEntry(prisma, deviceId, vocabId, { aiRelatedWords: related });
}

// ---- Feature 5: quiz question (not persisted, review-only) ----

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function generateQuizQuestion(prisma: PrismaClient, vocabId: string): Promise<QuizQuestion> {
  const entry = await loadEntry(prisma, vocabId);
  const meanings = parseTargetMeanings(entry);
  const {
    question,
    correctAnswer,
    distractors,
  } = await chatJSON<{ question: string; correctAnswer: string; distractors: string[] }>({
    system:
      `Bạn tạo câu hỏi trắc nghiệm ôn từ vựng. Cho một từ và nghĩa đúng, tạo một câu hỏi kiểu ` +
      `"Từ này có nghĩa là gì?" cùng đúng 3 phương án nhiễu — hợp lý nhưng SAI, cùng loại từ và ` +
      `độ khó tương đương với đáp án đúng, không trùng nhau, không trùng đáp án đúng. ` +
      `Chỉ trả về JSON: {"question":string,"correctAnswer":string,"distractors":[string,string,string]}.`,
    user: `Từ: "${entry.sourceText}" (${entry.sourceLang}) — đáp án đúng: "${meanings[0]}"`,
    maxTokens: 400,
  });
  // Never trust the model's claimed randomness for option order — shuffle ourselves.
  const tagged = shuffle([
    { text: correctAnswer, correct: true },
    ...distractors.slice(0, 3).map((text) => ({ text, correct: false })),
  ]);
  return {
    question,
    options: tagged.map((o) => o.text),
    correctIndex: tagged.findIndex((o) => o.correct),
  };
}

// ---- Feature 6: tag/set suggestions (not persisted) ----

export interface TagSuggestion {
  tags: string[];
  suggestedSetId: string | null;
  suggestedSetName: string | null;
}

export async function suggestTags(prisma: PrismaClient, vocabId: string): Promise<TagSuggestion> {
  const entry = await loadEntry(prisma, vocabId);
  const meanings = parseTargetMeanings(entry);

  const [allEntries, sets] = await Promise.all([
    prisma.vocabEntry.findMany({ where: { deletedAt: null }, select: { tags: true } }),
    prisma.vocabSet.findMany({ where: { deletedAt: null } }),
  ]);
  // Reuse existing tag vocabulary so the model doesn't fragment synonymous tags.
  const tagFreq = new Map<string, number>();
  for (const e of allEntries) for (const t of parseTags(e)) tagFreq.set(t, (tagFreq.get(t) ?? 0) + 1);
  const existingTags = [...tagFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([t]) => t);

  const data = await chatJSON<{ tags: string[]; suggestedSetName: string | null }>({
    system:
      `Bạn gợi ý nhãn (tag) và bộ từ để tổ chức một từ vựng đã lưu. Gợi ý tối đa 4 nhãn ngắn gọn ` +
      `bằng tiếng Việt không dấu câu, ƯU TIÊN tái sử dụng nhãn đã có nếu hợp lý. Chọn MỘT bộ từ ` +
      `phù hợp nhất trong danh sách cho trước, hoặc null nếu không có bộ nào phù hợp — KHÔNG được ` +
      `bịa tên bộ từ mới. Chỉ trả về JSON: {"tags":string[],"suggestedSetName":string|null}.`,
    user:
      `Từ: "${entry.sourceText}" — nghĩa: ${meanings.join(", ")}\n` +
      `Nhãn đã có: ${existingTags.join(", ") || "(chưa có)"}\n` +
      `Danh sách bộ từ: ${sets.map((s) => s.name).join(", ") || "(chưa có)"}`,
  });

  const matchedSet = sets.find((s) => s.name.toLowerCase() === data.suggestedSetName?.toLowerCase());
  return {
    tags: data.tags.slice(0, 4),
    suggestedSetId: matchedSet?.id ?? null,
    suggestedSetName: matchedSet?.name ?? null,
  };
}

// ---- Feature 7: bulk extraction (no DB, pure text -> candidates) ----

export interface VocabCandidate {
  text: string;
  reason: string;
}

export async function extractVocabCandidates(paragraph: string): Promise<VocabCandidate[]> {
  const trimmed = paragraph.trim().slice(0, 4000);
  if (!trimmed) return [];
  const { candidates } = await chatJSON<{ candidates: VocabCandidate[] }>({
    system:
      `Đọc đoạn văn và chọn ra tối đa 15 từ/cụm từ đáng học (ưu tiên từ nâng cao, thành ngữ, ` +
      `cụm động từ, từ chuyên ngành — bỏ qua từ cơ bản như "the", "is", "go"). Giữ nguyên hình thức ` +
      `gốc trong đoạn văn. Với mỗi từ, nêu lý do ngắn gọn bằng tiếng Việt. ` +
      `Chỉ trả về JSON: {"candidates":[{"text":string,"reason":string}]}.`,
    user: trimmed,
    maxTokens: 1200,
  });
  return candidates.slice(0, 15);
}

// ---- Feature 8: freeform chat about a word ----
//
// Never persisted (no DB column, no sync payload) — unlike the other
// features, there's no single "current" answer to cache, so this always
// takes the word's info directly rather than a vocabId, working the same
// way for both saved entries and not-yet-saved previews (see WordChat.tsx,
// used from both VocabDetailModal and Popup.tsx).

export type { ChatMessage };

export async function chatAboutWord(
  sourceText: string,
  sourceLang: string,
  targetText: string,
  targetLang: string,
  meanings: string[],
  history: ChatMessage[],
): Promise<string> {
  const system =
    `Bạn là gia sư ngôn ngữ, đang trò chuyện với người dùng về một từ/cụm từ họ vừa tra: ` +
    `"${sourceText}" (${sourceLang}) — nghĩa: ${meanings.join(", ") || targetText} (${targetLang}). ` +
    `Trả lời các câu hỏi của họ về từ này — cách dùng, sắc thái, ví dụ thêm, so sánh với từ khác, ` +
    `nguồn gốc, v.v. Trả lời ngắn gọn, tự nhiên, bằng tiếng Việt trừ khi họ hỏi bằng ngôn ngữ khác.`;
  return chat({ system, messages: history, maxTokens: 500 });
}

// ---- Feature 9: grammar/naturalness check (Ctrl+Shift+G on selected text) ----
//
// Never persisted — same reasoning as chatAboutWord above, this operates on
// whatever sentence the user currently has selected, not a saved vocab
// entry, so there's no vocabId and nothing to cache.

export async function checkGrammar(sentence: string): Promise<GrammarCheckResult> {
  const trimmed = sentence.trim();
  // response_format: json_object only guarantees syntactically valid JSON,
  // not that every requested field is actually present or the right type —
  // same class of gap relatedWordsContent above guards against. A response
  // missing "corrected"/"isNatural" used to leave the renderer showing
  // "undefined" or crashing on a falsy check, so every field is defaulted
  // here rather than trusted as-is.
  const raw = await chatJSON<Partial<GrammarCheckResult>>({
    system:
      `Bạn là biên tập viên ngôn ngữ. Người dùng đưa một câu (tiếng Anh hoặc tiếng Việt). Đánh giá câu đó ` +
      `có tự nhiên và đúng ngữ pháp không. Nếu đã ổn, trả lời isNatural:true và corrected giữ nguyên câu gốc. ` +
      `Nếu chưa ổn, trả lời isNatural:false, đưa ra một câu viết lại tự nhiên hơn/đúng ngữ pháp hơn ở "corrected" ` +
      `(cùng ngôn ngữ với câu gốc), và giải thích ngắn gọn (1-2 câu, tiếng Việt) lý do ở "explanation". ` +
      `Chỉ trả về JSON: {"isNatural":boolean,"corrected":string,"explanation":string}.`,
    user: trimmed,
    maxTokens: 400,
  });
  return {
    original: trimmed,
    isNatural: raw.isNatural ?? true,
    corrected: typeof raw.corrected === "string" && raw.corrected.trim() ? raw.corrected.trim() : trimmed,
    explanation: typeof raw.explanation === "string" ? raw.explanation : "",
  };
}
