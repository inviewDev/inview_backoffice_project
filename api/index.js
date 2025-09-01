const express = require('express');
const app = express();

app.use(express.json());  // JSON 요청 처리

// 기본 라우트 예시
app.get('/', (req, res) => {
  res.send('Hello from Express backend on Vercel!');
});

// 백오피스용 API 예시 (사용자 목록 반환 – 실제 DB 연결 시 확장)
app.get('/users', (req, res) => {
  res.json([{ id: 1, name: 'Admin', role: 'admin' }]);  // 더미 데이터
});

module.exports = app;