// 사용법: node build.mjs <esbuild가 설치된 폴더>
// → dist/autumn-forest.html (가로 2:1), dist/autumn-forest-9x16.html (세로 9:16)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const esbuild = createRequire(process.argv[2] + '/')('esbuild');
const shell = readFileSync('index.html', 'utf8');
mkdirSync('dist', { recursive: true });
for (const portrait of [false, true]) {
  const r = await esbuild.build({ entryPoints: ['main.ts'], bundle: true, format: 'iife', minify: true, write: false, target: 'es2020', define: { __PORTRAIT__: String(portrait) } });
  const js = r.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
  let html = shell;
  if (portrait) {
    html = html
      .replace('<title>단풍과 은행나무 숲</title>', '<title>단풍과 은행나무 숲 9:16</title>')
      .replace('width:min(100%,calc((100vh - 48px) * 2));aspect-ratio:2/1;', 'width:min(100%,calc((100vh - 32px) * 9 / 16));aspect-ratio:9/16;')
      .replace('font:500 clamp(10px,1.25vw,15px)/1.3', 'font:500 clamp(11px,min(3vw,1.7vh),22px)/1.3')
      .replace('font:clamp(9px,1.1vw,13px)/1.4', 'font:clamp(10px,min(2.4vw,1.35vh),16px)/1.5')
      .replace('left:0;right:0;bottom:2.6%;', 'left:6%;right:6%;bottom:2.4%;');
  }
  html = html.replace('<!--SCRIPT-->', `<script>${js}</script>`);
  const out = portrait ? 'dist/autumn-forest-9x16.html' : 'dist/autumn-forest.html';
  writeFileSync(out, html);
  console.log(out, html.length);
}
