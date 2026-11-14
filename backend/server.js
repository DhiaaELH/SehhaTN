require('dotenv').config({ quiet: true });
const express = require('express');
const cors = require('cors');

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET manquant : ajoute-le dans backend/.env');
}

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ message: 'Le backend SehhaTN fonctionne' });
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/doctors', require('./routes/doctors'));

// Gestion des erreurs inattendues : réponse propre au lieu d'un plantage
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erreur serveur' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend lancé sur le port ${PORT}`);
});