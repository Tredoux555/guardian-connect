import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 8080;
const DIST_DIR = path.join(__dirname, 'dist');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
};

// Startup validation
function validateSetup() {
  console.log('🔍 Validating setup...');
  console.log(`📁 Current directory: ${__dirname}`);
  console.log(`📁 Dist directory: ${DIST_DIR}`);
  console.log(`🌐 Port: ${PORT}`);
  
  // Check if dist directory exists
  if (!fs.existsSync(DIST_DIR)) {
    console.error(`❌ ERROR: Dist directory does not exist: ${DIST_DIR}`);
    console.error('💡 Make sure you run "npm run build" before starting the server');
    process.exit(1);
  }
  
  // Check if index.html exists
  const indexPath = path.join(DIST_DIR, 'index.html');
  if (!fs.existsSync(indexPath)) {
    console.error(`❌ ERROR: index.html not found in: ${DIST_DIR}`);
    console.error('💡 Make sure the build completed successfully');
    process.exit(1);
  }
  
  console.log('✅ Setup validation passed');
  console.log(`📄 Found index.html at: ${indexPath}`);
}

// Validate setup on startup
validateSetup();

const server = http.createServer((req, res) => {
  // Health check endpoint
  if (req.url === '/health' || req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      distDir: DIST_DIR,
      distExists: fs.existsSync(DIST_DIR)
    }));
    return;
  }

  // Remove query string and hash
  let urlPath = req.url?.split('?')[0].split('#')[0] || '/';
  
  // Normalize path
  if (urlPath === '/') {
    urlPath = '/index.html';
  }
  
  let filePath = path.join(DIST_DIR, urlPath);
  
  // Security: prevent directory traversal
  const resolvedPath = path.resolve(filePath);
  const resolvedDist = path.resolve(DIST_DIR);
  
  if (!resolvedPath.startsWith(resolvedDist)) {
    console.warn(`⚠️  Blocked directory traversal attempt: ${req.url}`);
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // SPA routing: serve index.html for all routes
        const indexPath = path.join(DIST_DIR, 'index.html');
        fs.readFile(indexPath, (err, content) => {
          if (err) {
            console.error(`❌ Error serving index.html: ${err.message}`);
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(content, 'utf-8');
          }
        });
      } else {
        console.error(`❌ Error reading file ${filePath}: ${err.message}`);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

// Error handling
server.on('error', (err) => {
  console.error('❌ Server error:', err);
  if (err.code === 'EADDRINUSE') {
    console.error(`💡 Port ${PORT} is already in use`);
  }
  process.exit(1);
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(50));
  console.log('✅ Admin panel server started successfully!');
  console.log(`🌐 Listening on: http://0.0.0.0:${PORT}`);
  console.log(`📁 Serving files from: ${DIST_DIR}`);
  console.log(`🏥 Health check: http://0.0.0.0:${PORT}/health`);
  console.log('='.repeat(50));
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
