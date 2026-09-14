// Place this file at: app/api/translate-caption/route.ts
//
// Server-side translation endpoint. The client (app/page.tsx) calls this
// same-origin route with { text, language } and expects { translatedText }
// back — matching the working shape from the earlier version of this app.
//
// Requires OPENAI_API_KEY to be set in your environment (Vercel project
// settings, or .env.local for local dev). The key never reaches the browser
// — this file only runs on the server.

import { NextRequest, NextResponse } from 'next/server';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-3.5-turbo';

function normalizeLanguageName(language: string): string {
  const l = String(language || 'English').toLowerCase();
  if (['bn', 'bd', 'bangla', 'bengali'].includes(l)) return 'Bengali';
  if (['de', 'ger', 'german', 'deutsch'].includes(l)) return 'German';
  return 'English';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const text = String(body?.text || '').trim();
    const targetLanguage = normalizeLanguageName(body?.language);

    if (!text) {
      return NextResponse.json({ translatedText: '' });
    }

    // English source requested as English — nothing to translate.
    if (targetLanguage === 'English') {
      return NextResponse.json({ translatedText: text });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY is not configured on the server.' },
        { status: 500 }
      );
    }

    const systemPrompt = `You are a professional social media translator. Your task is to translate captions naturally and fluently into the target language while preserving the exact meaning, context, intent, tone, emotion, and overall message of the original text.

Do NOT translate word-by-word or sentence-by-sentence mechanically. Instead, understand the complete meaning of each sentence and express it in the most natural and engaging way that a native speaker of the target language would normally say it.

Important rules:
- Preserve the original meaning, context, intent, tone, emotion, emphasis, and level of formality.
- Do not add, remove, exaggerate, or change any information.
- Do not make the translation sound like a literal or machine translation.
- Use natural sentence structure and vocabulary appropriate for native speakers of the target language.
- When translating English to Bengali, use natural, fluent, conversational Bengali.
- When translating to German, use natural and grammatically correct German that sounds like it was originally written by a native German speaker.
- Do not forcefully translate English words that are commonly used in Bengali or German, especially technical, professional, business, AI, software, digital, and social media terms. Keep them in English when that sounds more natural or recognizable.
- Preserve names, brand names, product names, company names, URLs, @mentions, numbers, and other proper nouns unless they clearly require translation.
- IMPORTANT: When the target language is Bengali, NEVER translate hashtags. Keep ALL hashtags exactly as they appear in the original text, including the # symbol, spelling, capitalization, and wording.
- When the target language is German, hashtags may be translated naturally when appropriate, but brand names, campaign names, and commonly recognized hashtags should remain unchanged.
- Preserve emojis, paragraph breaks, line breaks, and overall formatting.
- The final translation should feel natural, polished, and engaging for a native speaker while remaining faithful to the original message.
- Never change the original message's meaning just to make the translation sound more creative.
- Naturalization is allowed, but semantic accuracy always comes first.`;

const userPrompt = `Translate the following social media post caption into ${targetLanguage}.

Understand the full context first, then produce a natural, fluent translation. Do not translate word-by-word. The translated version should sound like a native speaker naturally wrote it while preserving the exact meaning, intent, tone, emotion, and information of the original.

If the target language is Bengali, keep EVERY hashtag in English exactly as written in the original caption. Do not translate, transliterate, modify, or rewrite any hashtag.

Reply with ONLY the translated text. Do not include any preamble, explanation, notes, quotation marks, or comments.

Caption:
${text}`;
    const res = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 2048,
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return NextResponse.json({ error: `OpenAI API error: ${errText}` }, { status: 502 });
    }

    const data = await res.json();
    const translatedText = data?.choices?.[0]?.message?.content?.trim() || '';

    return NextResponse.json({ translatedText: translatedText || text });
  } catch {
    return NextResponse.json({ error: 'Translation failed.' }, { status: 500 });
  }
}