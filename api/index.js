const express = require('express');
const app = express();

app.use(express.json());

// 글로벌 에러 핸들러 (모든 에러 캐치)
app.use((err, req, res, next) => {
  console.error('Global error:', err.stack);  // 로그로 에러 출력
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

app.get('/users', (req, res) => {
  try {
    console.log('Accessing /users endpoint');
    res.json([{ id: 1, name: 'Admin', role: 'admin' }]);
  } catch (error) {
    console.error('Error in /users route:', error);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = app;