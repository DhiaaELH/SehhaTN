/** Application Express (sans écoute réseau) : importable telle quelle par les tests. */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const pool = require('./db');

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET manquant : ajoute-le dans backend/.env');
}
if (process.env.NODE_ENV === 'production' && process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET trop court pour la production (32 caractères minimum)');
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 1));   // Render place l'API derrière un proxy

// En-têtes de sécurité. L'API ne sert que du JSON : politique de contenu la plus stricte.
app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } } }));

// CORS : liste blanche configurable (CORS_ORIGINS="https://a.com,https://b.com"), par défaut le site et le dev local.
const ORIGINS = (process.env.CORS_ORIGINS || 'https://dhiaaelh.github.io,http://localhost:4200,http://127.0.0.1:4200')
  .split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => cb(null, !origin || ORIGINS.includes('*') || ORIGINS.includes(origin)),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}));
app.use(express.json({ limit: '100kb' }));

// Limitation de débit : généreuse pour la lecture, stricte pour ce qui est sensible ou coûteux.
const limiter = (windowMin, limit, message) => rateLimit({
  windowMs: windowMin * 60 * 1000, limit, standardHeaders: 'draft-8', legacyHeaders: false,
  message: { error: message }, skip: () => process.env.NODE_ENV === 'test',
});
app.use('/api', limiter(1, 300, 'Trop de requêtes, réessayez dans une minute.'));
app.use(['/api/auth/login', '/api/auth/register'], limiter(15, 20, 'Trop de tentatives, réessayez dans 15 minutes.'));
app.use('/api/contact', limiter(60, 5, 'Trop de messages envoyés, réessayez plus tard.'));
app.use('/api/triage', limiter(1, 40, 'Trop de messages, patientez un instant.'));
app.use('/api/health-card/emergency', limiter(15, 30, 'Trop de requêtes, réessayez plus tard.'));
app.use('/api/geo/search', limiter(1, 20, 'Trop de recherches, patientez un instant.'));

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ message: 'Le backend SehhaTN fonctionne', database: 'ok' });
  } catch {
    res.status(503).json({ message: 'Le backend fonctionne mais la base de données est injoignable', database: 'down' });
  }
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/doctors', require('./routes/schedule'));
app.use('/api/doctors', require('./routes/reviews'));
app.use('/api/doctors', require('./routes/doctors'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/news', require('./routes/news'));
app.use('/api/meta', require('./routes/meta'));
app.use('/api/facilities', require('./routes/facilities'));
app.use('/api/geo', require('./routes/geo'));
app.use('/api/triage', require('./routes/triage'));
app.use('/api/conditions', require('./routes/conditions'));
app.use('/api/health-card', require('./routes/health-card'));
app.use('/api/contact', require('./routes/contact'));

// Route inconnue : réponse JSON plutôt que la page HTML par défaut d'Express
app.use('/api', (req, res) => res.status(404).json({ error: 'Route introuvable' }));

// Gestion des erreurs : toujours APRÈS les routes (Express 5 transmet aussi les erreurs des fonctions async).
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Corps de requête JSON invalide' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Requête trop volumineuse' });
  console.error(`[${req.method} ${req.originalUrl}]`, err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Erreur serveur' });
});

module.exports = app;
