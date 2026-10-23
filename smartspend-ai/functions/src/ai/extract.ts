import {
  GEMINI_RECEIPT_RESPONSE_SCHEMA,
  normaliseAiReceipt,
  parseOcrText,
  RECEIPT_EXTRACTION_PROMPT,
  type ExtractedReceipt,
} from '@smartspend/core';
import { GoogleAuth } from 'google-auth-library';

export type Fetch = typeof fetch;

export interface ExtractOptions {
  geminiApiKey?: string;
  geminiModel: string;
  /** Enable Cloud Vision OCR fallback (uses the function's service account). */
  visionFallback: boolean;
  today: string;
  defaultCurrency: string;
  fetchImpl?: Fetch;
  visionToken?: () => Promise<string>;
}

export class ExtractionError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
  }
}

const SUPPORTED = new Set(['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp', 'application/pdf']);

/**
 * Receipt extraction pipeline:
 *   1. Gemini multimodal structured extraction (JSON schema, temperature 0)
 *   2. Fallback: Cloud Vision OCR text -> deterministic parser
 * Either way, the output passes through core normalisation/validation, which
 * never fills in missing values.
 */
export async function extractReceipt(file: Buffer, mimeType: string, opts: ExtractOptions): Promise<ExtractedReceipt> {
  if (!SUPPORTED.has(mimeType)) throw new ExtractionError(`Unsupported file type ${mimeType}.`, false);
  if (file.length > 15 * 1024 * 1024) throw new ExtractionError('File is larger than 15 MB.', false);
  const f = opts.fetchImpl ?? fetch;
  let geminiError: unknown = null;

  if (opts.geminiApiKey) {
    try {
      const raw = await callGemini(file, mimeType, opts.geminiApiKey, opts.geminiModel, f);
      return normaliseAiReceipt(raw, { model: opts.geminiModel, today: opts.today, defaultCurrency: opts.defaultCurrency });
    } catch (e) {
      geminiError = e;
    }
  }
  if (opts.visionFallback) {
    const text = await callVision(file, mimeType, f, opts.visionToken);
    if (!text.trim()) throw new ExtractionError('No text could be read from this image. Please retake the photo with better lighting.', false);
    return normaliseAiReceipt(parseOcrText(text), { model: 'cloud-vision+rules', today: opts.today, defaultCurrency: opts.defaultCurrency, rawText: text });
  }
  if (geminiError) throw geminiError instanceof ExtractionError ? geminiError : new ExtractionError(String((geminiError as Error).message ?? geminiError), true);
  throw new ExtractionError('No AI extraction provider is configured (set GEMINI_API_KEY or enable Vision).', false);
}

export async function callGemini(file: Buffer, mimeType: string, apiKey: string, model: string, f: Fetch): Promise<unknown> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const res = await f(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: RECEIPT_EXTRACTION_PROMPT }, { inline_data: { mime_type: mimeType, data: file.toString('base64') } }] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: GEMINI_RECEIPT_RESPONSE_SCHEMA },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new ExtractionError(`Gemini request failed (${res.status}): ${body.slice(0, 200)}`, res.status >= 500 || res.status === 429);
  }
  const json = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }> };
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  if (!text) throw new ExtractionError(`Gemini returned no content (${json.candidates?.[0]?.finishReason ?? 'unknown'}).`, true);
  try {
    return JSON.parse(text);
  } catch {
    throw new ExtractionError('Gemini returned malformed JSON.', true);
  }
}

let auth: GoogleAuth | null = null;
async function defaultVisionToken(): Promise<string> {
  auth ??= new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-vision'] });
  const client = await auth.getClient();
  const t = await client.getAccessToken();
  if (!t.token) throw new ExtractionError('Could not obtain a Vision API token.', true);
  return t.token;
}

export async function callVision(file: Buffer, mimeType: string, f: Fetch, token = defaultVisionToken): Promise<string> {
  const isPdf = mimeType === 'application/pdf';
  const url = `https://vision.googleapis.com/v1/${isPdf ? 'files' : 'images'}:annotate`;
  const request = isPdf
    ? { inputConfig: { content: file.toString('base64'), mimeType }, features: [{ type: 'DOCUMENT_TEXT_DETECTION' }], pages: [1, 2, 3, 4, 5] }
    : { image: { content: file.toString('base64') }, features: [{ type: 'DOCUMENT_TEXT_DETECTION' }], imageContext: { languageHints: ['en', 'ms'] } };
  const res = await f(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` },
    body: JSON.stringify({ requests: [request] }),
  });
  if (!res.ok) throw new ExtractionError(`Vision request failed (${res.status}).`, res.status >= 500 || res.status === 429);
  const json = (await res.json()) as {
    responses?: Array<{ fullTextAnnotation?: { text?: string }; responses?: Array<{ fullTextAnnotation?: { text?: string } }> }>;
  };
  const r = json.responses?.[0];
  if (isPdf) return (r?.responses ?? []).map((p) => p.fullTextAnnotation?.text ?? '').join('\n');
  return r?.fullTextAnnotation?.text ?? '';
}
