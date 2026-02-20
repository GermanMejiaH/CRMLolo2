import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Database from 'better-sqlite3'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
let dbPath = ""
const envDbPath = process.env.DB_PATH && String(process.env.DB_PATH).trim()
const envStorageDir = process.env.STORAGE_DIR && String(process.env.STORAGE_DIR).trim()
if (envDbPath) {
  const dir = path.dirname(envDbPath)
  fs.mkdirSync(dir, { recursive: true })
  dbPath = envDbPath
} else {
  const storageRoot = envStorageDir || path.join(__dirname, '..', 'storage')
  fs.mkdirSync(storageRoot, { recursive: true })
  dbPath = path.join(storageRoot, 'data.db')
}

try { console.log("DB path:", dbPath) } catch {}

const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  passwordHash TEXT NOT NULL,
  role TEXT NOT NULL,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  contacto TEXT,
  telefono TEXT,
  email TEXT,
  direccion TEXT,
  precioPersonalizado INTEGER,
  notas TEXT,
  createdAt INTEGER NOT NULL,
  active INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  precioMinimo INTEGER,
  precioMaximo INTEGER,
  stockActual INTEGER,
  stockMinimo INTEGER,
  updatedAt INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  productId INTEGER NOT NULL,
  diff INTEGER NOT NULL,
  reason TEXT,
  ref TEXT,
  userId INTEGER,
  date INTEGER NOT NULL,
  type TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  clienteId INTEGER NOT NULL,
  productoId INTEGER NOT NULL,
  cantidad INTEGER NOT NULL,
  precioUnitario INTEGER NOT NULL,
  total INTEGER NOT NULL,
  estado TEXT NOT NULL,
  metodoPago TEXT,
  notas TEXT,
  createdAt INTEGER NOT NULL,
  FOREIGN KEY (clienteId) REFERENCES clients(id) ON DELETE RESTRICT,
  FOREIGN KEY (productoId) REFERENCES products(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS order_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  orderId INTEGER NOT NULL,
  userId INTEGER,
  date INTEGER NOT NULL,
  observation TEXT,
  FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS proformas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pedidoId INTEGER NOT NULL,
  clienteId INTEGER NOT NULL,
  total INTEGER NOT NULL,
  url TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  FOREIGN KEY (pedidoId) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (clienteId) REFERENCES clients(id) ON DELETE RESTRICT
);
`)

db.exec(`
CREATE INDEX IF NOT EXISTS idx_orders_createdAt ON orders(createdAt);
CREATE INDEX IF NOT EXISTS idx_orders_estado_metodo_createdAt ON orders(estado, metodoPago, createdAt);
CREATE INDEX IF NOT EXISTS idx_clients_nombre ON clients(nombre);
CREATE INDEX IF NOT EXISTS idx_products_nombre ON products(nombre);
`)

function fkList(table) {
  return db.prepare(`PRAGMA foreign_key_list(${table})`).all()
}

if (fkList('orders').length === 0 || fkList('order_audit').length === 0 || fkList('proformas').length === 0) {
  const migrate = db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS orders_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        clienteId INTEGER NOT NULL,
        productoId INTEGER NOT NULL,
        cantidad INTEGER NOT NULL,
        precioUnitario INTEGER NOT NULL,
        total INTEGER NOT NULL,
        estado TEXT NOT NULL,
        metodoPago TEXT,
        notas TEXT,
        createdAt INTEGER NOT NULL,
        FOREIGN KEY (clienteId) REFERENCES clients(id) ON DELETE RESTRICT,
        FOREIGN KEY (productoId) REFERENCES products(id) ON DELETE RESTRICT
      );
    `)
    db.exec(`INSERT INTO orders_new (id, clienteId, productoId, cantidad, precioUnitario, total, estado, metodoPago, notas, createdAt)
             SELECT id, clienteId, productoId, cantidad, precioUnitario, total, estado, metodoPago, notas, createdAt FROM orders`)
    db.exec(`DROP TABLE orders`)
    db.exec(`ALTER TABLE orders_new RENAME TO orders`)

    db.exec(`
      CREATE TABLE IF NOT EXISTS order_audit_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        orderId INTEGER NOT NULL,
        userId INTEGER,
        date INTEGER NOT NULL,
        observation TEXT,
        FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
      );
    `)
    db.exec(`INSERT INTO order_audit_new (id, orderId, userId, date, observation)
             SELECT id, orderId, userId, date, observation FROM order_audit`)
    db.exec(`DROP TABLE order_audit`)
    db.exec(`ALTER TABLE order_audit_new RENAME TO order_audit`)

    db.exec(`
      CREATE TABLE IF NOT EXISTS proformas_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pedidoId INTEGER NOT NULL,
        clienteId INTEGER NOT NULL,
        total INTEGER NOT NULL,
        url TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        FOREIGN KEY (pedidoId) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (clienteId) REFERENCES clients(id) ON DELETE RESTRICT
      );
    `)
    db.exec(`INSERT INTO proformas_new (id, pedidoId, clienteId, total, url, createdAt)
             SELECT id, pedidoId, clienteId, total, url, createdAt FROM proformas`)
    db.exec(`DROP TABLE proformas`)
    db.exec(`ALTER TABLE proformas_new RENAME TO proformas`)

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_orders_createdAt ON orders(createdAt);
      CREATE INDEX IF NOT EXISTS idx_orders_estado_metodo_createdAt ON orders(estado, metodoPago, createdAt);
      CREATE INDEX IF NOT EXISTS idx_clients_nombre ON clients(nombre);
      CREATE INDEX IF NOT EXISTS idx_products_nombre ON products(nombre);
    `)
  })
  migrate()
}

export default db
function hasColumn(table, name) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all()
  return cols.some(c => c.name === name)
}

if (!hasColumn('products', 'active')) {
  db.exec("ALTER TABLE products ADD COLUMN active INTEGER")
  db.exec("UPDATE products SET active = 1 WHERE active IS NULL")
}
