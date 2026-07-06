import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({ html: false, linkify: true });

// MDX 專屬語法（import 行、JSX 元件標籤）在純 markdown 輸出裡沒有意義，先剝掉
export function stripMdx(body: string): string {
  return body
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      if (/^import\s.+from\s+['"].+['"];?$/.test(trimmed)) return false;
      if (/^<[A-Z][\w.]*[^>]*\/?>$/.test(trimmed)) return false;
      if (/^<\/[A-Z][\w.]*>$/.test(trimmed)) return false;
      return true;
    })
    .join('\n');
}

export function renderMarkdown(body: string): string {
  return md.render(stripMdx(body));
}
