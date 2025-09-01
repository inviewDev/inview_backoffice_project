const express = require('express');
const app = express();

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Hello from Express backend on Vercel!');
});

app.get('/users', (req, res) => {
  res.json([{ id: 1, name: 'Admin', role: 'admin' }]);
});

module.exports = app;  // 이 줄은 유지