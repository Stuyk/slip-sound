const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..');
const iconPath = path.join(rootDir, 'build/icon.png');
const screenshotPath = path.join(rootDir, 'docs/screenshots/screenshot-01.png');

const iconBase64 = fs.existsSync(iconPath) ? fs.readFileSync(iconPath).toString('base64') : '';
const screenshotBase64 = fs.existsSync(screenshotPath) ? fs.readFileSync(screenshotPath).toString('base64') : '';

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Slip Sound Social Card</title>
  <link href="../docs/fonts/fonts.css" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      width: 1280px;
      height: 640px;
      overflow: hidden;
      position: relative;
      background: #1a1e25;
      color: #e4e7ec;
      font-family: 'IBM Plex Sans', system-ui, sans-serif;
      -webkit-font-smoothing: antialiased;
    }

    .text {
      position: absolute;
      left: 64px;
      top: 64px;
      bottom: 64px;
      width: 400px;
      display: flex;
      flex-direction: column;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 14px;
      font-size: 24px;
      font-weight: 600;
    }

    .brand img { width: 44px; height: 44px; border-radius: 9px; }

    h1 {
      margin-top: 56px;
      font-size: 46px;
      line-height: 1.12;
      font-weight: 600;
      letter-spacing: -0.02em;
    }

    .sub {
      margin-top: 22px;
      font-size: 21px;
      line-height: 1.45;
      color: #8e96a3;
    }

    .url {
      margin-top: auto;
      font-family: 'IBM Plex Mono', ui-monospace, monospace;
      font-size: 17px;
      color: #4b95e6;
    }

    .shot {
      position: absolute;
      left: 520px;
      top: 64px;
      width: 960px;
      border: 1px solid #313844;
      border-radius: 6px;
      box-shadow: 0 30px 60px -20px rgba(0, 0, 0, 0.7);
    }
  </style>
</head>
<body>
  <div class="text">
    <div class="brand">
      <img src="data:image/png;base64,${iconBase64}" alt="" />
      Slip Sound
    </div>
    <h1>Desktop sample manager for Windows, macOS, and Linux.</h1>
    <p class="sub">Search 170,000 files in under 0.2s. Local, free, no account.</p>
    <div class="url">stuyk.github.io/slip-sound</div>
  </div>
  <img class="shot" src="data:image/png;base64,${screenshotBase64}" alt="" />
</body>
</html>
`;

const htmlFilePath = path.join(rootDir, 'screenshots/github-social-card.html');
fs.writeFileSync(htmlFilePath, htmlContent, 'utf8');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1280,
    height: 640,
    show: false,
    useContentSize: true,
    webPreferences: {
      offscreen: true
    }
  });

  await win.loadURL('file://' + htmlFilePath);
  await new Promise(r => setTimeout(r, 1500));

  console.log('Capturing social card at 1280x640...');
  const image = await win.webContents.capturePage();
  const pngBuffer = image.toPNG();

  const cardPath = path.join(rootDir, 'screenshots/github-social-card.png');
  fs.writeFileSync(cardPath, pngBuffer);
  console.log('Saved Social Card to:', cardPath);

  const docsPath = path.join(rootDir, 'docs/social-preview.png');
  fs.writeFileSync(docsPath, pngBuffer);
  console.log('Saved Docs Social Preview to:', docsPath);

  app.quit();
});
