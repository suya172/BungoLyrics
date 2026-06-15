export const appConfig = {
  // LLMモデルの設定
    model: "gemini-2.5-flash",
  
  // テキスト処理の制限設定
  textLimits: {
    // 処理する本文の最大文字数
    maxContentLength: 50000,
    // 文体分析に必要な推奨最小文字数
    minRecommendedLength: 500,
  },
};
