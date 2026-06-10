import { NextResponse } from "next/server";

const mockAuthors = [
  { id: 35, name: "太宰治" },
  { id: 148, name: "夏目漱石" },
  { id: 879, name: "芥川龍之介" },
  { id: 258, name: "宮沢賢治" },
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const nameQuery = searchParams.get("name") || "";

  // 開発用モック: 名前で部分一致検索（大文字小文字無視、簡易的）
  const results = mockAuthors.filter((author) =>
    author.name.includes(nameQuery)
  );

  return NextResponse.json(results);
}
