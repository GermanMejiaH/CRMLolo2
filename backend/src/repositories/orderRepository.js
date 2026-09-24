import db from "../db.js"
import { getProductById } from "./productRepository.js"

export function listOrders(filters = {}) {
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

export function listOrdersWithNames(filters = {}) {
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

export function listSalesSeries(filters = {}, payments = ["Efectivo", "Transferencia", "Tarjeta"]) {
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

export function getOrderById(id) {
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
    const p = getProductById(order.productoId)
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

export function addOrderAuditEntry(orderId, userId, observation) {
  db.prepare("INSERT INTO order_audit (orderId, userId, date, observation) VALUES (?,?,?,?)").run(
    Number(orderId),
    userId || null,
    Date.now(),
    observation || "actualizado"
  )
}

export function listOrderAudit(orderId, { limit = 20, offset = 0 } = {}) {
  return db
    .prepare("SELECT * FROM order_audit WHERE orderId = ? ORDER BY date DESC LIMIT ? OFFSET ?")
    .all(Number(orderId), Number(limit), Number(offset))
}

export function countOrderAudit(orderId) {
  const row = db.prepare("SELECT COUNT(1) as c FROM order_audit WHERE orderId = ?").get(Number(orderId))
  return Number(row.c || 0)
}

export function listOrderAuditDetailed(orderId, { limit = 20, offset = 0 } = {}) {
  const sql = `
    SELECT a.id, a.orderId, a.userId, a.date, a.observation, u.name as userName
    FROM order_audit a
    LEFT JOIN users u ON u.id = a.userId
    WHERE a.orderId = ?
    ORDER BY a.date DESC
    LIMIT ? OFFSET ?`
  return db.prepare(sql).all(Number(orderId), Number(limit), Number(offset))
}

export function addProformaRecord(data) {
  const createdAt = Date.now()
  const info = db
    .prepare("INSERT INTO proformas (pedidoId, clienteId, total, url, createdAt) VALUES (?,?,?,?,?)")
    .run(Number(data.pedidoId), Number(data.clienteId), Number(data.total), String(data.url), createdAt)
  return db.prepare("SELECT * FROM proformas WHERE id = ?").get(info.lastInsertRowid)
}

export function listProformas() {
  return db.prepare("SELECT * FROM proformas").all()
}

export function addOrderPaymentRecord(orderId, { monto, metodoPago, nota }, userId) {
  const order = getOrderById(orderId)
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

  return db.prepare("SELECT * FROM order_payments WHERE id = ?").get(info.lastInsertRowid)
}

export function getOrderPaymentsList(orderId) {
  return db
    .prepare(
      `SELECT op.*, u.name as userName
       FROM order_payments op
       LEFT JOIN users u ON u.id = op.userId
       WHERE op.orderId = ?
       ORDER BY op.date DESC`
    )
    .all(Number(orderId))
}

export function getOrderPaymentSummary(orderId) {
  const order = getOrderById(orderId)
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
