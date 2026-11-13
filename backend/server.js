require('dotenv').config();
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend lancé sur le port ${PORT}`);
});