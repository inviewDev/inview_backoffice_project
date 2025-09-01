const express = require('express');
const app = express();
const apiRouter = express.Router();

// JSON 파싱 미들웨어
app.use(express.json());

// API 라우트
apiRouter.get('/users', (req, res) => {
  console.log('Accessing /api/users endpoint');
  res.json([{ id: 1, name: 'Admin', role: 'admin' }]);
});

app.use('/api', apiRouter);

// 루트 경로
app.get('/', (req, res) => {
  res.send('Hello from Express backend on Vercel!');
});

// 글로벌 에러 핸들러
app.use((err, req, res, next) => {
  console.error('Global error:', err.stack);
  res.status(500).send('Internal Server Error');
});

// 서버 시작
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;