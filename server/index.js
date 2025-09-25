const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cookieSession = require('cookie-session');

const app = express();
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: false, // simpel für Start (können wir später härten)
}));
app.use(express.urlencoded({ extended: false }));

app.use(cookieSession({
  name: 'hd_sess',
  keys: [process.env.SESSION_SECRET || 'dev-only-change-me'],
  maxAge: 1000 * 60 * 60 * 8, // 8h
  sameSite: 'lax',
  httpOnly: true,
  secure: true, // auf HTTPS
}));

// --- kleine Helpers ---
const REQ_LOGIN_PATH = '/login';
function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.redirect(REQ_LOGIN_PATH);
}
function isAdmin(user) {
  if (!user || !user.email) return false;
  const e = String(user.email).toLowerCase().trim();
  return e.startsWith('admin') || e === 'admin@hotel-dashboard.de';
}

// --- statische Dateien (öffentlich NUR Bilder/CSS/JS) ---
app.use('/assets', express.static(path.join(__dirname, '..', 'public', 'assets'), {
  immutable: true, maxAge: '7d',
}));

// --- Login-Seite (öffentlich) ---
app.get(REQ_LOGIN_PATH, (_, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
});

// --- Fake-Login zum Test (später: echte Prüfung + ibelsa-Tenantcode) ---
app.post('/login', (req, res) => {
  const { email = '', password = '' } = req.body;
  // Minimalprüfung (nur Demo!): Passwort muss mind. 8 Zeichen haben
  if (!email || !password || String(password).length < 8) {
    return res.status(400).send('<h1>Login fehlgeschlagen</h1><a href="/login">Zurück</a>');
  }
  req.session.user = { email: String(email).trim() };
  // Admin-Sonderweg
  return res.redirect(isAdmin(req.session.user) ? '/admin' : '/app');
});

// --- Geschützte Bereiche ---
app.get('/admin', requireAuth, (req, res) => {
  if (!isAdmin(req.session.user)) return res.redirect('/app');
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});
app.get('/app', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'app.html'));
});

// --- Logout ---
app.post('/logout', (req, res) => {
  req.session = null;
  res.redirect(REQ_LOGIN_PATH);
});

// --- Catch-all: alles andere → Login (oder 404 hart) ---
app.get('*', (_, res) => res.redirect(REQ_LOGIN_PATH));

// --- Start ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Hotel Dashboard server running on :' + PORT));
