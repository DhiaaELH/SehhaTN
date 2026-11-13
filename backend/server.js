const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ message: 'Backend SehhaTnworks' });
});

app.listen(3000, () => {
  console.log('Backend running on http://localhost:3000');
});