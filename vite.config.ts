import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const repoRoot = path.dirname(fileURLToPath(import.meta.url));
const gameRoute = '/game';
const legacyRoute = '/legacy-game';
const legacyDirectories = ['assets', 'data', 'src', 'styles'];
const gameFogScriptName = 'warcrest-fog-toggle.js';
const gameFogScriptPath = path.resolve(repoRoot, 'client/legacy-game-extensions/warcrest-fog-toggle.js');

function contentTypeFor(filePath: string): string {
  switch (path.extname(filePath).toLowerCase()) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.js':
      return 'text/javascript; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    case '.svg':
      return 'image/svg+xml';
    case '.mp3':
      return 'audio/mpeg';
    case '.wav':
      return 'audio/wav';
    default:
      return 'application/octet-stream';
  }
}

function isLegacyResourcePath(relativePath: string): boolean {
  return (
    relativePath === 'index.html' ||
    legacyDirectories.some((directory) => (
      relativePath === directory || relativePath.startsWith(`${directory}/`)
    ))
  );
}

function legacyGameRoutes(): Plugin {
  let outDir = path.resolve(repoRoot, 'dist');

  return {
    name: 'legacy-game-routes',
    configResolved(config) {
      outDir = path.isAbsolute(config.build.outDir)
        ? config.build.outDir
        : path.resolve(config.root, config.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const requestUrl = new URL(request.url ?? '/', 'http://localhost');
        const route = routeForPathname(requestUrl.pathname);

        if (route && requestUrl.pathname === route) {
          response.statusCode = 308;
          response.setHeader('Location', `${route}/`);
          response.end();
          return;
        }

        if (!route || !requestUrl.pathname.startsWith(`${route}/`)) {
          next();
          return;
        }

        const routeRelativePath = decodeURIComponent(
          requestUrl.pathname.slice(`${route}/`.length),
        );
        const relativePath = routeRelativePath === '' ? 'index.html' : routeRelativePath;

        if (route === gameRoute && relativePath === gameFogScriptName) {
          response.setHeader('Content-Type', contentTypeFor(gameFogScriptPath));
          fs.createReadStream(gameFogScriptPath).pipe(response);
          return;
        }

        const filePath = path.resolve(repoRoot, relativePath);
        const relativeToRepo = path.relative(repoRoot, filePath);

        if (
          !isLegacyResourcePath(relativePath) ||
          relativeToRepo.startsWith('..') ||
          path.isAbsolute(relativeToRepo) ||
          !fs.existsSync(filePath) ||
          fs.statSync(filePath).isDirectory()
        ) {
          next();
          return;
        }

        response.setHeader('Content-Type', contentTypeFor(filePath));
        if (route === gameRoute && relativePath === 'index.html') {
          response.end(injectGameFogScript(fs.readFileSync(filePath, 'utf8')));
          return;
        }
        fs.createReadStream(filePath).pipe(response);
      });
    },
    closeBundle() {
      copyLegacyRoute(path.resolve(outDir, 'legacy-game'), false);
      copyLegacyRoute(path.resolve(outDir, 'game'), true);
    },
  };
}

function routeForPathname(pathname: string): string | null {
  if (pathname === gameRoute || pathname.startsWith(`${gameRoute}/`)) return gameRoute;
  if (pathname === legacyRoute || pathname.startsWith(`${legacyRoute}/`)) return legacyRoute;
  return null;
}

function copyLegacyRoute(routeOutDir: string, includeFogToggle: boolean): void {
  fs.rmSync(routeOutDir, { recursive: true, force: true });
  fs.mkdirSync(routeOutDir, { recursive: true });

  const sourceIndex = fs.readFileSync(path.resolve(repoRoot, 'index.html'), 'utf8');
  const indexHtml = includeFogToggle ? injectGameFogScript(sourceIndex) : sourceIndex;

  fs.writeFileSync(path.resolve(routeOutDir, 'index.html'), indexHtml);

  for (const directory of legacyDirectories) {
    fs.cpSync(path.resolve(repoRoot, directory), path.resolve(routeOutDir, directory), {
      recursive: true,
    });
  }

  if (includeFogToggle) {
    fs.copyFileSync(gameFogScriptPath, path.resolve(routeOutDir, gameFogScriptName));
  }
}

function injectGameFogScript(html: string): string {
  const scriptTag = `<script src="${gameFogScriptName}"></script>`;

  if (html.includes(scriptTag)) return html;

  return html.replace('</body>', `${scriptTag}\n</body>`);
}

export default defineConfig({
  root: 'client',
  plugins: [legacyGameRoutes(), react()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
