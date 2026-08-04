import type { PrismaClient, VocabEntry } from "../../../generated/client";
import type { AiExample, AiRelatedWords } from "./aiTypes";
import { chatJSON } from "./groq";
import { parseTags, parseTargetMeanings, updateVocabEntry } from "./vocab";

function loadEntry(prisma: PrismaClient, vocabId: string): Promise<VocabEntry> {
  return prisma.vocabEntry.findUniqueOrThrow({ where: { id: vocabId } });
}

// ---- Feature 1: example sentences ----

async function examplesContent(sourceText: string, meanings: string[]): Promise<AiExample[]> {
  const { examples } = await chatJSON<{ examples: AiExample[] }>({
    system:
      `Bạn là trợ lý học từ vựng. Với một từ/cụm từ, tạo chính xác 3 câu ví dụ tự nhiên, ` +
      `đa dạng ngữ cảnh, 8-18 từ, có dùng từ đó. Nếu từ đó là tiếng Anh, câu ví dụ viết bằng ` +
      `tiếng Anh kèm bản dịch tiếng Việt ngắn gọn ở "translation". Nếu là tiếng Việt thì câu ví dụ ` +
      `viết bằng tiếng Việt kèm bản dịch tiếng Anh. Chỉ trả về JSON: ` +
      `{"examples":[{"sentence":string,"translation":string}]}.`,
    user: `Từ/cụm từ: "${sourceText}" — nghĩa: ${meanings.join(", ")}`,
  });
  return examples.slice(0, 3);
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

async function relatedWordsContent(englishWord: string): Promise<AiRelatedWords> {
  return chatJSON<AiRelatedWords>({
    system:
      `Bạn là từ điển đồng nghĩa tiếng Anh. Với một từ, liệt kê tối đa 5 từ đồng nghĩa, ` +
      `tối đa 5 từ trái nghĩa, và các dạng từ loại liên quan (danh từ/động từ/tính từ/trạng từ). ` +
      `Chỉ trả về JSON: {"synonyms":string[],"antonyms":string[],"forms":[{"pos":string,"word":string}]}.`,
    user: `Từ: "${englishWord}"`,
  });
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

// ---- Feature 4: mnemonic ----

async function mnemonicContent(sourceText: string, meanings: string[]): Promise<string> {
  const { mnemonic } = await chatJSON<{ mnemonic: string }>({
    system:
      `Bạn là chuyên gia ghi nhớ (mnemonics). Tạo MỘT mẹo ghi nhớ ngắn gọn, sáng tạo bằng tiếng Việt ` +
      `(liên tưởng âm thanh/hình ảnh/câu chuyện ngắn), tối đa 2 câu, giúp nhớ nghĩa của từ. ` +
      `Chỉ trả về JSON: {"mnemonic": string}.`,
    user: `Từ: "${sourceText}" — nghĩa: ${meanings.join(", ")}`,
    maxTokens: 200,
  });
  return mnemonic;
}

export function previewMnemonic(sourceText: string, meanings: string[]): Promise<string> {
  return mnemonicContent(sourceText, meanings);
}

export async function generateMnemonic(prisma: PrismaClient, deviceId: string, vocabId: string): Promise<VocabEntry> {
  const entry = await loadEntry(prisma, vocabId);
  const mnemonic = await mnemonicContent(entry.sourceText, parseTargetMeanings(entry));
  return updateVocabEntry(prisma, deviceId, vocabId, { mnemonic });
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
