import fs from "fs"
import path from "path"
import Database from "better-sqlite3"
import config from "./config.js"

const dbPath = config.dbPath
const dir = path.dirname(dbPath)
fs.mkdirSync(dir, { recursive: true })

if (!config.isTest) {
  try {
    console.log("DB path:", dbPath)
  } catch {}
}

const db = new Database(dbPath)
db.pragma("journal_mode = WAL")
db.pragma("foreign_keys = ON")

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

CREATE TABLE IF NOT EXISTS client_product_prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  clientId INTEGER NOT NULL,
  productId INTEGER NOT NULL,
  price INTEGER NOT NULL,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  FOREIGN KEY (clientId) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE(clientId, productId)
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  orderId INTEGER NOT NULL,
  productoId INTEGER NOT NULL,
  cantidad INTEGER NOT NULL,
  precioUnitario INTEGER NOT NULL,
  subtotal INTEGER NOT NULL,
  FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (productoId) REFERENCES products(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS order_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  orderId INTEGER NOT NULL,
  monto INTEGER NOT NULL,
  metodoPago TEXT,
  nota TEXT,
  date INTEGER NOT NULL,
  userId INTEGER,
  FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS bom_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  productoTerminadoId INTEGER NOT NULL,
  materiaPrimaId INTEGER NOT NULL,
  cantidadRequerida REAL NOT NULL,
  createdAt INTEGER NOT NULL,
  FOREIGN KEY (productoTerminadoId) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (materiaPrimaId) REFERENCES products(id) ON DELETE RESTRICT,
  UNIQUE(productoTerminadoId, materiaPrimaId)
);

CREATE TABLE IF NOT EXISTS assembly_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  productoTerminadoId INTEGER NOT NULL,
  cantidadProducida INTEGER NOT NULL,
  costoTotalProduccion INTEGER NOT NULL,
  costoUnitario INTEGER NOT NULL,
  date INTEGER NOT NULL,
  userId INTEGER,
  notas TEXT,
  FOREIGN KEY (productoTerminadoId) REFERENCES products(id) ON DELETE RESTRICT,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proveedor TEXT NOT NULL,
  totalCost INTEGER NOT NULL,
  fecha INTEGER NOT NULL,
  userId INTEGER,
  notas TEXT,
  createdAt INTEGER NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchaseId INTEGER NOT NULL,
  productId INTEGER NOT NULL,
  cantidad REAL NOT NULL,
  costoUnitario INTEGER NOT NULL,
  subtotal INTEGER NOT NULL,
  FOREIGN KEY (purchaseId) REFERENCES purchases(id) ON DELETE CASCADE,
  FOREIGN KEY (productId) REFERENCES products(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS kardex_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  productId INTEGER NOT NULL,
  tipoMovimiento TEXT NOT NULL,
  cantidad REAL NOT NULL,
  unidadMedida TEXT NOT NULL,
  stockResultante REAL NOT NULL,
  referenciaId TEXT,
  userId INTEGER,
  fecha INTEGER NOT NULL,
  notas TEXT,
  FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS settings (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);
`)

try {
  db.exec("ALTER TABLE assembly_orders ADD COLUMN costoMateriales INTEGER DEFAULT 0")
} catch {}
try {
  db.exec("ALTER TABLE assembly_orders ADD COLUMN costoManoObra INTEGER DEFAULT 0")
} catch {}

db.prepare("INSERT OR IGNORE INTO settings (clave, valor) VALUES (?, ?)").run("costo_mano_obra_unitaria", "1000")

db.exec(`
CREATE INDEX IF NOT EXISTS idx_orders_createdAt ON orders(createdAt);
CREATE INDEX IF NOT EXISTS idx_orders_estado_metodo_createdAt ON orders(estado, metodoPago, createdAt);
CREATE INDEX IF NOT EXISTS idx_clients_nombre ON clients(nombre);
CREATE INDEX IF NOT EXISTS idx_products_nombre ON products(nombre);
CREATE UNIQUE INDEX IF NOT EXISTS idx_client_product_prices ON client_product_prices(clientId, productId);
CREATE INDEX IF NOT EXISTS idx_order_items_orderId ON order_items(orderId);
CREATE INDEX IF NOT EXISTS idx_order_payments_orderId ON order_payments(orderId);
CREATE INDEX IF NOT EXISTS idx_bom_items_ptId ON bom_items(productoTerminadoId);
CREATE INDEX IF NOT EXISTS idx_assembly_orders_ptId ON assembly_orders(productoTerminadoId);
`)

function fkList(table) {
  return db.prepare(`PRAGMA foreign_key_list(${table})`).all()
}

if (fkList("orders").length === 0 || fkList("order_audit").length === 0 || fkList("proformas").length === 0) {
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
  return cols.some((c) => c.name === name)
}

if (!hasColumn("products", "active")) {
  db.exec("ALTER TABLE products ADD COLUMN active INTEGER")
  db.exec("UPDATE products SET active = 1 WHERE active IS NULL")
}

if (!hasColumn("products", "tipo")) {
  db.exec("ALTER TABLE products ADD COLUMN tipo TEXT DEFAULT 'producto_terminado'")
  db.exec("UPDATE products SET tipo = 'producto_terminado' WHERE tipo IS NULL")
}

if (!hasColumn("products", "costoUnitario")) {
  db.exec("ALTER TABLE products ADD COLUMN costoUnitario INTEGER DEFAULT 0")
}

if (!hasColumn("products", "unidadMedida")) {
  db.exec("ALTER TABLE products ADD COLUMN unidadMedida TEXT DEFAULT 'unidades'")
  db.exec("UPDATE products SET unidadMedida = 'unidades' WHERE unidadMedida IS NULL")
}

const orderItemHistoricalCols = [
  { name: "precioVentaHistorico", type: "INTEGER" },
  { name: "costoMaterialesHistorico", type: "INTEGER" },
  { name: "costoManoObraHistorico", type: "INTEGER" },
  { name: "costoTotalHistorico", type: "INTEGER" },
  { name: "utilidadHistorica", type: "INTEGER" },
  { name: "margenHistorico", type: "REAL" }
]

for (const col of orderItemHistoricalCols) {
  if (!hasColumn("order_items", col.name)) {
    try {
      db.exec(`ALTER TABLE order_items ADD COLUMN ${col.name} ${col.type}`)
    } catch {}
  }
}

const orderHistoricalCols = [
  { name: "costoTotalHistorico", type: "INTEGER" },
  { name: "utilidadHistorica", type: "INTEGER" },
  { name: "margenHistorico", type: "REAL" }
]

for (const col of orderHistoricalCols) {
  if (!hasColumn("orders", col.name)) {
    try {
      db.exec(`ALTER TABLE orders ADD COLUMN ${col.name} ${col.type}`)
    } catch {}
  }
}
