const express = require('express');
const fs = require('fs');
const multer = require('multer');
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
const EVENT_UPLOAD_DIR = path.join(__dirname, 'public', 'assets', 'uploads', 'eventos');
const PUBLIC_EVENT_UPLOAD_PATH = '/assets/uploads/eventos';
const ALLOWED_BANNER_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const ALLOWED_BANNER_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

fs.mkdirSync(EVENT_UPLOAD_DIR, { recursive: true });

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function cleanLongText(value) {
  return String(value || '').trim();
}

function isDateValue(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) {
    return false;
  }

  return !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
}

function isTimeValue(value) {
  const match = String(value || '').match(/^(\d{2}):(\d{2})$/);

  if (!match) {
    return false;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

function eventDateTime(data, horario) {
  return `${data}T${horario}:00`;
}

function eventWindow(evento) {
  const horarioFim = evento.horarioFim || '23:59';
  const dataHoraInicio = eventDateTime(evento.data, evento.horario);
  const dataHoraFim = eventDateTime(evento.data, horarioFim);

  return {
    dataHoraInicio,
    dataHoraFim,
    inicio: new Date(dataHoraInicio),
    fim: new Date(dataHoraFim),
    horarioFim,
  };
}

function orderCode(id) {
  return `#${String(id).padStart(4, '0')}`;
}

function eventAvailability(evento, now = new Date()) {
  const { inicio, fim } = eventWindow(evento);

  if (now > fim) {
    return {
      arquivado: true,
      presencaDisponivel: false,
      status: 'Arquivado',
      mensagemPresenca: 'Este evento já foi encerrado.',
    };
  }

  if (now < inicio) {
    return {
      arquivado: false,
      presencaDisponivel: false,
      status: 'Ativo',
      mensagemPresenca: 'O evento ainda não começou.',
    };
  }

  return {
    arquivado: false,
    presencaDisponivel: true,
    status: 'Em Andamento',
    mensagemPresenca: '',
  };
}

function decorateEvent(evento) {
  const window = eventWindow(evento);
  const availability = eventAvailability(evento);

  return {
    ...evento,
    horarioFim: window.horarioFim,
    codigoOrdem: orderCode(evento.id),
    dataHoraInicio: window.dataHoraInicio,
    dataHoraFim: window.dataHoraFim,
    ...availability,
  };
}

function sortEventsByDate(eventos) {
  return eventos.sort((a, b) => {
    const dateDiff = new Date(a.dataHoraInicio) - new Date(b.dataHoraInicio);

    if (dateDiff !== 0) {
      return dateDiff;
    }

    return a.id - b.id;
  });
}

function loadEvents() {
  return sortEventsByDate(all('SELECT * FROM eventos').map(decorateEvent));
}

function sanitizeFileName(value) {
  return String(value || 'banner')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70) || 'banner';
}

const bannerStorage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, EVENT_UPLOAD_DIR);
  },
  filename: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const basename = sanitizeFileName(path.basename(file.originalname, extension));
    const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    callback(null, `${basename}-${suffix}${extension}`);
  },
});

const uploadBanner = multer({
  storage: bannerStorage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();

    if (!ALLOWED_BANNER_EXTENSIONS.has(extension) || !ALLOWED_BANNER_MIMES.has(file.mimetype)) {
      callback(new Error('Envie uma imagem JPG, JPEG, PNG ou WEBP para o banner.'));
      return;
    }

    callback(null, true);
  },
}).single('bannerArquivo');

function parseEventUpload(req, res, next) {
  uploadBanner(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'O banner deve ter no maximo 5 MB.' });
    }

    return res.status(400).json({ error: error.message || 'Nao foi possivel enviar o banner.' });
  });
}

function uploadedBannerPath(file) {
  return file ? `${PUBLIC_EVENT_UPLOAD_PATH}/${file.filename}` : '';
}

function removeUploadedFile(file) {
  if (!file) {
    return;
  }

  fs.unlink(file.path, (error) => {
    if (error && error.code !== 'ENOENT') {
      console.error('Erro ao remover upload descartado:', error);
    }
  });
}

function formatBrazilianPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');

  if (!digits) {
    return { telefone: '' };
  }

  if (digits.length > 11 || digits.length < 10) {
    return { error: 'Informe um telefone brasileiro com DDD, usando 10 ou 11 numeros.' };
  }

  if (digits.length === 11) {
    return {
      telefone: `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`,
    };
  }

  return {
    telefone: `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`,
  };
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
    horarioFim: cleanText(body.horarioFim || body.horarioFinal || body.horarioTermino),
    local: cleanText(body.local),
    banner: cleanText(body.banner),
  };

  if (
    !evento.titulo ||
    !evento.descricao ||
    !evento.data ||
    !evento.horario ||
    !evento.horarioFim ||
    !evento.local
  ) {
    return { error: 'Preencha titulo, descricao, data, horario inicial, horario final e local.' };
  }

  if (!isDateValue(evento.data) || !isTimeValue(evento.horario) || !isTimeValue(evento.horarioFim)) {
    return { error: 'Informe uma data e horarios validos para o evento.' };
  }

  const { inicio, fim } = eventWindow(evento);

  if (fim <= inicio) {
    return { error: 'O horario final deve ser posterior ao horario inicial.' };
  }

  return { evento };
}

app.get('/api/eventos', (req, res) => {
  const eventos = loadEvents().filter((evento) => !evento.arquivado);
  res.json(eventos);
});

app.get('/api/eventos/:id', (req, res) => {
  const row = get('SELECT * FROM eventos WHERE id = ?', [Number(req.params.id)]);

  if (!row) {
    return res.status(404).json({ error: 'Evento nao encontrado.' });
  }

  const evento = decorateEvent(row);

  if (evento.arquivado) {
    return res.status(410).json({ error: 'Este evento já foi encerrado.' });
  }

  return res.json(evento);
});

app.post('/api/presencas', (req, res) => {
  const eventoId = Number(req.body.eventoId);
  const nome = cleanText(req.body.nome);
  const telefoneFormatado = formatBrazilianPhone(req.body.telefone);

  if (telefoneFormatado.error) {
    return res.status(400).json({ error: telefoneFormatado.error });
  }

  const telefone = telefoneFormatado.telefone;

  if (!eventoId || !nome) {
    return res.status(400).json({ error: 'Informe o evento e o nome completo.' });
  }

  const row = get('SELECT * FROM eventos WHERE id = ?', [eventoId]);
  if (!row) {
    return res.status(404).json({ error: 'Evento nao encontrado.' });
  }

  const evento = decorateEvent(row);

  if (!evento.presencaDisponivel) {
    return res.status(evento.arquivado ? 410 : 403).json({ error: evento.mensagemPresenca });
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

app.get('/api/admin/eventos', requireAdmin, (req, res) => {
  res.json(loadEvents());
});

app.get('/api/admin/eventos/:id', requireAdmin, (req, res) => {
  const evento = get('SELECT * FROM eventos WHERE id = ?', [Number(req.params.id)]);

  if (!evento) {
    return res.status(404).json({ error: 'Evento nao encontrado.' });
  }

  return res.json(decorateEvent(evento));
});

app.post('/api/admin/eventos', requireAdmin, parseEventUpload, (req, res) => {
  const { evento, error } = validateEventPayload(req.body);

  if (error) {
    removeUploadedFile(req.file);
    return res.status(400).json({ error });
  }

  const banner = uploadedBannerPath(req.file) || evento.banner;
  const result = run(
    `INSERT INTO eventos (titulo, descricao, data, horario, horarioFim, local, banner)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [evento.titulo, evento.descricao, evento.data, evento.horario, evento.horarioFim, evento.local, banner],
  );

  return res.status(201).json(decorateEvent({ id: result.id, ...evento, banner }));
});

app.put('/api/admin/eventos/:id', requireAdmin, parseEventUpload, (req, res) => {
  const id = Number(req.params.id);
  const atual = get('SELECT id FROM eventos WHERE id = ?', [id]);

  if (!atual) {
    removeUploadedFile(req.file);
    return res.status(404).json({ error: 'Evento nao encontrado.' });
  }

  const { evento, error } = validateEventPayload(req.body);

  if (error) {
    removeUploadedFile(req.file);
    return res.status(400).json({ error });
  }

  const banner = uploadedBannerPath(req.file) || evento.banner;

  run(
    `UPDATE eventos
     SET titulo = ?, descricao = ?, data = ?, horario = ?, horarioFim = ?, local = ?, banner = ?
     WHERE id = ?`,
    [evento.titulo, evento.descricao, evento.data, evento.horario, evento.horarioFim, evento.local, banner, id],
  );

  return res.json(decorateEvent({ id, ...evento, banner }));
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
    evento: decorateEvent(evento),
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
