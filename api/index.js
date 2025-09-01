const express = require('express');
const app = express();

app.use(express.json());

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
    res.json([{ id: 1, name: 'Admin', role: 'admin' }]);
  } catch (error) {
    console.error('Error in /users route:', error);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = app;

if (process.env.NODE_ENV !== 'production') {
  const PORT = 3000;
  app.listen(PORT, () => console.log(`Express server running on port ${PORT}`));
}