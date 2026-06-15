import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const repoRoot = path.dirname(fileURLToPath(import.meta.url));
const legacyRoute = '/game';
const legacyDirectories = ['assets', 'data', 'src', 'styles'];

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

function legacyGameRoute(): Plugin {
  let outDir = path.resolve(repoRoot, 'dist');

  return {
    name: 'legacy-game-route',
    configResolved(config) {
      outDir = path.isAbsolute(config.build.outDir)
        ? config.build.outDir
        : path.resolve(config.root, config.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const requestUrl = new URL(request.url ?? '/', 'http://localhost');

        if (requestUrl.pathname === legacyRoute) {
          response.statusCode = 308;
          response.setHeader('Location', `${legacyRoute}/`);
          response.end();
          return;
        }

        if (!requestUrl.pathname.startsWith(`${legacyRoute}/`)) {
          next();
          return;
        }

        const routeRelativePath = decodeURIComponent(
          requestUrl.pathname.slice(`${legacyRoute}/`.length),
        );
        const relativePath = routeRelativePath === '' ? 'index.html' : routeRelativePath;
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
        fs.createReadStream(filePath).pipe(response);
      });
    },
    closeBundle() {
      const legacyOutDir = path.resolve(outDir, 'game');

      fs.rmSync(legacyOutDir, { recursive: true, force: true });
      fs.mkdirSync(legacyOutDir, { recursive: true });
      fs.copyFileSync(path.resolve(repoRoot, 'index.html'), path.resolve(legacyOutDir, 'index.html'));

      for (const directory of legacyDirectories) {
        fs.cpSync(path.resolve(repoRoot, directory), path.resolve(legacyOutDir, directory), {
          recursive: true,
        });
      }
    },
  };
}

export default defineConfig({
  root: 'client',
  plugins: [legacyGameRoute(), react()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
