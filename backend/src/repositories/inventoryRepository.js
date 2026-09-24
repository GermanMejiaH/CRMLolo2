import db from "../db.js"
import { getProductById } from "./productRepository.js"

export function recordStockMovement(productId, diff, reason, ref, userId) {
  const type = diff >= 0 ? "entrada" : "salida"
  db.prepare(
    "INSERT INTO stock_movements (productId, diff, reason, ref, userId, date, type) VALUES (?,?,?,?,?,?,?)"
  ).run(productId, diff, reason || null, ref || null, userId || null, Date.now(), type)
}

export function listStockMovements(productId, { limit = 20, offset = 0 } = {}) {
  return db
    .prepare("SELECT * FROM stock_movements WHERE productId = ? ORDER BY date DESC LIMIT ? OFFSET ?")
    .all(productId, Number(limit), Number(offset))
}

export function listStockMovementsDetailed(productId, { limit = 20, offset = 0 } = {}) {
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

export function countStockMovements(productId) {
  const row = db.prepare("SELECT COUNT(1) as c FROM stock_movements WHERE productId = ?").get(productId)
  return Number(row.c || 0)
}

export function recordKardexMovement(productId, tipoMovimiento, cantidad, stockResultante, referenciaId = null, userId = null, notas = null) {
  const p = getProductById(productId)
  if (!p) return null
  const date = Date.now()
  const unidadMedida = p.unidadMedida || "unidades"
  db.prepare(
    "INSERT INTO kardex_movements (productId, tipoMovimiento, cantidad, unidadMedida, stockResultante, referenciaId, userId, fecha, notas) VALUES (?,?,?,?,?,?,?,?,?)"
  ).run(
    Number(productId),
    String(tipoMovimiento),
    Number(cantidad),
    unidadMedida,
    Number(stockResultante),
    referenciaId ? String(referenciaId) : null,
    userId ? Number(userId) : null,
    date,
    notas ? String(notas) : null
  )
}

export function getKardex(productId, { limit = 50, offset = 0 } = {}) {
  let sql = `
    SELECT k.*, p.nombre as productoNombre, u.name as userName
    FROM kardex_movements k
    LEFT JOIN products p ON p.id = k.productId
    LEFT JOIN users u ON u.id = k.userId
    WHERE 1=1`
  const params = []
  if (productId) {
    sql += " AND k.productId = ?"
    params.push(Number(productId))
  }
  sql += " ORDER BY k.fecha DESC LIMIT ? OFFSET ?"
  params.push(Number(limit), Number(offset))

  return db.prepare(sql).all(...params)
}

export function getPurchaseById(id) {
  const purchase = db
    .prepare(
      `SELECT pur.*, u.name as userName
       FROM purchases pur
       LEFT JOIN users u ON u.id = pur.userId
       WHERE pur.id = ?`
    )
    .get(id)
  if (!purchase) return null
  const items = db
    .prepare(
      `SELECT pi.*, p.nombre as productoNombre, p.unidadMedida
       FROM purchase_items pi
       LEFT JOIN products p ON p.id = pi.productId
       WHERE pi.purchaseId = ?`
    )
    .all(id)
  purchase.items = items || []
  return purchase
}

export function listPurchases({ limit = 50, offset = 0 } = {}) {
  return db
    .prepare(
      `SELECT pur.*, u.name as userName,
              (SELECT COUNT(1) FROM purchase_items WHERE purchaseId = pur.id) as totalItems
       FROM purchases pur
       LEFT JOIN users u ON u.id = pur.userId
       ORDER BY pur.fecha DESC
       LIMIT ? OFFSET ?`
    )
    .all(Number(limit), Number(offset))
}

export function getBom(productoTerminadoId) {
  return db
    .prepare(
      `SELECT b.*, p.nombre as materiaPrimaNombre, p.stockActual, p.costoUnitario, p.unidadMedida as materiaPrimaUnidadMedida
       FROM bom_items b
       JOIN products p ON p.id = b.materiaPrimaId
       WHERE b.productoTerminadoId = ?`
    )
    .all(Number(productoTerminadoId))
}

export function setBomRecord(productoTerminadoId, items) {
  const now = Date.now()
  const pt = getProductById(productoTerminadoId)
  if (!pt) throw new Error("Producto terminado no encontrado")

  const transaction = db.transaction(() => {
    db.prepare("DELETE FROM bom_items WHERE productoTerminadoId = ?").run(Number(productoTerminadoId))
    const stmt = db.prepare(
      "INSERT INTO bom_items (productoTerminadoId, materiaPrimaId, cantidadRequerida, createdAt) VALUES (?, ?, ?, ?)"
    )
    for (const item of items) {
      stmt.run(Number(productoTerminadoId), Number(item.materiaPrimaId), Number(item.cantidadRequerida), now)
    }
  })
  transaction()
  return getBom(productoTerminadoId)
}

export function listAssemblyOrders() {
  return db
    .prepare(
      `SELECT ao.*, p.nombre as productoTerminadoNombre, u.name as userName
       FROM assembly_orders ao
       LEFT JOIN products p ON p.id = ao.productoTerminadoId
       LEFT JOIN users u ON u.id = ao.userId
       ORDER BY ao.date DESC`
    )
    .all()
}
