import puppeteer from 'puppeteer';
import { glob } from 'glob';
import { searchSolution } from './layout';
import { imageSize } from 'image-size';

const PPI = 2;
const OUTER_BORDER_W = 170;
const OUTER_BORDER_H = 100;
const WIDTH = 2970;
const HEIGHT = 2100;
const GAP = 15;

const images = await glob('images/*.jpg');
const sizes = images.map((img) => imageSize(img));

Bun.serve({
  fetch(request, server) {
    if (request.url.endsWith('.jpg')) {
      const url = new URL(request.url);
      return new Response(Bun.file(url.pathname.replace(/^\//, '')));
    }
    const nodes = searchSolution(
      WIDTH - OUTER_BORDER_W * 2,
      HEIGHT - OUTER_BORDER_H * 2,
      sizes.map(({ width, height }) => (width || 0) / (height || 0)),
      500
    );
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
  ><img src="${images[node.index as any]}" /></div>`
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

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    });
  },
  port: 3000,
});

const p = await puppeteer.launch();
const page = await p.newPage();
await page.goto('http://localhost:3000');
await page.setViewport({ width: WIDTH * PPI, height: HEIGHT * PPI });
await page.screenshot({ path: 'print.png' });

