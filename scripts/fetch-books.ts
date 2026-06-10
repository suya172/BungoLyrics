import fs from 'fs';
import path from 'path';
import * as iconv from 'iconv-lite';
import { parseAozoraHtml } from '../src/lib/aozora-parser';

const booksToFetch = [
  { id: 277, url: 'https://www.aozora.gr.jp/cards/000035/files/301_14912.html', title: '人間失格' },
  { id: 2252, url: 'https://www.aozora.gr.jp/cards/000035/files/1567_14913.html', title: '走れメロス' },
  { id: 789, url: 'https://www.aozora.gr.jp/cards/000148/files/789_14547.html', title: '吾輩は猫である' },
  { id: 73, url: 'https://www.aozora.gr.jp/cards/000879/files/127_15260.html', title: '羅生門' },
  { id: 54, url: 'https://www.aozora.gr.jp/cards/000879/files/92_14545.html', title: '蜘蛛の糸' }
];

async function main() {
  const outputDir = path.join(process.cwd(), 'src/data/mock/books');
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  for (const book of booksToFetch) {
    console.log(`Fetching [${book.id}] ${book.title}...`);
    try {
      const response = await fetch(book.url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      // 青空文庫はShift_JISなのでデコード
      const htmlUtf8 = iconv.decode(buffer, 'Shift_JIS');
      
      // パースしてテキスト抽出
      const plainText = parseAozoraHtml(htmlUtf8);
      
      const outputPath = path.join(outputDir, `${book.id}.txt`);
      fs.writeFileSync(outputPath, plainText, 'utf-8');
      
      console.log(`Saved ${book.title} to ${outputPath} (${plainText.length} characters)`);
    } catch (err) {
      console.error(`Failed to fetch or parse ${book.title}:`, err);
    }
  }
}

main();
