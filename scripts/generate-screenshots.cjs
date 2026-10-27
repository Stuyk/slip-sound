// Regenerates README screenshots (screenshots/*.png) and the landing page hero
// (docs/screenshots/screenshot-01.png) by driving the built app.
//
//   npm run build
//   npx electron scripts/generate-screenshots.cjs
//
// Uses a throwaway userData folder so your real prefs/recent list are untouched.
// Library defaults to the author's sample folder; override with SLIP_SCREENSHOT_LIBRARY.
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

process.env.NODE_ENV = 'production';

const rootDir = path.resolve(__dirname, '..');
const screenshotsDir = path.join(rootDir, 'screenshots');
const docsShotsDir = path.join(rootDir, 'docs/screenshots');
const library = process.env.SLIP_SCREENSHOT_LIBRARY || '/media/stuyk/Side2/sounds';
const WIDTH = 1543;
const HEIGHT = 871;

fs.mkdirSync(screenshotsDir, { recursive: true });
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'slip-sound-shots-')));

require('../out/main/index.js');

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

app.on('browser-window-created', (_, win) => {
  win.setContentSize(WIDTH, HEIGHT);
  win.webContents.once('did-finish-load', async () => {
    const js = (code) => win.webContents.executeJavaScript(code);
    const capture = async (...files) => {
      // Paused, so the play button and playhead look the same every run.
      await js(`document.querySelector('#waveform-audio-element')?.pause()`);
      await delay(150);
      const png = (await win.webContents.capturePage()).toPNG();
      for (const file of files) {
        fs.writeFileSync(file, png);
        console.log('Captured', path.relative(rootDir, file));
      }
    };
    // Captures just one element (plus a small margin), e.g. a tool dialog for the landing page.
    const captureElement = async (selector, file) => {
      const r = await js(`(() => {
        const b = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
        return { x: b.x, y: b.y, width: b.width, height: b.height };
      })()`);
      const m = 12;
      const x = Math.max(0, Math.floor(r.x - m));
      const y = Math.max(0, Math.floor(r.y - m));
      const rect = {
        x,
        y,
        width: Math.min(WIDTH - x, Math.ceil(r.width + m * 2)),
        height: Math.min(HEIGHT - y, Math.ceil(r.height + m * 2))
      };
      fs.writeFileSync(file, (await win.webContents.capturePage(rect)).toPNG());
      console.log('Captured', path.relative(rootDir, file), `${rect.width}x${rect.height}`);
    };
    const key = (k, mods = {}) =>
      js(`(() => {
        document.activeElement?.blur();
        window.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(k)}, code: ${JSON.stringify(
          k === ' ' ? 'Space' : ''
        )}, bubbles: true, ...${JSON.stringify(mods)} }));
      })()`);
    const search = async (query) => {
      await js(`(() => {
        const input = document.querySelector('#menubar-search-input');
        const el = input?.tagName === 'INPUT' ? input : input?.querySelector('input');
        el.value = ${JSON.stringify(query)};
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.blur();
      })()`);
      await delay(1200);
      await scrollListTop();
    };
    const scrollListTop = () =>
      js(`document.querySelector('[data-idx]')?.closest('.overflow-y-auto')?.scrollTo(0, 0)`);
    // Clicks the first row whose text matches `pattern` and (optionally) whose duration is in range.
    const clickRow = async (pattern, minSec = 0, maxSec = Infinity, mods = {}) => {
      const found = await js(`(() => {
        const re = new RegExp(${JSON.stringify(pattern)}, 'i');
        const row = [...document.querySelectorAll('[data-idx]')].find((r) => {
          const d = parseFloat((r.textContent.match(/(\\d+\\.\\d+)s/) || [])[1] || 'NaN');
          return re.test(r.textContent) && d >= ${minSec} && d <= ${maxSec === Infinity ? 'Infinity' : maxSec};
        });
        if (!row) return null;
        row.scrollIntoView({ block: 'nearest' });
        row.dispatchEvent(new MouseEvent('click', { bubbles: true, ...${JSON.stringify(mods)} }));
        return row.textContent.slice(0, 80);
      })()`);
      if (!found) throw new Error(`No row matching ${pattern}`);
      await delay(900);
      return found;
    };
    const clickRowIndex = (i, mods = {}) =>
      js(`document.querySelector('[data-idx="${i}"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true, ...${JSON.stringify(
        mods
      )} }))`);
    // Drags a region across the main waveform, as fractions of its width.
    const dragWaveform = (from, to) =>
      js(`(() => {
        const el = document.querySelector('#waveform-canvas-container');
        const r = el.getBoundingClientRect();
        const y = r.top + r.height / 2;
        el.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: r.left + r.width * ${from}, clientY: y, bubbles: true }));
        window.dispatchEvent(new MouseEvent('mousemove', { clientX: r.left + r.width * ${to}, clientY: y }));
        window.dispatchEvent(new MouseEvent('mouseup', { clientX: r.left + r.width * ${to}, clientY: y }));
        document.querySelector('#waveform-audio-element').pause();
      })()`);

    try {
      await js(`window.api.openFolder(${JSON.stringify(library)})`);
      await js(`location.reload()`);
      await delay(4000);
      // Keep the screenshot run silent (auto-play is on by default).
      await js(`document.querySelector('#waveform-audio-element').muted = true`);

      // --- 01: Library browse ---
      await clickRowIndex(3);
      await delay(1200);
      await capture(path.join(screenshotsDir, '01-library-browse.png'));

      // --- Hero + 02: search with a looped region on the waveform ---
      await search('bell');
      await clickRow('bell 10\\.wav');
      await delay(800);
      await dragWaveform(0.11, 0.36);
      await delay(900);
      await capture(
        path.join(docsShotsDir, 'screenshot-01.png'),
        path.join(screenshotsDir, '02-waveform-slicing.png')
      );
      await js(`document.querySelector('#waveform-region-clear-btn')?.click()`);

      // --- 03: Instant search ---
      await search('laser');
      await clickRowIndex(0);
      await delay(1000);
      await capture(path.join(screenshotsDir, '03-instant-search.png'));

      // --- 05: Batch exporter ---
      await clickRowIndex(4, { shiftKey: true });
      await delay(300);
      await key('e', { ctrlKey: true });
      await delay(1000);
      await capture(path.join(screenshotsDir, '05-batch-exporter.png'));
      await key('Escape');
      await delay(300);
      await js(`document.querySelector('#multiselect-clear-btn, [title*="Clear selection"]')?.click()`);

      // --- 04: Category browsing ---
      await search('');
      await js(`document.querySelector('#category-item-impacts')?.click()`);
      await delay(400);
      await js(`document.querySelector('#subcategory-list-impacts') || document.querySelector('#category-toggle-subcategories-impacts')?.click()`);
      await delay(1400);
      await scrollListTop();
      await clickRowIndex(0);
      await delay(1000);
      await capture(path.join(screenshotsDir, '04-category-browsing.png'));
      await js(`document.querySelector('#category-item-all-sounds')?.click()`);
      await delay(800);

      // --- 06: Shortcuts guide ---
      await key('?');
      await delay(1000);
      await capture(path.join(screenshotsDir, '06-shortcuts-guide.png'));
      await key('?');
      await delay(400);

      // --- 09: Effects window (Reverse Swell + peak normalize on a bell decay) ---
      await search('bell');
      await clickRow('bell 10\\.wav');
      await key('p', { ctrlKey: true });
      await delay(1500);
      await js(`(() => {
        [...document.querySelectorAll('#effects-presets button')].find((b) => b.textContent.startsWith('Reverse Swell')).click();
      })()`);
      await delay(300);
      await js(`document.querySelector('#effects-level-mode-item-peak').click()`);
      await delay(3000);
      await capture(path.join(screenshotsDir, '09-processing.png'));
      await captureElement('#effects-modal', path.join(docsShotsDir, '09-processing.png'));
      await js(`document.querySelector('#effects-reset-all')?.click()`);
      await key('Escape');
      await delay(400);

      // --- 07: Slicer, auto-detected footsteps ---
      await search('footsteps');
      await clickRow('footsteps', 4, 60);
      await key('k', { ctrlKey: true });
      await delay(3000);
      await js(`document.querySelector('#slicer-detect-btn').click()`);
      await delay(600);
      // Select the third slice so the highlight shows.
      await js(`document.querySelectorAll('#slicer-list .grid')[3]?.click()`);
      await delay(500);
      await capture(path.join(screenshotsDir, '07-slicer.png'));
      await captureElement('#slicer-modal', path.join(docsShotsDir, '07-slicer.png'));
      await key('Escape');
      await delay(400);

      // --- 08: Seamless loop on a drone ---
      await search('drone bellish');
      await clickRow('drone', 12, 400);
      await key('l', { ctrlKey: true });
      await delay(3500);
      await js(`(() => {
        for (const [id, v] of [['loop-start-input', '4'], ['loop-end-input', '14']]) {
          const i = document.querySelector('#' + id);
          i.value = v;
          i.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const s = document.querySelector('#loop-crossfade-slider');
        s.value = '1500';
        s.dispatchEvent(new Event('input', { bubbles: true }));
      })()`);
      await delay(400);
      await js(`document.querySelector('[title="Zoom to loop region"]')?.click()`);
      await delay(800);
      await capture(path.join(screenshotsDir, '08-seamless-loop.png'));
      await captureElement('#loop-modal', path.join(docsShotsDir, '08-seamless-loop.png'));

      console.log('All screenshots captured.');
    } catch (err) {
      console.error('Error during capture:', err);
      process.exitCode = 1;
    } finally {
      app.quit();
    }
  });
});
