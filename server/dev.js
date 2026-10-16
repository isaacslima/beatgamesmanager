// Servidor de desenvolvimento: serve o frontend e a mesma função de upload da Vercel.
// Em produção o frontend fica no Firebase Hosting e o upload na Vercel.
const path = require('node:path');
const express = require('express');
const upload = require('../api/upload');

const PORT = process.env.PORT || 3000;
const app = express();

app.all('/api/upload', upload);
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use((_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

app.listen(PORT, () => {
  console.log(`Servidor de desenvolvimento em http://localhost:${PORT}`);
});
