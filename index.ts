import puppeteer from 'puppeteer';
import { glob } from 'glob';
import { searchSolution, type Node } from './layout';
import { imageSize } from 'image-size';

const OUTER_BORDER_W = 250;
const OUTER_BORDER_H = 120;
const WIDTH = 2970;
const HEIGHT = 2100;
const GAP = 15;

const PORT = 3000;

function serveImage(request: Request): Response {
  const url = new URL(request.url);
  return new Response(Bun.file(url.pathname.replace(/^\//, '')));
}

const p = await puppeteer.launch();

function renderImagesPage(images: Array<string>, nodes: Array<Node>, { ppi = 1 }: { ppi: number }) {
  const nodesHtml = nodes
    .map(
      (node) => `
<div
class="node"
style="
  width: ${node.width * ppi}px;
  height: ${node.height * ppi}px;
  left: ${node.x * ppi}px;
  top: ${node.y * ppi}px;
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
display: flex;
align-items: center;
justify-content: center;
min-height: 100vh;
}
.border {
width: ${WIDTH * ppi}px;
height: ${HEIGHT * ppi}px;
padding: ${OUTER_BORDER_H * ppi}px ${OUTER_BORDER_W * ppi}px;
background: #000;
box-sizing: border-box;
}
.container {
width: ${(WIDTH - OUTER_BORDER_W * 2) * ppi}px;
height: ${(HEIGHT - OUTER_BORDER_H * 2) * ppi}px;
position: relative;
}

.node {
position: absolute;
padding: ${GAP * ppi}px;
box-sizing: border-box;
}

.node img {
width: 100%;
height: 100%;
}

.submit {
  position: fixed;
  top: 0;
  left: 0;
  padding: 10px;
  opacity: 0;
}

.submit:hover {
  opacity: 1;
}
</style>
</head>
<body>
<form class="submit js-submit">
<button>Save screenshot</button>
</form>
<div class="border">
<div class="container">${nodesHtml}</div>
</div>
<script>
const form = document.querySelector('.js-submit');
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const r = await fetch(window.location, {
    method: 'post',
    body: JSON.stringify({ nodes: ${JSON.stringify(nodes)} })
  })
  alert('Saved!');
});
</script>
</body>
</html>`;

  return html;
}

function renderIndexPage(folders: Array<string>) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
<ul>
${folders.map((f) => `<li><a href="/${f}">${f}</a></li>`).join('')}
</ul>
</body>
</html>`;

  return html;
}

async function makeScreenshot(html: string, path: string, ppi: number) {
  const page = await p.newPage();
  await page.setContent(html);
  await page.setViewport({ width: WIDTH * ppi, height: HEIGHT * ppi });
  await page.screenshot({ path });
  await page.close();
}

Bun.serve({
  async fetch(request, server) {
    const url = new URL(request.url);
    if (url.pathname.endsWith('.jpg')) {
      return serveImage(request);
    }
    const [date] = url.pathname.split('/').slice(1).filter(Boolean);

    if (date === undefined) {
      const folders = (await glob('images/*')).map((f) =>
        f.replace('images/', '')
      );
      const html = renderIndexPage(folders);
      return new Response(html, { headers: { 'Content-Type': 'text/html' } });
    }

    const images = await glob(`images/${date}/*.jpg`);
    if (images.length === 0) {
      return new Response('404', { status: 404 });
    }

    if (request.method.toLowerCase() === 'post') {
      const body: { nodes: Array<Node> } = await request.json();
      const html = renderImagesPage(images, body.nodes, { ppi: 2 });
      await makeScreenshot(html, `pages/${date}.png`, 2);
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html',
        },
      });
    }

    const sizes = images.map((img) => imageSize(img));
    const nodes = searchSolution(
      WIDTH - OUTER_BORDER_W * 2,
      HEIGHT - OUTER_BORDER_H * 2,
      sizes.map(({ width, height }) => (width || 0) / (height || 0)),
      500
    );
    const html = renderImagesPage(images, nodes, { ppi: 0.3 });

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    });
  },
  port: PORT,
});
