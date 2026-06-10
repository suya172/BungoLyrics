import { GoogleGenAI } from "@google/genai";
import { appConfig } from "@/config/app.config";

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { data } = await req.json();
    const { authorName, theme, combinedContents, elements } = data;

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const systemPrompt = `あなたは青空文庫の作家「${authorName}」の魂を受け継いだプロの作詞家です。
以下の指定された作品の本文を深く分析しつつ、ユーザーが確定した【5つの構想要素】に厳密に従って、テーマ「${theme}」のJ-POP/歌謡曲の歌詞をフルコーラスで生成してください。

【ユーザーが確定した構想要素】
・時代背景: ${elements.background}
・言葉遣い: ${elements.wording}
・語尾: ${elements.ending}
・キャッチフレーズ: ${elements.catchphrase}
・ストーリー: ${elements.story}
・語彙リスト: ${elements.vocabulary}

【参考にする本文】
${combinedContents}

【指示】
1. Aメロ、Bメロ、サビ、などのセクション構成を明確にMarkdownで記載すること。
2. 指定された「ストーリー」に沿って展開を作ること。
3. 指定された「語彙リスト」や「キャッチフレーズ」を効果的に散りばめ、随所で**韻を踏む（Rhyme）**こと。
4. 同じ語彙や言い回しを各セクションで使い回しすぎず、多様で豊かな表現を用いること。
5. 一切の絵文字（emoji）を使用しないこと。解説などは不要で、純粋な歌詞のみを出力すること。`;

    const responseStream = await ai.models.generateContentStream({
      model: appConfig.model,
      contents: [{ role: "user", parts: [{ text: "歌詞を生成してください。" }] }],
      config: {
        systemInstruction: systemPrompt,
      },
    });

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of responseStream) {
            if (chunk.text) {
              controller.enqueue(new TextEncoder().encode(chunk.text));
            }
          }
        } catch (e) {
          controller.error(e);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("API error (lyrics):", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
