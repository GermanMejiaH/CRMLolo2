import db from "../db.js"

export function listClients(filters = {}) {
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

export function countClients(filters = {}) {
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

export function getClientById(id) {
  return db.prepare("SELECT * FROM clients WHERE id = ?").get(id)
}

export function addClientRecord(data) {
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
  return getClientById(info.lastInsertRowid)
}

export function updateClientRecord(id, data) {
  const current = getClientById(id)
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
  return getClientById(id)
}

export function getClientProductPrices(clientId) {
  return db.prepare("SELECT * FROM client_product_prices WHERE clientId = ?").all(clientId)
}

export function getClientProductPrice(clientId, productId) {
  return db.prepare("SELECT * FROM client_product_prices WHERE clientId = ? AND productId = ?").get(clientId, productId)
}

export function setClientProductPrice(clientId, productId, price) {
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

export function deleteClientProductPrice(clientId, productId) {
  db.prepare("DELETE FROM client_product_prices WHERE clientId = ? AND productId = ?").run(clientId, productId)
  return true
}

export function getClientResumen360Data(clienteId) {
  const client = getClientById(clienteId)
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
