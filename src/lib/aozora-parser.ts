import * as cheerio from 'cheerio';

/**
 * 青空文庫のHTMLから学習用・LLM入力用のプレーンテキストを抽出・整形する
 * @param html 青空文庫のXHTMLデータ
 * @returns 整形されたプレーンテキスト
 */
export function parseAozoraHtml(html: string): string {
  // cheerioでHTMLをパース (Shift_JISの場合は呼び出し側でUTF-8にデコード済みと仮定)
  const $ = cheerio.load(html);

  // 本文部分の抽出 (青空文庫のXHTMLは多くが class="main_text" を持つ)
  const mainTextNode = $('.main_text');
  
  if (mainTextNode.length === 0) {
    // 見つからない場合は全体のbodyを使用
    return cleanHtml($.html('body'));
  }

  // <ruby> タグをルビ無しのテキスト（あるいは青空文庫記法）に変換する
  // 学習やLLMでの利用を考慮し、ここではルビの読み（<rt>）を削除し、漢字（<rb>など）のみを残す処理を行う。
  mainTextNode.find('ruby').each((_, el) => {
    // <rt> (ルビのふりがな) と <rp> (カッコ) を削除
    $(el).find('rt').remove();
    $(el).find('rp').remove();
    
    // 残ったテキスト（漢字部分）で <ruby> を置換
    const rbText = $(el).text();
    $(el).replaceWith(rbText);
  });

  // 見出しタグ、注記等の除去
  mainTextNode.find('.notes').remove(); // 注記ブロック
  mainTextNode.find('h1, h2, h3, h4, h5, h6').remove(); // 本文の途中にある章見出しなどを残すか削除するかは用途によるが、学習用なら改行のみにするのが無難

  // テキスト抽出（cheerioの.text()は改行を無視することがあるため、<br>などを改行に置換）
  mainTextNode.find('br').replaceWith('\\n');
  mainTextNode.find('div, p').each((_, el) => {
    $(el).prepend('\\n');
  });

  let rawText = mainTextNode.text();

  // 整形：複数の改行をまとめる、余分な空白を削除
  rawText = rawText.replace(/\\n/g, '\n');
  rawText = rawText.replace(/\n{3,}/g, '\n\n'); // 3つ以上の連続する改行を2つに
  rawText = rawText.trim();

  // 青空文庫特有の注記文字（［＃〜］）の除去
  rawText = rawText.replace(/［＃.*?］/g, '');

  return rawText;
}

function cleanHtml(html: string): string {
  // フォールバック用の簡易クリーニング
  const $ = cheerio.load(html);
  $('rt, rp, .notes, script, style').remove();
  let text = $('body').text();
  return text.replace(/\n{3,}/g, '\n\n').trim();
}
