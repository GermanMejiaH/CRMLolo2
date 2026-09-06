import db from "./db.js"

const payments = ["Efectivo", "Transferencia", "Tarjeta"]
const orderStates = ["Pendiente", "Completado", "Cancelado"]

const seedUser = db.prepare("SELECT COUNT(1) as c FROM users").get()
if (seedUser.c === 0) {
  db.prepare("INSERT INTO users (email, passwordHash, role, name) VALUES (?,?,?,?)").run(
    "admin@lolo",
    "plain:admin123",
    "Admin",
    "Admin"
  )
}

const allowDemoSeed =
  (process.env.NODE_ENV || "").toLowerCase() !== "production" ||
  String(process.env.SEED_DEMO || "").toLowerCase() === "true"
if (allowDemoSeed) {
  const seedClients = db.prepare("SELECT COUNT(1) as c FROM clients").get()
  if (seedClients.c === 0) {
    addClient({
      nombre: "Moto Repuestos SAS",
      contacto: "Carlos Rodríguez",
      telefono: "+57 300 123 4567",
      email: "carlos@motorepuestos.com",
      direccion: "Calle 45 #23-12, Medellín",
      precioPersonalizado: 42000,
      notas: "Cliente preferencial"
    })
    addClient({
      nombre: "Auto Express",
      contacto: "María González",
      telefono: "+57 301 234 5678",
      email: "maria@autoexpress.co",
      direccion: "Carrera 70 #45-89, Medellín",
      precioPersonalizado: 38000,
      notas: ""
    })
    addClient({
      nombre: "Distribuidora Central",
      contacto: "Juan Pérez",
      telefono: "+57 302 345 6789",
      email: "juan@distcentral.com",
      direccion: "Avenida 80 #30-25, Medellín",
      precioPersonalizado: 45000,
      notas: "Factura electrónica"
    })
  }

  const seedProducts = db.prepare("SELECT COUNT(1) as c FROM products").get()
  if (seedProducts.c === 0) {
    addProduct({
      nombre: "Módulo XR-2000",
      descripcion: "Módulo avanzado",
      precioMinimo: 25000,
      precioMaximo: 45000,
      stockActual: 15,
      stockMinimo: 10
    })
    addProduct({
      nombre: "Estacionaria Pro",
      descripcion: "Equipo industrial",
      precioMinimo: 30000,
      precioMaximo: 50000,
      stockActual: 5,
      stockMinimo: 8
    })
    addProduct({
      nombre: "Kit Básico M1",
      descripcion: "Kit de inicio",
      precioMinimo: 25000,
      precioMaximo: 40000,
      stockActual: 25,
      stockMinimo: 12
    })
  }
}

function listClients(filters = {}) {
  const { q, email, minPrecio, maxPrecio, limit, offset, includeInactive = false } = filters
  let sql = `
    SELECT c.*, MAX(o.createdAt) as lastOrderDate
    FROM clients c
    LEFT JOIN orders o ON c.id = o.clienteId
    WHERE 1=1
  `
  const params = []
  if (!includeInactive) {
    sql += " AND (c.active = 1 OR c.active IS NULL)"
  }
  if (q) {
    sql += " AND lower(c.nombre) LIKE ?"
    params.push(`%${String(q).toLowerCase()}%`)
  }
  if (email) {
    sql += " AND c.email = ?"
    params.push(email)
  }
  if (minPrecio) {
    sql += " AND (c.precioPersonalizado IS NOT NULL AND c.precioPersonalizado >= ?)"
    params.push(Number(minPrecio))
  }
  if (maxPrecio) {
    sql += " AND (c.precioPersonalizado IS NOT NULL AND c.precioPersonalizado <= ?)"
    params.push(Number(maxPrecio))
  }

  sql += " GROUP BY c.id"

  if (typeof limit === "number" && typeof offset === "number") {
    sql += " LIMIT ? OFFSET ?"
    params.push(Number(limit), Number(offset))
  }

  return db.prepare(sql).all(...params)
}

function countClients(filters = {}) {
  const { q, email, minPrecio, maxPrecio, includeInactive = false } = filters
  let sql = "SELECT COUNT(1) as c FROM clients WHERE 1=1"
  const params = []
  if (!includeInactive) {
    sql += " AND (active = 1 OR active IS NULL)"
  }
  if (q) {
    sql += " AND lower(nombre) LIKE ?"
    params.push(`%${String(q).toLowerCase()}%`)
  }
  if (email) {
    sql += " AND email = ?"
    params.push(email)
  }
  if (minPrecio) {
    sql += " AND (precioPersonalizado IS NOT NULL AND precioPersonalizado >= ?)"
    params.push(Number(minPrecio))
  }
  if (maxPrecio) {
    sql += " AND (precioPersonalizado IS NOT NULL AND precioPersonalizado <= ?)"
    params.push(Number(maxPrecio))
  }
  const row = db.prepare(sql).get(...params)
  return Number(row.c || 0)
}

function addClient(data) {
  const createdAt = Date.now()
  const active = 1
  const stmt = db.prepare(
    "INSERT INTO clients (nombre, contacto, telefono, email, direccion, precioPersonalizado, notas, createdAt, active) VALUES (?,?,?,?,?,?,?,?,?)"
  )
  const info = stmt.run(
    data.nombre,
    data.contacto || null,
    data.telefono || null,
    data.email || null,
    data.direccion || null,
    data.precioPersonalizado ?? null,
    data.notas || null,
    createdAt,
    active
  )
  return db.prepare("SELECT * FROM clients WHERE id = ?").get(info.lastInsertRowid)
}

function updateClient(id, data) {
  const current = db.prepare("SELECT * FROM clients WHERE id = ?").get(id)
  if (!current) return null
  const updated = { ...current, ...data }
  const precio =
    updated.precioPersonalizado == null || updated.precioPersonalizado === ""
      ? null
      : Number(updated.precioPersonalizado)
  const activeVal = updated.active == null ? (current.active ?? 1) : updated.active ? 1 : 0
  db.prepare(
    "UPDATE clients SET nombre=?, contacto=?, telefono=?, email=?, direccion=?, precioPersonalizado=?, notas=?, active=? WHERE id=?"
  ).run(
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
  if (!includeInactive) {
    sql += " AND (active = 1 OR active IS NULL)"
  }
  if (q) {
    sql += " AND lower(nombre) LIKE ?"
    params.push(`%${String(q).toLowerCase()}%`)
  }
  if (typeof limit === "number" && typeof offset === "number") {
    sql += " LIMIT ? OFFSET ?"
    params.push(Number(limit), Number(offset))
  }
  return db.prepare(sql).all(...params)
}

function countProducts(filters = {}) {
  const { q, includeInactive = false } = filters
  let sql = "SELECT COUNT(1) as c FROM products WHERE 1=1"
  const params = []
  if (!includeInactive) {
    sql += " AND (active = 1 OR active IS NULL)"
  }
  if (q) {
    sql += " AND lower(nombre) LIKE ?"
    params.push(`%${String(q).toLowerCase()}%`)
  }
  const row = db.prepare(sql).get(...params)
  return Number(row.c || 0)
}

function addProduct(data) {
  const updatedAt = Date.now()
  const stmt = db.prepare(
    "INSERT INTO products (nombre, descripcion, precioMinimo, precioMaximo, stockActual, stockMinimo, updatedAt) VALUES (?,?,?,?,?,?,?)"
  )
  const info = stmt.run(
    data.nombre,
    data.descripcion || null,
    Number(data.precioMinimo || 0),
    Number(data.precioMaximo || 0),
    Number(data.stockActual || 0),
    Number(data.stockMinimo || 0),
    updatedAt
  )
  return db.prepare("SELECT * FROM products WHERE id = ?").get(info.lastInsertRowid)
}

function getProduct(id) {
  return db.prepare("SELECT * FROM products WHERE id = ?").get(id)
}
function getClient(id) {
  return db.prepare("SELECT * FROM clients WHERE id = ?").get(id)
}

function adjustStock(productId, diff, reason, ref, userId) {
  const p = getProduct(productId)
  if (!p) return null
  const newStock = Number(p.stockActual || 0) + Number(diff)
  db.prepare("UPDATE products SET stockActual=?, updatedAt=? WHERE id=?").run(newStock, Date.now(), productId)
  const type = diff >= 0 ? "entrada" : "salida"
  db.prepare(
    "INSERT INTO stock_movements (productId, diff, reason, ref, userId, date, type) VALUES (?,?,?,?,?,?,?)"
  ).run(productId, diff, reason || null, ref || null, userId || null, Date.now(), type)
  return getProduct(productId)
}

function updateProduct(id, data) {
  const current = getProduct(id)
  if (!current) return null
  const updated = { ...current, ...data, updatedAt: Date.now() }
  db.prepare(
    "UPDATE products SET nombre=?, descripcion=?, precioMinimo=?, precioMaximo=?, stockActual=?, stockMinimo=?, updatedAt=?, active=? WHERE id=?"
  ).run(
    updated.nombre,
    updated.descripcion,
    Number(updated.precioMinimo || 0),
    Number(updated.precioMaximo || 0),
    Number(updated.stockActual || 0),
    Number(updated.stockMinimo || 0),
    updated.updatedAt,
    updated.active == null ? (current.active ?? 1) : Number(updated.active ? 1 : 0),
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
  return db
    .prepare("SELECT * FROM stock_movements WHERE productId = ? ORDER BY date DESC LIMIT ? OFFSET ?")
    .all(productId, Number(limit), Number(offset))
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
  if (cliente) {
    sql += " AND clienteId = ?"
    params.push(Number(cliente))
  }
  if (estado) {
    sql += " AND estado = ?"
    params.push(String(estado))
  }
  if (typeof from === "number") {
    sql += " AND createdAt >= ?"
    params.push(Number(from))
  }
  if (typeof to === "number") {
    sql += " AND createdAt <= ?"
    params.push(Number(to))
  }
  if (metodoPago) {
    sql += " AND metodoPago = ?"
    params.push(String(metodoPago))
  }
  return db.prepare(sql).all(...params)
}

function listOrdersWithNames(filters = {}) {
  const { cliente, estado, from, to, metodoPago } = filters
  let sql = `
    SELECT o.*, c.nombre AS clienteNombre, p.nombre AS productoNombre,
           COALESCE((SELECT SUM(monto) FROM order_payments WHERE orderId = o.id), 0) AS totalPagado
    FROM orders o
    LEFT JOIN clients c ON c.id = o.clienteId
    LEFT JOIN products p ON p.id = o.productoId
    WHERE 1=1`
  const params = []
  if (cliente) {
    sql += " AND o.clienteId = ?"
    params.push(Number(cliente))
  }
  if (estado) {
    sql += " AND o.estado = ?"
    params.push(String(estado))
  }
  if (typeof from === "number") {
    sql += " AND o.createdAt >= ?"
    params.push(Number(from))
  }
  if (typeof to === "number") {
    sql += " AND o.createdAt <= ?"
    params.push(Number(to))
  }
  if (metodoPago) {
    sql += " AND o.metodoPago = ?"
    params.push(String(metodoPago))
  }
  return db.prepare(sql).all(...params)
}

function listSalesSeries(filters = {}) {
  const { from, to, estado, metodoPago, granularity = "day", breakdown } = filters
  const bucketExpr =
    granularity === "month"
      ? "strftime('%Y-%m', datetime(createdAt/1000,'unixepoch'))"
      : "date(datetime(createdAt/1000,'unixepoch'))"
  let select = `${bucketExpr} as bucket, SUM(total) as total`
  if (breakdown === "payment") {
    for (const m of payments) {
      const col = m.replace(/[^A-Za-z0-9_]/g, "_")
      select += `, SUM(CASE WHEN COALESCE(NULLIF(metodoPago,''),'Efectivo') = '${m}' THEN total ELSE 0 END) as ${col}`
    }
  }
  let sql = `SELECT ${select} FROM orders WHERE 1=1`
  const params = []
  if (typeof from === "number") {
    sql += " AND createdAt >= ?"
    params.push(Number(from))
  }
  if (typeof to === "number") {
    sql += " AND createdAt <= ?"
    params.push(Number(to))
  }
  if (estado) {
    sql += " AND estado = ?"
    params.push(String(estado))
  } else {
    sql += " AND estado != 'Cancelado'"
  }
  if (metodoPago) {
    sql += " AND metodoPago = ?"
    params.push(String(metodoPago))
  }
  sql += " GROUP BY bucket ORDER BY bucket"
  return db.prepare(sql).all(...params)
}

function getOrder(id) {
  const order = db
    .prepare(
      `SELECT o.*, COALESCE((SELECT SUM(monto) FROM order_payments WHERE orderId = o.id), 0) AS totalPagado
       FROM orders o WHERE o.id = ?`
    )
    .get(id)
  if (!order) return null
  const items = db
    .prepare(
      `SELECT oi.*, p.nombre AS productoNombre, p.descripcion AS productoDescripcion
       FROM order_items oi
       LEFT JOIN products p ON p.id = oi.productoId
       WHERE oi.orderId = ?`
    )
    .all(id)

  if (items && items.length > 0) {
    order.items = items
  } else if (order.productoId) {
    const p = getProduct(order.productoId)
    order.items = [
      {
        id: 0,
        orderId: order.id,
        productoId: order.productoId,
        productoNombre: p?.nombre || `Producto #${order.productoId}`,
        productoDescripcion: p?.descripcion || "",
        cantidad: order.cantidad,
        precioUnitario: order.precioUnitario,
        subtotal: order.total
      }
    ]
  } else {
    order.items = []
  }
  return order
}

function addOrder(data) {
  const createdAt = Date.now()
  const metodo = data.metodoPago && String(data.metodoPago).trim() ? String(data.metodoPago).trim() : "Efectivo"

  // Preparar lista de ítems a procesar
  let itemsToProcess = []
  if (Array.isArray(data.items) && data.items.length > 0) {
    itemsToProcess = data.items.map((it) => ({ ...it }))
  } else if (data.productoId) {
    itemsToProcess = [
      {
        productoId: data.productoId,
        cantidad: data.cantidad,
        precioUnitario: data.precioUnitario
      }
    ]
  }

  if (itemsToProcess.length === 0) {
    throw new Error("El pedido debe contener al menos un producto")
  }

  // Calcular precios y subtotales por cada ítem
  let totalPedido = 0
  const processedItems = itemsToProcess.map((item) => {
    const pid = Number(item.productoId)
    const cant = Number(item.cantidad || 1)
    let unitPrice = item.precioUnitario

    if (unitPrice == null) {
      const customPrice = getClientProductPrice(Number(data.clienteId), pid)
      if (customPrice) {
        unitPrice = customPrice.price
      } else {
        const client = getClient(Number(data.clienteId))
        if (client && client.precioPersonalizado != null) {
          unitPrice = client.precioPersonalizado
        } else {
          const product = getProduct(pid)
          unitPrice = product ? product.precioMinimo : 0
        }
      }
    }

    const subtotal = Number(unitPrice) * cant
    totalPedido += subtotal
    return {
      productoId: pid,
      cantidad: cant,
      precioUnitario: Number(unitPrice),
      subtotal
    }
  })

  // Primer ítem para columnas legacy
  const primaryItem = processedItems[0]

  const stmtOrder = db.prepare(
    "INSERT INTO orders (clienteId, productoId, cantidad, precioUnitario, total, estado, metodoPago, notas, createdAt) VALUES (?,?,?,?,?,?,?,?,?)"
  )
  const stmtItem = db.prepare(
    "INSERT INTO order_items (orderId, productoId, cantidad, precioUnitario, subtotal) VALUES (?,?,?,?,?)"
  )

  const transaction = db.transaction(() => {
    const info = stmtOrder.run(
      Number(data.clienteId),
      primaryItem.productoId,
      primaryItem.cantidad,
      primaryItem.precioUnitario,
      totalPedido,
      String(data.estado || "Pendiente"),
      metodo,
      data.notas || null,
      createdAt
    )
    const orderId = info.lastInsertRowid

    for (const item of processedItems) {
      stmtItem.run(orderId, item.productoId, item.cantidad, item.precioUnitario, item.subtotal)
    }

    db.prepare("INSERT INTO order_audit (orderId, userId, date, observation) VALUES (?,?,?,?)").run(
      orderId,
      data.userId || null,
      Date.now(),
      "creado"
    )

    return orderId
  })

  const newOrderId = transaction()
  return getOrder(newOrderId)
}

function updateOrder(id, data) {
  const current = getOrder(id)
  if (!current) return null
  const updated = { ...current, ...data }
  const metodo = updated.metodoPago == null ? current.metodoPago : String(updated.metodoPago).trim() || "Efectivo"
  db.prepare(
    "UPDATE orders SET clienteId=?, productoId=?, cantidad=?, precioUnitario=?, total=?, estado=?, metodoPago=?, notas=? WHERE id=?"
  ).run(
    updated.clienteId,
    updated.productoId,
    updated.cantidad,
    updated.precioUnitario,
    updated.total,
    updated.estado,
    metodo,
    updated.notas,
    id
  )
  return getOrder(id)
}

function addOrderAuditEntry(orderId, userId, observation) {
  db.prepare("INSERT INTO order_audit (orderId, userId, date, observation) VALUES (?,?,?,?)").run(
    Number(orderId),
    userId || null,
    Date.now(),
    observation || "actualizado"
  )
}

function deleteOrder(id) {
  const transaction = db.transaction(() => {
    db.prepare("DELETE FROM order_audit WHERE orderId = ?").run(id)
    db.prepare("DELETE FROM proformas WHERE pedidoId = ?").run(id)
    db.prepare("DELETE FROM order_items WHERE orderId = ?").run(id)
    db.prepare("DELETE FROM orders WHERE id = ?").run(id)
  })
  transaction()
  return true
}

function updateUserPasswordByEmail(email, passwordHash) {
  const u = db.prepare("SELECT * FROM users WHERE email = ?").get(email)
  if (!u) return false
  db.prepare("UPDATE users SET passwordHash = ? WHERE email = ?").run(String(passwordHash), String(email))
  return true
}

function updateLegacyUserPassword(email, oldPasswordHash, newBcryptHash) {
  const stmt = db.prepare("UPDATE users SET passwordHash = ? WHERE email = ? AND passwordHash = ?")
  const info = stmt.run(String(newBcryptHash), String(email), String(oldPasswordHash))
  return info.changes > 0
}

function addProforma(data) {
  const createdAt = Date.now()
  const info = db
    .prepare("INSERT INTO proformas (pedidoId, clienteId, total, url, createdAt) VALUES (?,?,?,?,?)")
    .run(Number(data.pedidoId), Number(data.clienteId), Number(data.total), String(data.url), createdAt)
  return db.prepare("SELECT * FROM proformas WHERE id = ?").get(info.lastInsertRowid)
}

function listProformas() {
  return db.prepare("SELECT * FROM proformas").all()
}

const users = {
  findByEmail(email) {
    return db.prepare("SELECT * FROM users WHERE email = ?").get(email)
  }
}

function listOrderAudit(orderId, { limit = 20, offset = 0 } = {}) {
  return db
    .prepare("SELECT * FROM order_audit WHERE orderId = ? ORDER BY date DESC LIMIT ? OFFSET ?")
    .all(Number(orderId), Number(limit), Number(offset))
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
  const kpis = db
    .prepare(
      `
    SELECT
      SUM(CASE WHEN estado != 'Cancelado' THEN total ELSE 0 END) as totalVentas,
      COUNT(CASE WHEN estado = 'Completado' THEN 1 END) as pedidosCompletados,
      COUNT(CASE WHEN estado != 'Cancelado' THEN 1 END) as pedidosNoCancelados
    FROM orders
  `
    )
    .get()

  stats.totalVentas = kpis.totalVentas || 0
  stats.pedidosCompletados = kpis.pedidosCompletados || 0
  const pedidosConsiderados = kpis.pedidosNoCancelados || 0
  stats.ticketPromedio = pedidosConsiderados > 0 ? Math.round(stats.totalVentas / pedidosConsiderados) : 0

  // Clientes Nuevos (this month)
  const date = new Date()
  const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1).getTime()
  const newClients = db.prepare("SELECT COUNT(1) as c FROM clients WHERE createdAt >= ?").get(startOfMonth)
  stats.clientesNuevos = newClients.c || 0

  // Stock Bajo
  const lowStock = db
    .prepare("SELECT COUNT(1) as c FROM products WHERE stockActual <= stockMinimo AND (active = 1 OR active IS NULL)")
    .get()
  stats.stockBajo = lowStock.c || 0

  // Charts Data

  // Ventas Mensuales (Last 6 months)
  const ventasMensuales = db
    .prepare(
      `
    SELECT strftime('%Y-%m', datetime(createdAt/1000, 'unixepoch')) as mes, SUM(total) as ventas
    FROM orders
    WHERE estado != 'Cancelado'
    GROUP BY mes
    ORDER BY mes DESC
    LIMIT 6
  `
    )
    .all()
    .reverse()

  // Ventas Diarias (Last 7 days)
  const ventasDiarias = db
    .prepare(
      `
    SELECT strftime('%Y-%m-%d', datetime(createdAt/1000, 'unixepoch')) as dia, SUM(total) as ventas
    FROM orders
    WHERE estado != 'Cancelado'
    GROUP BY dia
    ORDER BY dia DESC
    LIMIT 7
  `
    )
    .all()
    .reverse()

  // Top Clientes
  const topClientes = db
    .prepare(
      `
    SELECT c.nombre, SUM(o.total) as total
    FROM orders o
    JOIN clients c ON o.clienteId = c.id
    WHERE o.estado != 'Cancelado'
    GROUP BY o.clienteId
    ORDER BY total DESC
    LIMIT 5
  `
    )
    .all()

  const metodosPago = db
    .prepare(
      `
    SELECT COALESCE(NULLIF(metodoPago,''),'Efectivo') as name, COUNT(*) as value
    FROM orders
    WHERE estado != 'Cancelado'
    GROUP BY COALESCE(NULLIF(metodoPago,''),'Efectivo')
  `
    )
    .all()

  // Estado Pedidos
  const estadoPedidos = db
    .prepare(
      `
    SELECT estado as name, COUNT(*) as value
    FROM orders
    GROUP BY estado
  `
    )
    .all()

  return {
    stats,
    ventasMensuales,
    ventasDiarias,
    topClientes,
    metodosPago,
    estadoPedidos
  }
}

function getClientProductPrices(clientId) {
  return db.prepare("SELECT * FROM client_product_prices WHERE clientId = ?").all(clientId)
}

function getClientProductPrice(clientId, productId) {
  return db.prepare("SELECT * FROM client_product_prices WHERE clientId = ? AND productId = ?").get(clientId, productId)
}

function setClientProductPrice(clientId, productId, price) {
  const now = Date.now()
  const existing = getClientProductPrice(clientId, productId)
  if (existing) {
    db.prepare("UPDATE client_product_prices SET price = ?, updatedAt = ? WHERE id = ?").run(price, now, existing.id)
    return getClientProductPrice(clientId, productId)
  } else {
    const stmt = db.prepare(
      "INSERT INTO client_product_prices (clientId, productId, price, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)"
    )
    const info = stmt.run(clientId, productId, price, now, now)
    return db.prepare("SELECT * FROM client_product_prices WHERE id = ?").get(info.lastInsertRowid)
  }
}

function deleteClientProductPrice(clientId, productId) {
  db.prepare("DELETE FROM client_product_prices WHERE clientId = ? AND productId = ?").run(clientId, productId)
  return true
}

function addOrderPayment(orderId, { monto, metodoPago, nota }, userId) {
  const order = getOrder(orderId)
  if (!order) throw new Error("Pedido no encontrado")
  const date = Date.now()
  const metodo = metodoPago && String(metodoPago).trim() ? String(metodoPago).trim() : "Efectivo"
  const info = db
    .prepare("INSERT INTO order_payments (orderId, monto, metodoPago, nota, date, userId) VALUES (?, ?, ?, ?, ?, ?)")
    .run(Number(orderId), Number(monto), metodo, nota || null, date, userId || null)

  addOrderAuditEntry(
    orderId,
    userId,
    `Abono de $${Number(monto).toLocaleString("es-CO")} (${metodo})${nota ? `: ${nota}` : ""}`
  )

  const payment = db.prepare("SELECT * FROM order_payments WHERE id = ?").get(info.lastInsertRowid)
  const summary = getOrderPaymentSummary(orderId)
  return { payment, ...summary }
}

function getOrderPayments(orderId) {
  const paymentsList = db
    .prepare(
      `SELECT op.*, u.name as userName
       FROM order_payments op
       LEFT JOIN users u ON u.id = op.userId
       WHERE op.orderId = ?
       ORDER BY op.date DESC`
    )
    .all(Number(orderId))
  const summary = getOrderPaymentSummary(orderId)
  return { items: paymentsList, ...summary }
}

function getOrderPaymentSummary(orderId) {
  const order = getOrder(orderId)
  if (!order) return { total: 0, totalPagado: 0, saldoPendiente: 0, estadoPago: "Pendiente" }
  const res = db
    .prepare("SELECT COALESCE(SUM(monto), 0) as totalPagado FROM order_payments WHERE orderId = ?")
    .get(Number(orderId))
  const totalPagado = Number(res?.totalPagado || 0)
  const total = Number(order.total || 0)
  const saldoPendiente = Math.max(0, total - totalPagado)
  let estadoPago = "Pendiente"
  if (totalPagado >= total && total > 0) estadoPago = "Pagado"
  else if (totalPagado > 0) estadoPago = "Parcial"

  return { total, totalPagado, saldoPendiente, estadoPago }
}

function getClientResumen360(clienteId) {
  const client = getClient(clienteId)
  if (!client) return null
  const stats = db
    .prepare(
      `SELECT COUNT(id) as totalPedidos, COALESCE(SUM(total), 0) as totalComprado
       FROM orders
       WHERE clienteId = ? AND estado != 'Cancelado'`
    )
    .get(Number(clienteId))

  const abonos = db
    .prepare(
      `SELECT COALESCE(SUM(op.monto), 0) as totalAbonado
       FROM order_payments op
       JOIN orders o ON op.orderId = o.id
       WHERE o.clienteId = ? AND o.estado != 'Cancelado'`
    )
    .get(Number(clienteId))

  const totalComprado = Number(stats?.totalComprado || 0)
  const totalAbonado = Number(abonos?.totalAbonado || 0)
  const saldoPendiente = Math.max(0, totalComprado - totalAbonado)
  const totalPedidos = Number(stats?.totalPedidos || 0)
  const ticketPromedio = totalPedidos > 0 ? Math.round(totalComprado / totalPedidos) : 0

  const topProducts = db
    .prepare(
      `SELECT p.id, p.nombre, SUM(oi.cantidad) as totalUnidades, SUM(oi.subtotal) as totalInvertido
       FROM order_items oi
       JOIN orders o ON oi.orderId = o.id
       JOIN products p ON oi.productoId = p.id
       WHERE o.clienteId = ? AND o.estado != 'Cancelado'
       GROUP BY p.id
       ORDER BY totalUnidades DESC
       LIMIT 5`
    )
    .all(Number(clienteId))

  const recentOrders = db
    .prepare(
      `SELECT o.*, COALESCE((SELECT SUM(monto) FROM order_payments WHERE orderId = o.id), 0) as totalPagado
       FROM orders o
       WHERE o.clienteId = ?
       ORDER BY o.createdAt DESC
       LIMIT 5`
    )
    .all(Number(clienteId))

  return {
    client,
    totalPedidos,
    totalComprado,
    totalAbonado,
    saldoPendiente,
    ticketPromedio,
    topProducts,
    recentOrders
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
  deleteOrder,
  addProforma,
  listProformas,
  users,
  listOrderAudit,
  countOrderAudit,
  listOrderAuditDetailed,
  getDashboardStats,
  updateUserPasswordByEmail,
  updateLegacyUserPassword,
  addOrderAuditEntry,
  getClientProductPrices,
  getClientProductPrice,
  setClientProductPrice,
  deleteClientProductPrice,
  addOrderPayment,
  getOrderPayments,
  getOrderPaymentSummary,
  getClientResumen360
}
