const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cookieSession = require('cookie-session');

const app = express();
app.set('trust proxy', 1); // <-- notwendig für Render (HTTPS Proxy)

// --- Debug-Logs gleich am Start
console.log('[boot] starting server process pid=%d node=%s', process.pid, process.version);
console.log('[boot] env.PORT=%s', process.env.PORT);

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.urlencoded({ extended: false }));

app.use(cookieSession({
  name: 'hd_sess',
  keys: [process.env.SESSION_SECRET || 'dev-only-change-me'],
  maxAge: 1000 * 60 * 60 * 8,
  sameSite: 'lax',
  httpOnly: true,
  secure: true, // Render ist HTTPS → OK
}));

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

// Statische Assets (nur Bilder/CSS/JS)
app.use('/assets', express.static(path.join(__dirname, '..', 'public', 'assets'), {
  immutable: true, maxAge: '7d',
}));

// Healthcheck für Render
app.get('/healthz', (_req, res) => res.status(200).send('ok'));

// Root → Login (hilft auch Render beim ersten Ping)
app.get('/', (_req, res) => res.redirect(REQ_LOGIN_PATH));

// Login-Seite (GET)
app.get(REQ_LOGIN_PATH, (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
});

// Demo-Login (POST) – später echte Prüfung
app.post('/login', (req, res) => {
  const { email = '', password = '' } = req.body;
  if (!email || !password || String(password).length < 8) {
    return res.status(400).send('<h1>Login fehlgeschlagen</h1><a href="/login">Zurück</a>');
  }
  req.session.user = { email: String(email).trim() };
  return res.redirect(isAdmin(req.session.user) ? '/admin' : '/app');
});

// Geschützte Bereiche
app.get('/admin', requireAuth, (req, res) => {
  if (!isAdmin(req.session.user)) return res.redirect('/app');
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});
app.get('/app', requireAuth, (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'app.html'));
});

// Logout
app.post('/logout', (req, res) => { req.session = null; res.redirect(REQ_LOGIN_PATH); });

// Catch-all → Login (Express 5: app.use statt '*' Route)
app.use((req, res) => {
  console.log('[404->login]', req.method, req.originalUrl);
  return res.redirect(REQ_LOGIN_PATH);
});

// Fehler-Logging (ungefangene Fehler)
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

// Start
const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[boot] Hotel Dashboard server running on :${PORT}`);
});
