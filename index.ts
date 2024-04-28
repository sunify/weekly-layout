import puppeteer from 'puppeteer';
import { glob } from 'glob';
import { searchSolution, type Node } from './layout';
import { imageSize } from 'image-size';

const PPI = 2;
const OUTER_BORDER_W = 170;
const OUTER_BORDER_H = 100;
const WIDTH = 2970;
const HEIGHT = 2100;
const GAP = 15;

const PORT = 3000;

function serveImage(request: Request): Response {
  const url = new URL(request.url);
  return new Response(Bun.file(url.pathname.replace(/^\//, '')));
}

const p = await puppeteer.launch();

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function renderImagesPage(images: Array<string>, nodes: Array<Node>) {
  const nodesHtml = nodes
  .map(
    (node) => `
<div
class="node"
style="
  width: ${node.width * PPI}px;
  height: ${node.height * PPI}px;
  left: ${node.x * PPI}px;
  top: ${node.y * PPI}px;
  "
><img src="http://localhost:${PORT}/${images[node.index as any]}" /></div>`
  )
  .join('');
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
body {
padding: 0;
margin: 0;
}
.border {
width: ${WIDTH * PPI}px;
height: ${HEIGHT * PPI}px;
padding: ${OUTER_BORDER_H * PPI}px ${OUTER_BORDER_W * PPI}px;
background: #000;
box-sizing: border-box;
}
.container {
width: ${(WIDTH - OUTER_BORDER_W * 2) * PPI}px;
height: ${(HEIGHT - OUTER_BORDER_H * 2) * PPI}px;
position: relative;
}

.node {
position: absolute;
padding: ${GAP * PPI}px;
box-sizing: border-box;
}

.node img {
width: 100%;
height: 100%;
}
</style>
</head>
<body>
<div class="border">
<div class="container">${nodesHtml}</div>
</div>
</body>
</html>`;

  return html;
}

async function makeScreenshot(html: string, path: string) {
  const page = await p.newPage();
  await page.setContent(html);
  await page.setViewport({ width: WIDTH * PPI, height: HEIGHT * PPI });
  await page.screenshot({ path });
  await page.close();
}

Bun.serve({
  async fetch(request, server) {
    const url = new URL(request.url);
    if (url.pathname.endsWith('.jpg')) {
      return serveImage(request);
    }
    const [date] = url.pathname.split('/').slice(1);

    const images = await glob(`images/${date}/*.jpg`);
    if (images.length === 0) {
      return new Response('404', { status: 404 });
    }

    const sizes = images.map((img) => imageSize(img));
    const nodes = searchSolution(
      WIDTH - OUTER_BORDER_W * 2,
      HEIGHT - OUTER_BORDER_H * 2,
      sizes.map(({ width, height }) => (width || 0) / (height || 0)),
      500
    );
    const html = renderImagesPage(images, nodes);

    await makeScreenshot(html, `pages/${date}.png`);

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    });
  },
  port: PORT,
});


