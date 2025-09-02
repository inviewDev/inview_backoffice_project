const express = require('express');
const app = express();
const apiRouter = express.Router();

app.use(express.json());

apiRouter.get('/users', (req, res) => {
  console.log('Accessing /api/users endpoint');
  res.json([{ id: 1, name: 'Admin', role: 'admin' }]);
});

app.use('/api', apiRouter);

app.get('/', (req, res) => {
  res.send('Hello from Express backend on Vercel!');
});

app.use((err, req, res, next) => {
  console.error('Global error:', err.stack);
  res.status(500).send('Internal Server Error');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;