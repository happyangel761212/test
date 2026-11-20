const { chromium } = require('playwright');
const { spawn } = require('child_process');
(async () => {
  const FPS = 30, SECS = 24, out = process.argv[2];
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  // 인자: <출력.mp4> <doctype으로 감싼 9x16 페이지 경로>
  await p.goto('file://' + require('path').resolve(process.argv[3] || 'page-9x16.html') + '?debug&capture&tau=0.64');
  await p.addStyleTag({ content: 'body{padding:0!important;display:block!important}.card{width:100vw!important;height:100vh!important;border-radius:0!important;box-shadow:none!important}' });
  await p.evaluate(() => window.__step(3)); // 시작 전 잎이 흩날리도록 예열
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(FPS), '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const events = { 60: async () => p.mouse.click(120, 150), // 하늘: 기러기 떼
    150: async () => { for (let i = 0; i <= 12; i++) await p.mouse.move(20 + i * 40, 300 + i * 4); }, // 바람
    270: async () => p.mouse.click(168, 520), // 단풍나무 흔들기
    420: async () => p.mouse.click(296, 470), // 은행나무 흔들기
    480: async () => { for (let i = 0; i <= 12; i++) await p.mouse.move(520 - i * 40, 320); } };
  for (let i = 0; i < FPS * SECS; i++) {
    if (events[i]) await events[i]();
    await p.evaluate(() => window.__step(1 / 30));
    const buf = await p.screenshot({ type: 'jpeg', quality: 93 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  console.log('errors', errs);
  await b.close();
})();
