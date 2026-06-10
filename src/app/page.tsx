"use client";

import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { Search, BookOpen, PenTool, Copy, RefreshCw, Loader2, Sparkles, Feather, User, Menu, HelpCircle, ArrowRight, Download, Share2, Edit3, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import { cleanAozoraText, truncateText } from "@/lib/aozora";
import { appConfig } from "@/config/app.config";
import * as htmlToImage from 'html-to-image';

type Author = { id: number; name: string };
type Book = { id: number; title: string };
type BookContent = { id: number; title: string; content: string };
type Elements = {
  background: string;
  wording: string;
  ending: string;
  catchphrase: string;
  story: string;
  vocabulary: string;
};

export default function Home() {
  const [step, setStep] = useState<number>(0);
  
  // Step 0: Selection
  const [searchQuery, setSearchQuery] = useState("");
  const [authors, setAuthors] = useState<Author[]>([]);
  const [selectedAuthor, setSelectedAuthor] = useState<Author | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBookIds, setSelectedBookIds] = useState<Set<number>>(new Set());
  const [bookContents, setBookContents] = useState<Record<number, string>>({});
  const [theme, setTheme] = useState("");
  
  // Step 1: Analysis & Proposal
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [elements, setElements] = useState<Elements>({
    background: "", wording: "", ending: "", catchphrase: "", story: "", vocabulary: ""
  });

  // Step 2 & 3: Generation & Editing
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedLyrics, setGeneratedLyrics] = useState("");
  
  // Inline Assist (Step 3)
  const [selectedText, setSelectedText] = useState("");
  const [menuPosition, setMenuPosition] = useState<{ x: number, y: number } | null>(null);
  const [assistResult, setAssistResult] = useState("");
  const [isAssisting, setIsAssisting] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  // === Handlers for Step 0 ===
  const searchAuthors = async () => {
    if (!searchQuery.trim()) return;
    try {
      const res = await fetch(`/api/authors?name=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setAuthors(data);
    } catch {
      toast.error("作家の検索に失敗しました");
    }
  };

  const selectAuthor = async (author: Author) => {
    setSelectedAuthor(author);
    setBooks([]);
    setSelectedBookIds(new Set());
    setBookContents({});
    try {
      const res = await fetch(`/api/authors/${author.id}/books`);
      const data = await res.json();
      setBooks(data);
    } catch {
      toast.error("作品の取得に失敗しました");
    }
  };

  const toggleBook = async (bookId: number) => {
    const newSet = new Set(selectedBookIds);
    if (newSet.has(bookId)) {
      newSet.delete(bookId);
      setSelectedBookIds(newSet);
    } else {
      newSet.add(bookId);
      setSelectedBookIds(newSet);
      if (!bookContents[bookId]) {
        try {
          const res = await fetch(`/api/books/${bookId}/content`);
          const data: BookContent = await res.json();
          setBookContents((prev) => ({ ...prev, [bookId]: cleanAozoraText(data.content) }));
        } catch {
          toast.error("本文の取得に失敗しました");
        }
      }
    }
  };

  const startAnalysis = async () => {
    if (!selectedAuthor || selectedBookIds.size === 0 || !theme.trim()) {
      toast.error("作家、作品、テーマのすべてを指定してください");
      return;
    }
    setStep(1);
    setIsAnalyzing(true);
    setElements({ background: "", wording: "", ending: "", catchphrase: "", story: "", vocabulary: "" });

    let combinedContents = "";
    for (const id of Array.from(selectedBookIds)) {
      combinedContents += `\n【作品名】: ${books.find(b => b.id === id)?.title}\n${bookContents[id] || ""}\n`;
    }

    try {
      const res = await fetch("/api/generate/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            authorName: selectedAuthor.name,
            theme,
            combinedContents: truncateText(combinedContents, appConfig.textLimits.maxContentLength)
          }
        }),
      });
      
      if (!res.ok) {
        throw new Error(`APIエラー: ${res.status} ${res.statusText}`);
      }
      
      const data = await res.json();
      if (!data || Object.keys(data).length === 0) {
        throw new Error("AIから有効な提案が返されませんでした");
      }
      
      setElements({
        background: data.background || "",
        wording: data.wording || "",
        ending: data.ending || "",
        catchphrase: data.catchphrase || "",
        story: data.story || "",
        vocabulary: data.vocabulary || ""
      });
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "分析に失敗しました。再試行してください。");
      // エラーになってもStep1に留まり、再試行ボタンを押せるようにする
    } finally {
      setIsAnalyzing(false);
    }
  };

  // === Handlers for Step 1 -> 2 ===
  const startGeneration = async () => {
    setStep(2);
    setIsGenerating(true);
    setGeneratedLyrics("");

    let combinedContents = "";
    for (const id of Array.from(selectedBookIds)) {
      combinedContents += `\n【作品名】: ${books.find(b => b.id === id)?.title}\n${bookContents[id] || ""}\n`;
    }

    try {
      const res = await fetch("/api/generate/lyrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            authorName: selectedAuthor?.name,
            theme,
            combinedContents: truncateText(combinedContents, appConfig.textLimits.maxContentLength),
            elements
          }
        }),
      });

      if (!res.body) throw new Error("Stream error");
      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      
      let done = false;
      let fullText = "";
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunkStr = decoder.decode(value, { stream: true });
          fullText += chunkStr;
          setGeneratedLyrics(fullText);
        }
      }
    } catch (e: any) {
      toast.error(e.message || "生成に失敗しました");
      setStep(1);
    } finally {
      setIsGenerating(false);
    }
  };

  // === Handlers for Step 3 (Editor) ===
  const handleTextSelection = () => {
    const textarea = editorRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value.substring(start, end).trim();
    
    if (text.length > 0 && text.length < 50) {
      setSelectedText(text);
      // Create a fake coordinate just near the selection or fixed top
      // (Actual caret coordinates in textarea are complex, using fixed header approach for simplicity)
      setMenuPosition({ x: 0, y: 0 }); // We will display it as a sticky toolbar or floating above
      setAssistResult("");
    } else {
      setSelectedText("");
      setMenuPosition(null);
    }
  };

  const callAssist = async (action: "suggest" | "explain") => {
    if (!selectedText) return;
    setIsAssisting(true);
    setAssistResult("");
    try {
      // Get some context around the selection
      const textarea = editorRef.current;
      const ctxStart = Math.max(0, (textarea?.selectionStart || 0) - 30);
      const ctxEnd = Math.min(textarea?.value.length || 0, (textarea?.selectionEnd || 0) + 30);
      const context = textarea?.value.substring(ctxStart, ctxEnd) || "";

      const res = await fetch("/api/generate/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          text: selectedText,
          context,
          authorName: selectedAuthor?.name
        }),
      });
      const data = await res.json();
      setAssistResult(data.result);
    } catch (e) {
      toast.error("アシスト機能のエラー");
    } finally {
      setIsAssisting(false);
    }
  };

  const applySuggestion = (suggestion: string) => {
    if (!editorRef.current) return;
    const start = editorRef.current.selectionStart;
    const end = editorRef.current.selectionEnd;
    const current = generatedLyrics;
    const newText = current.substring(0, start) + suggestion + current.substring(end);
    setGeneratedLyrics(newText);
    setSelectedText("");
    setMenuPosition(null);
  };

  // === Handlers for Step 4 (Export) ===
  const downloadImage = async () => {
    if (!exportRef.current) return;
    try {
      const dataUrl = await htmlToImage.toPng(exportRef.current, { quality: 0.95 });
      const link = document.createElement('a');
      link.download = `BungoLyrics-${theme}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      toast.error("画像の保存に失敗しました");
    }
  };

  const copyToClipboard = (raw: boolean) => {
    let text = generatedLyrics;
    if (raw) {
      text = text.replace(/\n+/g, ' '); // 改行を空白に変換
    }
    navigator.clipboard.writeText(text);
    toast.success("コピーしました");
  };

  const shareAction = () => {
    if (navigator.share) {
      navigator.share({
        title: `${selectedAuthor?.name}風 歌詞『${theme}』`,
        text: generatedLyrics,
      }).catch(console.error);
    } else {
      toast.info("お使いのブラウザは共有機能に対応していません");
    }
  };


  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex overflow-hidden relative">
      {/* AIモデル表示バッジ */}
      <div className="fixed top-4 right-6 z-50 flex items-center gap-1.5 bg-card/80 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-border/60 text-xs font-medium text-muted-foreground shadow-sm">
        <Sparkles className="w-3.5 h-3.5 text-primary" />
        <span className="font-mono">{appConfig.model}</span>
      </div>

      {/* 左サイドバー */}
      <aside className="w-24 md:w-32 flex-shrink-0 flex flex-col items-center py-12 border-r border-border/50 bg-background/50 backdrop-blur-sm z-10 hidden sm:flex">
        <div 
          className="flex-1 font-bold text-3xl md:text-4xl text-primary tracking-widest cursor-pointer"
          style={{ writingMode: 'vertical-rl', textOrientation: 'upright' }}
          onClick={() => setStep(0)}
        >
          Bungo Lyrics
        </div>
        <div className="flex flex-col gap-6 mt-12 text-secondary-foreground/60">
          <Button variant="ghost" size="icon" className="rounded-full hover:bg-secondary/50 hover:text-primary transition-colors">
            <User className="w-6 h-6" />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full hover:bg-secondary/50 hover:text-primary transition-colors">
            <Menu className="w-6 h-6" />
          </Button>
        </div>
      </aside>

      {/* メインエリア */}
      <main className="flex-1 overflow-y-auto p-6 md:p-12 pb-32">
        <div className="max-w-4xl mx-auto space-y-12">
          
          <header className="sm:hidden text-center mb-8">
            <h1 className="text-3xl font-bold text-primary tracking-widest cursor-pointer" onClick={() => setStep(0)}>
              Bungo Lyrics
            </h1>
          </header>

          {/* ウィザード進捗表示 */}
          {step > 0 && (
            <div className="flex items-center justify-center space-x-2 text-sm font-bold text-muted-foreground mb-8">
              <span className={step >= 1 ? "text-primary" : ""}>1. 構想</span>
              <span>—</span>
              <span className={step >= 2 ? "text-primary" : ""}>2. 生成</span>
              <span>—</span>
              <span className={step >= 3 ? "text-primary" : ""}>3. 推敲</span>
              <span>—</span>
              <span className={step >= 4 ? "text-primary" : ""}>4. 完了</span>
            </div>
          )}

          {/* === STEP 0: 初期設定 === */}
          {step === 0 && (
            <div className="space-y-8 animate-in fade-in duration-700">
              <section className="space-y-4">
                <h2 className="text-xl font-bold flex items-center gap-2 text-primary/80 ml-2">
                  <Search className="w-5 h-5" /> 作家を選ぶ
                </h2>
                <div className="flex flex-col gap-4 bg-card/60 p-6 rounded-[2rem] border border-border/50 shadow-sm">
                  <div className="flex gap-4">
                    <Input
                      placeholder="作家名 (例: 太宰治)"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="rounded-full bg-background border-border focus-visible:ring-primary h-12 px-6 text-lg"
                      onKeyDown={(e) => e.key === 'Enter' && searchAuthors()}
                    />
                    <Button onClick={searchAuthors} className="rounded-full h-12 px-8 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm">
                      検索
                    </Button>
                  </div>
                  {authors.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {authors.map((author) => (
                        <Button
                          key={author.id}
                          variant={selectedAuthor?.id === author.id ? "default" : "outline"}
                          onClick={() => selectAuthor(author)}
                          className={`rounded-full px-6 transition-all ${
                            selectedAuthor?.id === author.id ? "bg-secondary text-secondary-foreground font-bold shadow-sm border-transparent" : "border-border/60 bg-background hover:bg-card"
                          }`}
                        >
                          {author.name}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {selectedAuthor && books.length > 0 && (
                <section className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <h2 className="text-xl font-bold flex items-center gap-2 text-primary/80 ml-2">
                    <BookOpen className="w-5 h-5" /> 作品を選ぶ
                  </h2>
                  <div className="grid gap-4 md:grid-cols-2">
                    {books.map((book) => (
                      <Card key={book.id} className={`rounded-[1.5rem] bg-card/60 border-border/50 shadow-sm transition-all ${selectedBookIds.has(book.id) ? 'ring-2 ring-primary border-transparent bg-secondary/10' : ''}`}>
                        <CardHeader className="flex flex-row items-start space-y-0 pb-2 gap-4">
                          <Checkbox
                            checked={selectedBookIds.has(book.id)}
                            onCheckedChange={() => toggleBook(book.id)}
                            className="mt-1 border-primary/40 data-[state=checked]:bg-primary rounded-md"
                          />
                          <CardTitle className="text-base text-foreground/90 leading-tight cursor-pointer" onClick={() => toggleBook(book.id)}>
                            {book.title}
                          </CardTitle>
                        </CardHeader>
                        {selectedBookIds.has(book.id) && bookContents[book.id] && (
                          <CardContent className="pt-2 animate-in fade-in">
                            <details className="w-full group">
                              <summary className="text-xs text-muted-foreground py-2 cursor-pointer list-none flex items-center outline-none">
                                <span className="mr-2 opacity-50 group-open:rotate-90 transition-transform">▶</span>
                                プレビュー
                              </summary>
                              <div className="text-foreground/70 text-sm leading-relaxed bg-background p-4 rounded-2xl border border-border/50 mt-2">
                                {bookContents[book.id].substring(0, 150)}...
                              </div>
                            </details>
                          </CardContent>
                        )}
                      </Card>
                    ))}
                  </div>
                </section>
              )}

              {selectedBookIds.size > 0 && (
                <section className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <h2 className="text-xl font-bold flex items-center gap-2 text-primary/80 ml-2">
                    <PenTool className="w-5 h-5" /> テーマを入力
                  </h2>
                  <div className="bg-card/60 p-8 rounded-[2.5rem] border border-border/50 shadow-sm space-y-8 relative">
                    <div className="space-y-3">
                      <label className="text-sm font-bold text-primary/80 ml-6">作詞テーマ</label>
                      <Input
                        placeholder="例: 都会の孤独、終わらない夏..."
                        value={theme}
                        onChange={(e) => setTheme(e.target.value)}
                        className="rounded-full bg-background border-border/50 focus-visible:ring-primary h-16 px-8 text-lg shadow-inner"
                      />
                    </div>
                    <div className="flex justify-center pt-4">
                      <Button
                        size="lg"
                        className="rounded-full h-14 px-12 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-all active:scale-95"
                        onClick={startAnalysis}
                        disabled={!theme || isAnalyzing}
                      >
                        {isAnalyzing ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> 構想を練っています...</> : <span className="flex items-center text-lg font-bold">次へ進む (構想の分析) <ArrowRight className="w-5 h-5 ml-2" /></span>}
                      </Button>
                    </div>
                  </div>
                </section>
              )}
            </div>
          )}

          {/* === STEP 1: 分析・要素編集 === */}
          {step === 1 && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-primary/90 flex items-center gap-2">
                  <Sparkles className="w-6 h-6" /> 作詞の構想を練る
                </h2>
                <Button variant="outline" size="sm" onClick={startAnalysis} disabled={isAnalyzing} className="rounded-full text-xs h-9">
                  {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  AIに再分析させる
                </Button>
              </div>
              <p className="text-muted-foreground ml-2">
                AIが作品を分析し、今回のテーマに合わせた要素を提案しました。自由に編集してください。
              </p>

              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  { key: 'background', label: '時代背景', desc: '歌詞の舞台となる時代や風景' },
                  { key: 'wording', label: '言葉遣い', desc: '文体のトーン（古風、漢語など）' },
                  { key: 'ending', label: '語尾', desc: '特徴的な語尾（〜である、〜かしら等）' },
                  { key: 'catchphrase', label: 'キャッチフレーズ', desc: '楽曲の核となる決め台詞' },
                  { key: 'story', label: 'ストーリー', desc: '起承転結や伝えたいメッセージ' },
                  { key: 'vocabulary', label: '語彙リスト', desc: '使いたい印象的なフレーズや単語' }
                ].map((item) => (
                  <Card key={item.key} className="rounded-[2rem] border-border/50 bg-card/60 shadow-sm overflow-hidden">
                    <CardHeader className="bg-background/40 pb-4 border-b border-border/30">
                      <CardTitle className="text-lg text-primary">{item.label}</CardTitle>
                      <CardDescription>{item.desc}</CardDescription>
                    </CardHeader>
                    <CardContent className="p-4">
                      <Textarea 
                        value={(elements as any)[item.key]}
                        onChange={(e) => setElements({...elements, [item.key]: e.target.value})}
                        className="min-h-[100px] bg-background border-border/50 rounded-xl resize-none text-foreground/80 leading-relaxed"
                      />
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex justify-center gap-4 pt-8">
                <Button variant="outline" onClick={() => setStep(0)} className="rounded-full h-14 px-8 border-border text-foreground/70">
                  戻る
                </Button>
                <Button onClick={startGeneration} disabled={isGenerating} className="rounded-full h-14 px-12 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md">
                  {isGenerating ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <span className="flex items-center text-lg font-bold">構想を確定し、歌詞を生成する <Feather className="w-5 h-5 ml-2" /></span>}
                </Button>
              </div>
            </div>
          )}

          {/* === STEP 2: 歌詞生成 === */}
          {step === 2 && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <h2 className="text-2xl font-bold text-primary/90">生成結果</h2>
              
              <Card className="rounded-[2.5rem] border-border/50 bg-secondary/30 shadow-md">
                <CardContent className="p-8 md:p-12">
                  {isGenerating ? (
                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground space-y-4">
                      <Loader2 className="w-10 h-10 animate-spin text-primary/50" />
                      <p>AIが韻を踏みながら歌詞を紡いでいます...</p>
                    </div>
                  ) : (
                    <div className="prose prose-slate max-w-none text-foreground/90 leading-loose text-lg whitespace-pre-wrap">
                      <ReactMarkdown>{generatedLyrics}</ReactMarkdown>
                    </div>
                  )}
                </CardContent>
              </Card>

              {!isGenerating && (
                <div className="flex justify-center gap-4 pt-4">
                  <Button variant="outline" onClick={() => setStep(1)} className="rounded-full h-14 px-8 border-border text-foreground/70">
                    <RefreshCw className="w-5 h-5 mr-2" /> 構想からやり直す
                  </Button>
                  <Button onClick={() => setStep(3)} className="rounded-full h-14 px-12 bg-primary text-primary-foreground shadow-md">
                    <Edit3 className="w-5 h-5 mr-2" /> 歌詞を推敲する (エディタへ)
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* === STEP 3: 推敲 (インラインエディタ) === */}
          {step === 3 && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div className="flex justify-between items-end">
                <div>
                  <h2 className="text-2xl font-bold text-primary/90 flex items-center gap-2">
                    <Edit3 className="w-6 h-6" /> 歌詞の推敲
                  </h2>
                  <p className="text-muted-foreground mt-2">
                    テキストを直接編集できます。単語を選択するとAIが言い換えを提案します。
                  </p>
                </div>
              </div>

              {/* インラインアシストのフローティングメニュー風の固定ヘッダー */}
              {selectedText && (
                <div className="sticky top-4 z-50 bg-popover text-popover-foreground p-3 rounded-2xl shadow-xl border border-border/50 animate-in slide-in-from-top-4 flex flex-col gap-3 max-w-2xl mx-auto">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-primary bg-primary/10 px-3 py-1 rounded-full text-sm">
                      「{selectedText}」
                    </span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => callAssist('suggest')} disabled={isAssisting} className="rounded-full text-xs">
                        {isAssisting ? <Loader2 className="w-3 h-3 animate-spin mr-1"/> : <Sparkles className="w-3 h-3 mr-1" />} 他の語彙を提案
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => callAssist('explain')} disabled={isAssisting} className="rounded-full text-xs">
                        {isAssisting ? <Loader2 className="w-3 h-3 animate-spin mr-1"/> : <HelpCircle className="w-3 h-3 mr-1" />} 意味を調べる
                      </Button>
                    </div>
                  </div>
                  
                  {assistResult && (
                    <div className="bg-background/50 p-3 rounded-xl text-sm leading-relaxed border border-border/30">
                      {assistResult.includes(',') ? (
                        <div className="flex flex-wrap gap-2">
                          <span className="text-muted-foreground text-xs w-full mb-1">クリックして置き換え:</span>
                          {assistResult.split(',').map((word, i) => (
                            <Button key={i} variant="outline" size="sm" onClick={() => applySuggestion(word.trim())} className="rounded-full bg-background hover:bg-secondary">
                              {word.trim()}
                            </Button>
                          ))}
                        </div>
                      ) : (
                        <p>{assistResult}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <Card className="rounded-[2.5rem] border-border/50 bg-card shadow-sm overflow-hidden">
                <Textarea
                  ref={editorRef}
                  value={generatedLyrics}
                  onChange={(e) => setGeneratedLyrics(e.target.value)}
                  onSelect={handleTextSelection}
                  onMouseUp={handleTextSelection}
                  onKeyUp={handleTextSelection}
                  className="min-h-[500px] w-full p-8 md:p-12 text-lg leading-loose border-0 focus-visible:ring-0 bg-transparent resize-y"
                  placeholder="ここに歌詞が表示されます..."
                />
              </Card>

              <div className="flex justify-center gap-4 pt-4">
                <Button variant="outline" onClick={() => setStep(1)} className="rounded-full h-14 px-8 border-border text-foreground/70">
                  構想からやり直す
                </Button>
                <Button onClick={() => setStep(4)} className="rounded-full h-14 px-12 bg-primary text-primary-foreground shadow-md">
                  <CheckCircle2 className="w-5 h-5 mr-2" /> 歌詞を完成させる
                </Button>
              </div>
            </div>
          )}

          {/* === STEP 4: プレビュー・エクスポート === */}
          {step === 4 && (
            <div className="space-y-8 animate-in zoom-in-95 duration-500">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8">
                <h2 className="text-3xl font-bold text-primary/90 tracking-wider">完成した歌詞</h2>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => copyToClipboard(false)} className="rounded-full">
                    <Copy className="w-4 h-4 mr-2" /> Copy
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => copyToClipboard(true)} className="rounded-full">
                    <Copy className="w-4 h-4 mr-2" /> Raw Copy
                  </Button>
                  <Button variant="outline" size="sm" onClick={shareAction} className="rounded-full">
                    <Share2 className="w-4 h-4 mr-2" /> Share
                  </Button>
                  <Button onClick={downloadImage} className="rounded-full bg-primary text-primary-foreground shadow-sm">
                    <Download className="w-4 h-4 mr-2" /> Save Image
                  </Button>
                </div>
              </div>

              {/* 画像書き出し用コンテナ */}
              <div className="flex justify-center">
                <div 
                  ref={exportRef}
                  className="bg-white p-12 md:p-16 rounded-[3rem] shadow-2xl max-w-3xl w-full border-4 border-black/10 relative overflow-hidden font-serif"
                >
                  <div className="absolute top-0 right-0 p-8 opacity-10">
                    <Feather className="w-32 h-32 text-black" />
                  </div>
                  <h3 className="text-3xl font-bold text-black mb-2">{theme}</h3>
                  <p className="text-black/50 mb-10 font-medium font-sans">Bungo Lyrics × {selectedAuthor?.name}</p>
                  
                  <div className="prose prose-slate max-w-none text-black leading-loose text-lg md:text-xl font-medium whitespace-pre-wrap">
                    <ReactMarkdown>{generatedLyrics}</ReactMarkdown>
                  </div>
                </div>
              </div>

              <div className="flex justify-center pt-12">
                <Button variant="ghost" onClick={() => setStep(0)} className="rounded-full text-foreground/50 hover:text-primary">
                  新しく作り直す
                </Button>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
