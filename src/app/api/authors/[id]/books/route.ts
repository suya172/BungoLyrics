import { NextResponse } from "next/server";

const mockBooks: Record<number, { id: number; title: string }[]> = {
  35: [
    { id: 2252, title: "走れメロス" },
    { id: 277, title: "人間失格" },
    { id: 2253, title: "斜陽" },
  ],
  148: [
    { id: 789, title: "吾輩は猫である" },
    { id: 794, title: "こゝろ" },
    { id: 790, title: "坊っちゃん" },
  ],
  879: [
    { id: 73, title: "羅生門" },
    { id: 54, title: "蜘蛛の糸" },
  ],
  258: [
    { id: 46101, title: "銀河鉄道の夜" },
    { id: 46102, title: "注文の多い料理店" },
  ],
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authorId = parseInt(id, 10);
  const results = mockBooks[authorId] || [];

  return NextResponse.json(results);
}
