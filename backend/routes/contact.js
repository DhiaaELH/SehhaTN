const express = require('express');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const pool = require('../db');
const { parse } = require('../lib/http');

const router = express.Router();

const contactSchema = z.object({
  name: z.string().trim().min(2, 'Nom trop court').max(100),
  email: z.email('Adresse e-mail invalide').max(200),
  topic: z.enum(['account', 'appointment', 'doctor', 'data', 'bug', 'other'], { error: 'Sujet invalide' }),
  message: z.string().trim().min(10, 'Message trop court (10 caractères minimum)').max(3000, 'Message trop long'),
  website: z.string().max(0).optional(),        // champ piège invisible : rempli uniquement par les robots
});

/** Utilisateur connecté s'il y a un jeton valide (facultatif ici). */
function optionalUser(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return null;
  try { return jwt.verify(h.slice(7), process.env.JWT_SECRET).id; } catch { return null; }
}

// POST /api/contact : message du formulaire « Aide & contact »
router.post('/', async (req, res) => {
  const body = parse(contactSchema, req.body, res);
  if (!body) return;
  const { rows: [msg] } = await pool.query(
    `INSERT INTO contact_messages (user_id, name, email, topic, message) VALUES ($1, $2, $3, $4, $5)
     RETURNING id, created_at`,
    [optionalUser(req), body.name, body.email.toLowerCase(), body.topic, body.message]);
  res.status(201).json({ id: msg.id, reference: `SEH-${String(msg.id).padStart(5, '0')}`, created_at: msg.created_at });
});

module.exports = router;
