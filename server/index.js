const express = require('express');
const helmet = require('helmet');
const cookieSession = require('cookie-session');
const path = require('path');

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false, frameguard: { action: 'sameorigin' } }));
app.use(express.urlencoded({ extended: true }));

const sessionSecret = process.env.SESSION_SECRET || 'dev-secret-change-me';
app.use(cookieSession({
  name: 'hd_sess',
  keys: [sessionSecret],
  httpOnly: true,
  sameSite: 'lax',
  secure: !!process.env.RENDER,
  maxAge: 8 * 60 * 60 * 1000,
}));

// *** STATIC vor allen Routen ***
const pub = path.join(__dirname, '..', 'public');
app.use('/assets', express.static(path.join(pub, 'assets')));
app.use(express.static(pub));

app.get('/healthz', (_req, res) => res.type('text').send('ok'));
app.get('/login',  (_req, res) => res.sendFile(path.join(pub, 'login.html')));

app.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = (email || '').toLowerCase().trim();
  const pass = (password || '').trim();
  if (user === 'user@test.de'  && pass === 'Test12345!') return res.redirect('/app');
  if (user === 'admin@hotel-dashboard.de' && pass === 'Test12345!') return res.redirect('/admin');
  return res.status(400).send('<h1>Login fehlgeschlagen</h1><a href="/login">Zurück</a>');
});

function mustUser(req, res, next){ return req.session?.user ? next() : res.redirect('/login'); }
app.get('/app',   mustUser, (_req,res)=>res.sendFile(path.join(pub, 'app.html')));
app.get('/admin', mustUser, (_req,res)=>res.sendFile(path.join(pub, 'admin.html')));

app.use((_req,res)=>res.redirect('/login'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log(`Hotel Dashboard server running on :${PORT}`));
// trigger redeploy Mi 8. Okt 18:31:33 CEST 2025
