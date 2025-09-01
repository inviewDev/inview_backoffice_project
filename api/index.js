const express = require('express');
const app = express();

app.use(express.json());

app.use((err, req, res, next) => {
  console.error('Global error:', err.stack);
  res.status(500).send('Internal Server Error');
});

// 기본 route (테스트용)
app.get('/', (req, res) => {
  try {
    res.send('Hello from Express backend on Vercel!');
  } catch (error) {
    console.error('Error in / route:', error);
    res.status(500).send('Internal Server Error');
  }
});

// /api/users route 추가 (Vercel req.path와 맞춤)
app.get('/api/users', (req, res) => {
  try {
    console.log('Accessing /api/users endpoint');
    res.json([{ id: 1, name: 'Admin', role: 'admin' }]);
  } catch (error) {
    console.error('Error in /api/users route:', error);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = app;