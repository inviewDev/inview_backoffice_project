const express = require('express');
const app = express();

app.use(express.json());

// 글로벌 에러 핸들러
app.use((err, req, res, next) => {
  console.error('Global error:', err.stack);
  res.status(500).send('Internal Server Error');
});

app.get('/', (req, res) => {
  try {
    res.send('Hello from Express backend on Vercel!');
  } catch (error) {
    console.error('Error in / route:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/api/users', (req, res) => {  // /api/users로 변경
  try {
    console.log('Accessing /api/users endpoint');
    res.json([{ id: 1, name: 'Admin', role: 'admin' }]);
  } catch (error) {
    console.error('Error in /api/users route:', error);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = app;