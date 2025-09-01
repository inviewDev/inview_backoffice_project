console.log('Script started!');  // 맨 위에 추가 (스크립트 시작 확인)

const express = require('express');
console.log('Express required');  // require 후 추가 (express 로드 확인)

const app = express();
console.log('App created');  // app 생성 후 추가 (app 객체 생성 확인)

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

const PORT = 3000;
app.listen(PORT, () => console.log(`Express server running on port ${PORT}`));

console.log('Script ended');