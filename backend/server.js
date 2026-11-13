const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ message: 'Le backend SehhaTN fonctionne' });
});

const doctorsRouter = require('./routes/doctors');  
app.use('/api/doctors', doctorsRouter);              

app.listen(3000, () => {
  console.log('Backend lancé sur http://localhost:3000');
});