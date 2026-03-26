#!/usr/bin/env python3
"""
Aelarian Archive — Local Server
Serves files AND accepts file updates from the browser updater.
Run: python3 serve.py
Then open: http://localhost:8080
"""

import http.server
import json
import os

PORT = 8080
BASE = os.path.dirname(os.path.abspath(__file__))

# Files the updater is allowed to write (safety whitelist)
ALLOWED = {
    'index.html':           '',
    'test.html':            '',
    'core/data.js':         'core',
    'core/schema.js':       'core',
    'core/ids.js':          'core',
    'core/tagger.js':       'core',
    'core/tags-vocab.js':   'core',
}

UPDATER_HTML = '''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Ælarian Updater</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #0a1e28; color: #c8b89a; font-family: 'Courier New', monospace;
    min-height: 100vh; display: flex; flex-direction: column;
    align-items: center; justify-content: center; padding: 2rem; gap: 1.5rem;
  }
  h1 { color: #4a9ab5; font-size: 1.2rem; letter-spacing: .15em; }
  select, textarea {
    width: 100%; max-width: 760px; background: #0e2830; color: #c8b89a;
    border: 1px solid #1a4850; border-radius: 4px; padding: .75rem;
    font-family: 'Courier New', monospace; font-size: .85rem;
  }
  textarea { height: 380px; resize: vertical; }
  button {
    background: #1a4850; color: #c8b89a; border: 1px solid #4a9ab5;
    padding: .6rem 2rem; border-radius: 4px; cursor: pointer;
    font-family: inherit; letter-spacing: .1em; font-size: .9rem;
  }
  button:hover { background: #4a9ab5; color: #0a1e28; }
  #status {
    font-size: .85rem; min-height: 1.4rem; color: #8c6620;
    letter-spacing: .05em;
  }
  #status.ok  { color: #4a9ab5; }
  #status.err { color: #8c2020; }
  label { font-size: .8rem; color: #7a9aaa; letter-spacing: .08em; }
</style>
</head>
<body>
<h1>∿ ÆLARIAN UPDATER ∿</h1>
<div style="width:100%;max-width:760px;display:flex;flex-direction:column;gap:1rem">
  <div>
    <label>TARGET FILE</label><br><br>
    <select id="target">
      <option value="index.html">index.html</option>
      <option value="core/schema.js">core/schema.js</option>
      <option value="core/tagger.js">core/tagger.js</option>
      <option value="core/tags-vocab.js">core/tags-vocab.js</option>
      <option value="core/data.js">core/data.js</option>
      <option value="core/ids.js">core/ids.js</option>
      <option value="test.html">test.html</option>
    </select>
  </div>
  <div>
    <label>PASTE FILE CONTENT FROM CLAUDE</label><br><br>
    <textarea id="content" placeholder="Paste the full file content here..."></textarea>
  </div>
  <div style="display:flex;align-items:center;gap:1.5rem">
    <button onclick="apply()">⟠ Apply Update</button>
    <div id="status"></div>
  </div>
</div>
<script>
async function apply() {
  const target  = document.getElementById('target').value;
  const content = document.getElementById('content').value.trim();
  const status  = document.getElementById('status');
  if (!content) { status.className='err'; status.textContent='Nothing to write.'; return; }
  status.className=''; status.textContent='Writing…';
  try {
    const r = await fetch('/__update__', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: target, content })
    });
    const j = await r.json();
    if (j.ok) {
      status.className='ok';
      status.textContent = `✓ ${target} updated. Refresh your archive tab.`;
      document.getElementById('content').value = '';
    } else {
      status.className='err';
      status.textContent = 'Error: ' + j.error;
    }
  } catch(e) {
    status.className='err';
    status.textContent = 'Server error: ' + e.message;
  }
}
</script>
</body>
</html>'''


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE, **kwargs)

    def do_GET(self):
        if self.path == '/updater' or self.path == '/updater.html':
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
            self.end_headers()
            self.wfile.write(UPDATER_HTML.encode())
            return
        super().do_GET()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_POST(self):
        if self.path == '/__update__':
            length  = int(self.headers.get('Content-Length', 0))
            body    = self.rfile.read(length)
            try:
                data    = json.loads(body)
                target  = data.get('file', '')
                content = data.get('content', '')

                if target not in ALLOWED:
                    self._json({'ok': False, 'error': f'File not in whitelist: {target}'})
                    return

                dest = os.path.join(BASE, target.replace('/', os.sep))
                os.makedirs(os.path.dirname(dest) or '.', exist_ok=True)

                with open(dest, 'w', encoding='utf-8') as f:
                    f.write(content)

                self._json({'ok': True})
            except Exception as e:
                self._json({'ok': False, 'error': str(e)})
            return
        self.send_response(405)
        self.end_headers()

    def _json(self, obj):
        body = json.dumps(obj).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        print(f"  {args[0]} {args[1]}")


if __name__ == '__main__':
    os.chdir(BASE)
    print(f"\n  ∿ Ælarian Archive running at http://localhost:{PORT}")
    print(f"  ∿ Updater at http://localhost:{PORT}/updater\n")
    with http.server.HTTPServer(('', PORT), Handler) as httpd:
        httpd.serve_forever()

