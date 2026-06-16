const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const dbPath = path.join(__dirname, 'eventos.db');
let database;

function normalizeName(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pt-BR');
}

function requireDatabase() {
  if (!database) {
    throw new Error('Banco de dados ainda nao foi inicializado.');
  }

  return database;
}

function persist() {
  const db = requireDatabase();
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

function all(sql, params = []) {
  const db = requireDatabase();
  const stmt = db.prepare(sql);
  const rows = [];

  try {
    stmt.bind(params);
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
  } finally {
    stmt.free();
  }

  return rows;
}

function get(sql, params = []) {
  return all(sql, params)[0] || null;
}

function run(sql, params = []) {
  const db = requireDatabase();
  db.run(sql, params);

  const changes = db.getRowsModified();
  const inserted = /^\s*insert/i.test(sql);
  const id = inserted ? get('SELECT last_insert_rowid() AS id').id : null;

  persist();
  return { id, changes };
}

function hasColumn(table, column) {
  return all(`PRAGMA table_info(${table})`).some((item) => item.name === column);
}

function defaultEndTime(horario) {
  const match = String(horario || '').match(/^(\d{2}):(\d{2})$/);

  if (!match) {
    return '23:59';
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const total = Math.min(hours * 60 + minutes + 120, 23 * 60 + 59);
  const endHours = String(Math.floor(total / 60)).padStart(2, '0');
  const endMinutes = String(total % 60).padStart(2, '0');

  return `${endHours}:${endMinutes}`;
}

async function initDatabase() {
  const SQL = await initSqlJs({
    locateFile: (file) => path.join(__dirname, 'node_modules', 'sql.js', 'dist', file),
  });

  if (fs.existsSync(dbPath)) {
    database = new SQL.Database(fs.readFileSync(dbPath));
  } else {
    database = new SQL.Database();
  }

  database.run('PRAGMA foreign_keys = ON');

  database.run(`
    CREATE TABLE IF NOT EXISTS eventos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo TEXT NOT NULL,
      descricao TEXT NOT NULL,
      data TEXT NOT NULL,
      horario TEXT NOT NULL,
      horarioFim TEXT NOT NULL DEFAULT '23:59',
      local TEXT NOT NULL,
      banner TEXT NOT NULL
    );
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS presencas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      eventoId INTEGER NOT NULL,
      nome TEXT NOT NULL,
      telefone TEXT,
      dataConfirmacao TEXT NOT NULL,
      FOREIGN KEY (eventoId) REFERENCES eventos(id) ON DELETE CASCADE
    );
  `);

  database.run('CREATE INDEX IF NOT EXISTS idx_presencas_evento ON presencas(eventoId);');

  if (!hasColumn('eventos', 'horarioFim')) {
    database.run("ALTER TABLE eventos ADD COLUMN horarioFim TEXT NOT NULL DEFAULT '23:59'");
    all('SELECT id, horario FROM eventos').forEach((evento) => {
      database.run('UPDATE eventos SET horarioFim = ? WHERE id = ?', [defaultEndTime(evento.horario), evento.id]);
    });
  }

  const total = get('SELECT COUNT(*) AS total FROM eventos').total;

  if (total === 0) {
    const eventos = [
      {
        titulo: 'Culto da Familia',
        data: '2026-06-21',
        horario: '19:30',
        horarioFim: '21:30',
        local: 'Templo Sede',
        banner: '/assets/img/banner-culto-familia.jpeg',
        descricao:
          'Uma noite especial para toda a familia na presenca de Deus, com louvores, oracao e uma palavra edificante.',
      },
      {
        titulo: 'Escola Biblica Dominical',
        data: '2026-06-28',
        horario: '09:00',
        horarioFim: '11:00',
        local: 'Salas da Escola Biblica',
        banner: '/assets/img/banner-eventos.jpeg',
        descricao:
          'Encontro de estudo da Palavra para crescimento espiritual, comunhao e aprendizado em familia.',
      },
      {
        titulo: 'Culto de Jovens',
        data: '2026-07-05',
        horario: '18:00',
        horarioFim: '20:00',
        local: 'Templo Sede',
        banner: '/assets/img/banner-eventos.jpeg',
        descricao:
          'Culto voltado para jovens, com louvor, testemunhos, comunhao e mensagem para fortalecer a fe.',
      },
    ];

    eventos.forEach((evento) => {
      database.run(
        `INSERT INTO eventos (titulo, descricao, data, horario, horarioFim, local, banner)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          evento.titulo,
          evento.descricao,
          evento.data,
          evento.horario,
          evento.horarioFim,
          evento.local,
          evento.banner,
        ],
      );
    });
  }

  persist();
}

module.exports = {
  all,
  get,
  initDatabase,
  normalizeName,
  run,
};
