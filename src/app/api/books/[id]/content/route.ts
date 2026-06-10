import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const bookId = parseInt(id, 10);
  
  // モックファイルのパス
  const filePath = path.join(process.cwd(), "src/data/mock/books", `${bookId}.txt`);
  
  let content = `これはダミーの本文データです。《るび》や［＃注記］が含まれる場合があります。\n\nテスト用の文章です。`;
  let title = "ダミータイトル";

  try {
    if (fs.existsSync(filePath)) {
      content = fs.readFileSync(filePath, "utf-8");
      // タイトルは仮で設定（将来的にメタデータが必要ならDB等から引く）
      if (bookId === 277) title = "人間失格";
      else if (bookId === 2252) title = "走れメロス";
      else if (bookId === 789) title = "吾輩は猫である";
    }
  } catch (e) {
    console.error("Failed to read mock file:", e);
  }
  
  return NextResponse.json({
    id: bookId,
    title: title,
    content: content,
  });
}
