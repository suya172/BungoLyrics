import { GoogleGenAI } from "@google/genai";
import { appConfig } from "@/config/app.config";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { action, text, context, authorName } = await req.json();

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    let prompt = "";
    if (action === "suggest") {
      prompt = `あなたは作家「${authorName}」の文体を熟知した編集者です。
前後の文脈: "${context}"
この文脈の中にある言葉「${text}」をもっとキャッチーで、文体に合った別の語彙やフレーズに言い換える候補を3つ提案してください。
カンマ区切りのプレーンテキストで出力してください。（例: 候補1, 候補2, 候補3）`;
    } else if (action === "explain") {
      prompt = `言葉「${text}」の正確な意味と、作家「${authorName}」の作品群においてどのようなニュアンスで使われるかを簡潔に（1〜2文で）説明してください。`;
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const response = await ai.models.generateContent({
      model: appConfig.model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    return NextResponse.json({ result: response.text || "" });
  } catch (error: any) {
    console.error("API error (assist):", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
