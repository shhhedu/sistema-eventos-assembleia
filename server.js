const express = require('express');
const path = require('path');
const {
  all,
  get,
  initDatabase,
  normalizeName,
  run,
} = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_USER = 'admin';
const ADMIN_PASSWORD = 'admin123';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'assembleia-admin-token';
const DEFAULT_BANNER = '/assets/img/banner-eventos.jpeg';

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function cleanLongText(value) {
  return String(value || '').trim();
}

function requireAdmin(req, res, next) {
  const header = req.get('Authorization') || '';
  const token = header.replace(/^Bearer\s+/i, '').trim();

  if (token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Acesso administrativo nao autorizado.' });
  }

  return next();
}

function validateEventPayload(body) {
  const evento = {
    titulo: cleanText(body.titulo),
    descricao: cleanLongText(body.descricao),
    data: cleanText(body.data),
    horario: cleanText(body.horario),
    local: cleanText(body.local),
    banner: cleanText(body.banner) || DEFAULT_BANNER,
  };

  if (!evento.titulo || !evento.descricao || !evento.data || !evento.horario || !evento.local) {
    return { error: 'Preencha titulo, descricao, data, horario e local.' };
  }

  return { evento };
}

app.get('/api/eventos', (req, res) => {
  const eventos = all('SELECT * FROM eventos ORDER BY data ASC, horario ASC, id ASC');
  res.json(eventos);
});

app.get('/api/eventos/:id', (req, res) => {
  const evento = get('SELECT * FROM eventos WHERE id = ?', [Number(req.params.id)]);

  if (!evento) {
    return res.status(404).json({ error: 'Evento nao encontrado.' });
  }

  return res.json(evento);
});

app.post('/api/presencas', (req, res) => {
  const eventoId = Number(req.body.eventoId);
  const nome = cleanText(req.body.nome);
  const telefone = cleanText(req.body.telefone);

  if (!eventoId || !nome) {
    return res.status(400).json({ error: 'Informe o evento e o nome completo.' });
  }

  const evento = get('SELECT id FROM eventos WHERE id = ?', [eventoId]);
  if (!evento) {
    return res.status(404).json({ error: 'Evento nao encontrado.' });
  }

  const nomeNormalizado = normalizeName(nome);
  const presencas = all('SELECT nome FROM presencas WHERE eventoId = ?', [eventoId]);
  const duplicado = presencas.some((presenca) => normalizeName(presenca.nome) === nomeNormalizado);

  if (duplicado) {
    return res.status(409).json({ error: 'Este nome ja confirmou presenca neste evento.' });
  }

  const dataConfirmacao = new Date().toISOString();
  const result = run(
    `INSERT INTO presencas (eventoId, nome, telefone, dataConfirmacao)
     VALUES (?, ?, ?, ?)`,
    [eventoId, nome, telefone, dataConfirmacao],
  );

  return res.status(201).json({
    id: result.id,
    eventoId,
    nome,
    telefone,
    dataConfirmacao,
  });
});

app.post('/api/admin/login', (req, res) => {
  const usuario = cleanText(req.body.usuario);
  const senha = String(req.body.senha || '');

  if (usuario === ADMIN_USER && senha === ADMIN_PASSWORD) {
    return res.json({ token: ADMIN_TOKEN, usuario: ADMIN_USER });
  }

  return res.status(401).json({ error: 'Usuario ou senha invalidos.' });
});

app.post('/api/admin/eventos', requireAdmin, (req, res) => {
  const { evento, error } = validateEventPayload(req.body);

  if (error) {
    return res.status(400).json({ error });
  }

  const result = run(
    `INSERT INTO eventos (titulo, descricao, data, horario, local, banner)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [evento.titulo, evento.descricao, evento.data, evento.horario, evento.local, evento.banner],
  );

  return res.status(201).json({ id: result.id, ...evento });
});

app.put('/api/admin/eventos/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const atual = get('SELECT id FROM eventos WHERE id = ?', [id]);

  if (!atual) {
    return res.status(404).json({ error: 'Evento nao encontrado.' });
  }

  const { evento, error } = validateEventPayload(req.body);

  if (error) {
    return res.status(400).json({ error });
  }

  run(
    `UPDATE eventos
     SET titulo = ?, descricao = ?, data = ?, horario = ?, local = ?, banner = ?
     WHERE id = ?`,
    [evento.titulo, evento.descricao, evento.data, evento.horario, evento.local, evento.banner, id],
  );

  return res.json({ id, ...evento });
});

app.delete('/api/admin/eventos/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const atual = get('SELECT id FROM eventos WHERE id = ?', [id]);

  if (!atual) {
    return res.status(404).json({ error: 'Evento nao encontrado.' });
  }

  run('DELETE FROM eventos WHERE id = ?', [id]);
  return res.json({ ok: true });
});

app.get('/api/admin/eventos/:id/presencas', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const evento = get('SELECT * FROM eventos WHERE id = ?', [id]);

  if (!evento) {
    return res.status(404).json({ error: 'Evento nao encontrado.' });
  }

  const presencas = all(
    'SELECT id, nome, telefone, dataConfirmacao FROM presencas WHERE eventoId = ? ORDER BY dataConfirmacao ASC',
    [id],
  );

  return res.json({
    evento,
    total: presencas.length,
    presencas,
  });
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Rota nao encontrada.' });
});

initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Sistema de Eventos rodando em http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Erro ao inicializar a aplicacao:', error);
    process.exit(1);
  });
