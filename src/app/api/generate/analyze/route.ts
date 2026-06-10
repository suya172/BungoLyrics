import { GoogleGenAI, Type } from "@google/genai";
import { appConfig } from "@/config/app.config";
import { NextResponse } from "next/server";

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { data } = await req.json();
    const { authorName, theme, combinedContents } = data;

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const systemPrompt = `あなたは青空文庫の作家「${authorName}」の魂を受け継いだプロの作詞家です。
ユーザーから提供された本文とテーマ「${theme}」に基づき、歌詞を作るための構想を練ります。
以下のJSONスキーマに厳密に従い、JSONのみを出力してください。他のテキストを含めないでください。

【抽出・提案する6要素】
1. background (時代背景): この歌詞が持つべき時代設定やレトロ感、風景のイメージ
2. wording (言葉遣い): 使用すべき特徴的な語彙のトーン（例：古風、漢語多用など）
3. ending (語尾): 特徴的な語尾（例：〜である、〜かしら、など）
4. catchphrase (キャッチフレーズ): 楽曲の核となる印象的な決め台詞やキャッチコピー
5. story (ストーリー): 歌詞全体の起承転結や、テーマ「${theme}」に沿った具体的なプロット
6. vocabulary (語彙リスト): 歌詞に組み込むと効果的な、文体に合ったキャッチーな単語やフレーズをカンマ区切りで5〜10個

【参考にする本文】
${combinedContents}`;

    const response = await ai.models.generateContent({
      model: appConfig.model,
      contents: [{ role: "user", parts: [{ text: "JSON形式で分析結果を出力してください。" }] }],
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            background: { type: Type.STRING },
            wording: { type: Type.STRING },
            ending: { type: Type.STRING },
            catchphrase: { type: Type.STRING },
            story: { type: Type.STRING },
            vocabulary: { type: Type.STRING },
          },
        },
      },
    });

    const jsonText = response.text || "{}";
    return NextResponse.json(JSON.parse(jsonText));
  } catch (error: any) {
    console.error("API error (analyze):", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
