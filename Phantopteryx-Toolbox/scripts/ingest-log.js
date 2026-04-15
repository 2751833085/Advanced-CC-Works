#!/usr/bin/env node
/**
 * Local NDJSON ingest for Cursor debug mode.
 * Run in project root: node scripts/ingest-log.js
 * Then open the editor; browser POSTs append lines to .cursor/debug-c7c4d2.log
 */
var http = require('http');
var fs = require('fs');
var path = require('path');

var logPath = path.join(__dirname, '..', '.cursor', 'debug-c7c4d2.log');
var PORT = 7375;

function appendLine(obj) {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, JSON.stringify(obj) + '\n', 'utf8');
}

var server = http.createServer(function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Debug-Session-Id');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url.indexOf('/ingest/') === 0) {
    var body = '';
    req.on('data', function(chunk) {
      body += chunk;
      if (body.length > 1e6) req.destroy();
    });
    req.on('end', function() {
      var line = body.trim();
      if (!line) {
        res.writeHead(400);
        res.end();
        return;
      }
      try {
        appendLine(JSON.parse(line));
      } catch (_) {
        appendLine({ parseError: true, raw: line.slice(0, 200), t: Date.now() });
      }
      res.writeHead(204);
      res.end();
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, '127.0.0.1', function() {
  console.log('Ingest http://127.0.0.1:' + PORT + ' -> ' + logPath);
});
