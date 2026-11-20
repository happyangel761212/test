// 사용법: node build.mjs <esbuild 모듈 경로> → dist/autumn-forest.html (단일 파일)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const esbuild = createRequire(process.argv[2] + '/')('esbuild');
const r = await esbuild.build({ entryPoints: ['main.ts'], bundle: true, format: 'iife', minify: true, write: false, target: 'es2020' });
const js = r.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
const html = readFileSync('index.html', 'utf8').replace('<!--SCRIPT-->', `<script>${js}</script>`);
mkdirSync('dist', { recursive: true });
writeFileSync('dist/autumn-forest.html', html);
console.log('ok', html.length);
