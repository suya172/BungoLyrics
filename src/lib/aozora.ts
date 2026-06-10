export function cleanAozoraText(rawText: string): string {
  if (!rawText) return "";
  let cleaned = rawText;
  cleaned = cleaned.replace(/《.*?》/g, ""); // ルビの削除
  cleaned = cleaned.replace(/［＃.*?］/g, ""); // 注記の削除
  cleaned = cleaned.replace(/〔.*?〕/g, "");   // 特殊符号の削除
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n"); // 連続改行の集約
  return cleaned.trim();
}

export function truncateText(text: string, maxLength: number = 50000): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength);
}
