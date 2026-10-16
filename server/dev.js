// Servidor de desenvolvimento: serve o frontend, recompila o CSS ao salvar e expõe
// a mesma função de upload da Vercel. Em produção o frontend fica no Firebase Hosting.
const path = require('node:path');
const { spawn } = require('node:child_process');
const express = require('express');
const upload = require('../api/upload');

const PORT = process.env.PORT || 3000;
const root = path.join(__dirname, '..');

// Tailwind em modo watch (gera public/css/app.css).
const tailwind = spawn('npx', ['tailwindcss', '-i', 'styles/app.css', '-o', 'public/css/app.css', '--watch=always'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
process.on('exit', () => tailwind.kill());

const app = express();

app.all('/api/upload', upload);
app.use(express.static(path.join(root, 'public')));
app.use((_req, res) => res.sendFile(path.join(root, 'public', 'index.html')));

app.listen(PORT, () => {
  console.log(`Servidor de desenvolvimento em http://localhost:${PORT}`);
});
