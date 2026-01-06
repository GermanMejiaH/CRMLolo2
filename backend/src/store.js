import db from "./db.js"

const payments = ["Efectivo", "Transferencia", "Tarjeta"]
const orderStates = ["Pendiente", "Completado", "Cancelado"]

const seedUser = db.prepare("SELECT COUNT(1) as c FROM users").get()
if (seedUser.c === 0) {
  db.prepare("INSERT INTO users (email, passwordHash, role, name) VALUES (?,?,?,?)").run("admin@lolo", "plain:admin123", "Admin", "Admin")
}

const seedClients = db.prepare("SELECT COUNT(1) as c FROM clients").get()
if (seedClients.c === 0) {
  addClient({ nombre: "Moto Repuestos SAS", contacto: "Carlos Rodríguez", telefono: "+57 300 123 4567", email: "carlos@motorepuestos.com", direccion: "Calle 45 #23-12, Medellín", precioPersonalizado: 42000, notas: "Cliente preferencial" })
  addClient({ nombre: "Auto Express", contacto: "María González", telefono: "+57 301 234 5678", email: "maria@autoexpress.co", direccion: "Carrera 70 #45-89, Medellín", precioPersonalizado: 38000, notas: "" })
  addClient({ nombre: "Distribuidora Central", contacto: "Juan Pérez", telefono: "+57 302 345 6789", email: "juan@distcentral.com", direccion: "Avenida 80 #30-25, Medellín", precioPersonalizado: 45000, notas: "Factura electrónica" })
}

const seedProducts = db.prepare("SELECT COUNT(1) as c FROM products").get()
if (seedProducts.c === 0) {
  addProduct({ nombre: "Módulo XR-2000", descripcion: "Módulo avanzado", precioMinimo: 25000, precioMaximo: 45000, stockActual: 15, stockMinimo: 10 })
  addProduct({ nombre: "Estacionaria Pro", descripcion: "Equipo industrial", precioMinimo: 30000, precioMaximo: 50000, stockActual: 5, stockMinimo: 8 })
  addProduct({ nombre: "Kit Básico M1", descripcion: "Kit de inicio", precioMinimo: 25000, precioMaximo: 40000, stockActual: 25, stockMinimo: 12 })
}

function listClients(filters = {}) {
  const { q, email, minPrecio, maxPrecio, limit, offset, includeInactive = false } = filters
  let sql = "SELECT * FROM clients WHERE 1=1"
  const params = []
  if (!includeInactive) { sql += " AND (active = 1 OR active IS NULL)" }
  if (q) { sql += " AND lower(nombre) LIKE ?"; params.push(`%${String(q).toLowerCase()}%`) }
  if (email) { sql += " AND email = ?"; params.push(email) }
  if (minPrecio) { sql += " AND (precioPersonalizado IS NOT NULL AND precioPersonalizado >= ?)"; params.push(Number(minPrecio)) }
  if (maxPrecio) { sql += " AND (precioPersonalizado IS NOT NULL AND precioPersonalizado <= ?)"; params.push(Number(maxPrecio)) }
  if (typeof limit === "number" && typeof offset === "number") { sql += " LIMIT ? OFFSET ?"; params.push(Number(limit), Number(offset)) }
  return db.prepare(sql).all(...params)
}

function countClients(filters = {}) {
  const { q, email, minPrecio, maxPrecio, includeInactive = false } = filters
  let sql = "SELECT COUNT(1) as c FROM clients WHERE 1=1"
  const params = []
  if (!includeInactive) { sql += " AND (active = 1 OR active IS NULL)" }
  if (q) { sql += " AND lower(nombre) LIKE ?"; params.push(`%${String(q).toLowerCase()}%`) }
  if (email) { sql += " AND email = ?"; params.push(email) }
  if (minPrecio) { sql += " AND (precioPersonalizado IS NOT NULL AND precioPersonalizado >= ?)"; params.push(Number(minPrecio)) }
  if (maxPrecio) { sql += " AND (precioPersonalizado IS NOT NULL AND precioPersonalizado <= ?)"; params.push(Number(maxPrecio)) }
  const row = db.prepare(sql).get(...params)
  return Number(row.c || 0)
}

function addClient(data) {
  const createdAt = Date.now()
  const active = 1
  const stmt = db.prepare("INSERT INTO clients (nombre, contacto, telefono, email, direccion, precioPersonalizado, notas, createdAt, active) VALUES (?,?,?,?,?,?,?,?,?)")
  const info = stmt.run(data.nombre, data.contacto || null, data.telefono || null, data.email || null, data.direccion || null, data.precioPersonalizado ?? null, data.notas || null, createdAt, active)
  return db.prepare("SELECT * FROM clients WHERE id = ?").get(info.lastInsertRowid)
}

function updateClient(id, data) {
  const current = db.prepare("SELECT * FROM clients WHERE id = ?").get(id)
  if (!current) return null
  const updated = { ...current, ...data }
  const precio = updated.precioPersonalizado == null || updated.precioPersonalizado === "" ? null : Number(updated.precioPersonalizado)
  const activeVal = updated.active == null ? (current.active ?? 1) : (updated.active ? 1 : 0)
  db.prepare("UPDATE clients SET nombre=?, contacto=?, telefono=?, email=?, direccion=?, precioPersonalizado=?, notas=?, active=? WHERE id=?").run(
    updated.nombre,
    updated.contacto ?? null,
    updated.telefono ?? null,
    updated.email ?? null,
    updated.direccion ?? null,
    precio,
    updated.notas ?? null,
    activeVal,
    id
  )
  return db.prepare("SELECT * FROM clients WHERE id = ?").get(id)
}

function listProducts(filters = {}) {
  const { q, limit, offset, includeInactive = false } = filters
  let sql = "SELECT * FROM products WHERE 1=1"
  const params = []
  if (!includeInactive) { sql += " AND (active = 1 OR active IS NULL)" }
  if (q) { sql += " AND lower(nombre) LIKE ?"; params.push(`%${String(q).toLowerCase()}%`) }
  if (typeof limit === "number" && typeof offset === "number") { sql += " LIMIT ? OFFSET ?"; params.push(Number(limit), Number(offset)) }
  return db.prepare(sql).all(...params)
}

function countProducts(filters = {}) {
  const { q, includeInactive = false } = filters
  let sql = "SELECT COUNT(1) as c FROM products WHERE 1=1"
  const params = []
  if (!includeInactive) { sql += " AND (active = 1 OR active IS NULL)" }
  if (q) { sql += " AND lower(nombre) LIKE ?"; params.push(`%${String(q).toLowerCase()}%`) }
  const row = db.prepare(sql).get(...params)
  return Number(row.c || 0)
}

function addProduct(data) {
  const updatedAt = Date.now()
  const stmt = db.prepare("INSERT INTO products (nombre, descripcion, precioMinimo, precioMaximo, stockActual, stockMinimo, updatedAt) VALUES (?,?,?,?,?,?,?)")
  const info = stmt.run(data.nombre, data.descripcion || null, Number(data.precioMinimo || 0), Number(data.precioMaximo || 0), Number(data.stockActual || 0), Number(data.stockMinimo || 0), updatedAt)
  return db.prepare("SELECT * FROM products WHERE id = ?").get(info.lastInsertRowid)
}

function getProduct(id) { return db.prepare("SELECT * FROM products WHERE id = ?").get(id) }
function getClient(id) { return db.prepare("SELECT * FROM clients WHERE id = ?").get(id) }

function adjustStock(productId, diff, reason, ref, userId) {
  const p = getProduct(productId)
  if (!p) return null
  const newStock = Number(p.stockActual || 0) + Number(diff)
  db.prepare("UPDATE products SET stockActual=?, updatedAt=? WHERE id=?").run(newStock, Date.now(), productId)
  const type = diff >= 0 ? "entrada" : "salida"
  db.prepare("INSERT INTO stock_movements (productId, diff, reason, ref, userId, date, type) VALUES (?,?,?,?,?,?,?)").run(productId, diff, reason || null, ref || null, userId || null, Date.now(), type)
  return getProduct(productId)
}

function updateProduct(id, data) {
  const current = getProduct(id)
  if (!current) return null
  const updated = { ...current, ...data, updatedAt: Date.now() }
  db.prepare("UPDATE products SET nombre=?, descripcion=?, precioMinimo=?, precioMaximo=?, stockActual=?, stockMinimo=?, updatedAt=?, active=? WHERE id=?").run(
    updated.nombre,
    updated.descripcion,
    Number(updated.precioMinimo || 0),
    Number(updated.precioMaximo || 0),
    Number(updated.stockActual || 0),
    Number(updated.stockMinimo || 0),
    updated.updatedAt,
    updated.active == null ? current.active ?? 1 : Number(updated.active ? 1 : 0),
    id
  )
  return getProduct(id)
}

function deleteProduct(id) {
  const hasOrders = db.prepare("SELECT 1 FROM orders WHERE productoId = ? LIMIT 1").get(id)
  if (hasOrders) {
    throw new Error("No se puede eliminar: el producto tiene pedidos asociados")
  }
  const deleteMovements = db.prepare("DELETE FROM stock_movements WHERE productId = ?")
  const deleteProd = db.prepare("DELETE FROM products WHERE id = ?")
  
  const transaction = db.transaction(() => {
    deleteMovements.run(id)
    deleteProd.run(id)
  })
  
  return transaction()
}

function listStockMovements(productId, { limit = 20, offset = 0 } = {}) {
  return db.prepare("SELECT * FROM stock_movements WHERE productId = ? ORDER BY date DESC LIMIT ? OFFSET ?").all(productId, Number(limit), Number(offset))
}

function listStockMovementsDetailed(productId, { limit = 20, offset = 0 } = {}) {
  const sql = `
    SELECT sm.id, sm.productId, sm.diff, sm.reason, sm.ref, sm.userId, sm.date, sm.type,
           u.name as userName
    FROM stock_movements sm
    LEFT JOIN users u ON u.id = sm.userId
    WHERE sm.productId = ?
    ORDER BY sm.date DESC
    LIMIT ? OFFSET ?`
  return db.prepare(sql).all(productId, Number(limit), Number(offset))
}

function countStockMovements(productId) {
  const row = db.prepare("SELECT COUNT(1) as c FROM stock_movements WHERE productId = ?").get(productId)
  return Number(row.c || 0)
}

function listOrders(filters = {}) {
  const { cliente, estado, from, to, metodoPago } = filters
  let sql = "SELECT * FROM orders WHERE 1=1"
  const params = []
  if (cliente) { sql += " AND clienteId = ?"; params.push(Number(cliente)) }
  if (estado) { sql += " AND estado = ?"; params.push(String(estado)) }
  if (typeof from === "number") { sql += " AND createdAt >= ?"; params.push(Number(from)) }
  if (typeof to === "number") { sql += " AND createdAt <= ?"; params.push(Number(to)) }
  if (metodoPago) { sql += " AND metodoPago = ?"; params.push(String(metodoPago)) }
  return db.prepare(sql).all(...params)
}

function listOrdersWithNames(filters = {}) {
  const { cliente, estado, from, to, metodoPago } = filters
  let sql = `
    SELECT o.*, c.nombre AS clienteNombre, p.nombre AS productoNombre
    FROM orders o
    LEFT JOIN clients c ON c.id = o.clienteId
    LEFT JOIN products p ON p.id = o.productoId
    WHERE 1=1`
  const params = []
  if (cliente) { sql += " AND o.clienteId = ?"; params.push(Number(cliente)) }
  if (estado) { sql += " AND o.estado = ?"; params.push(String(estado)) }
  if (typeof from === "number") { sql += " AND o.createdAt >= ?"; params.push(Number(from)) }
  if (typeof to === "number") { sql += " AND o.createdAt <= ?"; params.push(Number(to)) }
  if (metodoPago) { sql += " AND o.metodoPago = ?"; params.push(String(metodoPago)) }
  return db.prepare(sql).all(...params)
}

function listSalesSeries(filters = {}) {
  const { from, to, estado, metodoPago, granularity = "day", breakdown } = filters
  const bucketExpr = granularity === "month"
    ? "strftime('%Y-%m', datetime(createdAt/1000,'unixepoch'))"
    : "date(datetime(createdAt/1000,'unixepoch'))"
  let select = `${bucketExpr} as bucket, SUM(total) as total`
  if (breakdown === "payment") {
    for (const m of payments) {
      const col = m.replace(/[^A-Za-z0-9_]/g, "_")
      select += `, SUM(CASE WHEN metodoPago = '${m}' THEN total ELSE 0 END) as ${col}`
    }
  }
  let sql = `SELECT ${select} FROM orders WHERE 1=1`
  const params = []
  if (typeof from === "number") { sql += " AND createdAt >= ?"; params.push(Number(from)) }
  if (typeof to === "number") { sql += " AND createdAt <= ?"; params.push(Number(to)) }
  if (estado) { sql += " AND estado = ?"; params.push(String(estado)) }
  if (metodoPago) { sql += " AND metodoPago = ?"; params.push(String(metodoPago)) }
  sql += " GROUP BY bucket ORDER BY bucket"
  return db.prepare(sql).all(...params)
}

function getOrder(id) { return db.prepare("SELECT * FROM orders WHERE id = ?").get(id) }

function addOrder(data) {
  const createdAt = Date.now()
  const stmt = db.prepare("INSERT INTO orders (clienteId, productoId, cantidad, precioUnitario, total, estado, metodoPago, notas, createdAt) VALUES (?,?,?,?,?,?,?,?,?)")
  const info = stmt.run(Number(data.clienteId), Number(data.productoId), Number(data.cantidad), Number(data.precioUnitario), Number(data.total), String(data.estado), data.metodoPago || null, data.notas || null, createdAt)
  const order = getOrder(info.lastInsertRowid)
  db.prepare("INSERT INTO order_audit (orderId, userId, date, observation) VALUES (?,?,?,?)").run(order.id, data.userId || null, Date.now(), "creado")
  return order
}

function updateOrder(id, data) {
  const current = getOrder(id)
  if (!current) return null
  const updated = { ...current, ...data }
  db.prepare("UPDATE orders SET clienteId=?, productoId=?, cantidad=?, precioUnitario=?, total=?, estado=?, metodoPago=?, notas=? WHERE id=?").run(updated.clienteId, updated.productoId, updated.cantidad, updated.precioUnitario, updated.total, updated.estado, updated.metodoPago, updated.notas, id)
  return getOrder(id)
}

function updateUserPasswordByEmail(email, passwordHash) {
  const u = db.prepare("SELECT * FROM users WHERE email = ?").get(email)
  if (!u) return false
  db.prepare("UPDATE users SET passwordHash = ? WHERE email = ?").run(String(passwordHash), String(email))
  return true
}

function addProforma(data) {
  const createdAt = Date.now()
  const info = db.prepare("INSERT INTO proformas (pedidoId, clienteId, total, url, createdAt) VALUES (?,?,?,?,?)").run(Number(data.pedidoId), Number(data.clienteId), Number(data.total), String(data.url), createdAt)
  return db.prepare("SELECT * FROM proformas WHERE id = ?").get(info.lastInsertRowid)
}

function listProformas() { return db.prepare("SELECT * FROM proformas").all() }

const users = {
  findByEmail(email) { return db.prepare("SELECT * FROM users WHERE email = ?").get(email) }
}

function listOrderAudit(orderId, { limit = 20, offset = 0 } = {}) {
  return db.prepare("SELECT * FROM order_audit WHERE orderId = ? ORDER BY date DESC LIMIT ? OFFSET ?").all(Number(orderId), Number(limit), Number(offset))
}

function countOrderAudit(orderId) {
  const row = db.prepare("SELECT COUNT(1) as c FROM order_audit WHERE orderId = ?").get(Number(orderId))
  return Number(row.c || 0)
}

function listOrderAuditDetailed(orderId, { limit = 20, offset = 0 } = {}) {
  const sql = `
    SELECT a.id, a.orderId, a.userId, a.date, a.observation, u.name as userName
    FROM order_audit a
    LEFT JOIN users u ON u.id = a.userId
    WHERE a.orderId = ?
    ORDER BY a.date DESC
    LIMIT ? OFFSET ?`
  return db.prepare(sql).all(Number(orderId), Number(limit), Number(offset))
}

function getDashboardStats() {
  const stats = {
    totalVentas: 0,
    pedidosCompletados: 0,
    clientesNuevos: 0,
    ticketPromedio: 0,
    stockBajo: 0
  }

  // KPIs
  const kpis = db.prepare(`
    SELECT
      SUM(CASE WHEN estado = 'Completado' THEN total ELSE 0 END) as totalVentas,
      COUNT(CASE WHEN estado = 'Completado' THEN 1 END) as pedidosCompletados
    FROM orders
  `).get()

  stats.totalVentas = kpis.totalVentas || 0
  stats.pedidosCompletados = kpis.pedidosCompletados || 0
  stats.ticketPromedio = stats.pedidosCompletados > 0 ? Math.round(stats.totalVentas / stats.pedidosCompletados) : 0

  // Clientes Nuevos (this month)
  const date = new Date()
  const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1).getTime()
  const newClients = db.prepare("SELECT COUNT(1) as c FROM clients WHERE createdAt >= ?").get(startOfMonth)
  stats.clientesNuevos = newClients.c || 0

  // Stock Bajo
  const lowStock = db.prepare("SELECT COUNT(1) as c FROM products WHERE stockActual <= stockMinimo AND (active = 1 OR active IS NULL)").get()
  stats.stockBajo = lowStock.c || 0

  // Charts Data

  // Ventas Mensuales (Last 6 months)
  const ventasMensuales = db.prepare(`
    SELECT strftime('%Y-%m', datetime(createdAt/1000, 'unixepoch')) as mes, SUM(total) as ventas
    FROM orders
    WHERE estado = 'Completado'
    GROUP BY mes
    ORDER BY mes DESC
    LIMIT 6
  `).all().reverse()

  // Ventas Diarias (Last 7 days)
  const ventasDiarias = db.prepare(`
    SELECT strftime('%Y-%m-%d', datetime(createdAt/1000, 'unixepoch')) as dia, SUM(total) as ventas
    FROM orders
    WHERE estado = 'Completado'
    GROUP BY dia
    ORDER BY dia DESC
    LIMIT 7
  `).all().reverse()

  // Top Clientes
  const topClientes = db.prepare(`
    SELECT c.nombre, SUM(o.total) as total
    FROM orders o
    JOIN clients c ON o.clienteId = c.id
    WHERE o.estado = 'Completado'
    GROUP BY o.clienteId
    ORDER BY total DESC
    LIMIT 5
  `).all()

  // Metodos de Pago
  const metodosPago = db.prepare(`
    SELECT metodoPago as name, COUNT(*) as value
    FROM orders
    WHERE estado = 'Completado'
    GROUP BY metodoPago
  `).all()

  // Estado Pedidos
  const estadoPedidos = db.prepare(`
    SELECT estado as name, COUNT(*) as value
    FROM orders
    GROUP BY estado
  `).all()

  return {
    stats,
    ventasMensuales,
    ventasDiarias,
    topClientes,
    metodosPago,
    estadoPedidos
  }
}

export {
  payments,
  orderStates,
  listClients,
  countClients,
  addClient,
  updateClient,
  listProducts,
  countProducts,
  addProduct,
  getProduct,
  getClient,
  adjustStock,
  updateProduct,
  deleteProduct,
  listStockMovements,
  listStockMovementsDetailed,
  countStockMovements,
  listOrders,
  listOrdersWithNames,
  listSalesSeries,
  getOrder,
  addOrder,
  updateOrder,
  addProforma,
  listProformas,
  users,
  listOrderAudit,
  countOrderAudit,
  listOrderAuditDetailed,
  getDashboardStats,
  updateUserPasswordByEmail,
}
