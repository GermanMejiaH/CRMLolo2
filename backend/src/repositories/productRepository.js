import db from "../db.js"

export function listProducts(filters = {}) {
  const { q, limit, offset, includeInactive = false, tipo } = filters
  let sql = "SELECT * FROM products WHERE 1=1"
  const params = []
  if (!includeInactive) {
    sql += " AND (active = 1 OR active IS NULL)"
  }
  if (tipo) {
    sql += " AND tipo = ?"
    params.push(String(tipo))
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

export function countProducts(filters = {}) {
  const { q, includeInactive = false, tipo } = filters
  let sql = "SELECT COUNT(1) as c FROM products WHERE 1=1"
  const params = []
  if (!includeInactive) {
    sql += " AND (active = 1 OR active IS NULL)"
  }
  if (tipo) {
    sql += " AND tipo = ?"
    params.push(String(tipo))
  }
  if (q) {
    sql += " AND lower(nombre) LIKE ?"
    params.push(`%${String(q).toLowerCase()}%`)
  }
  const row = db.prepare(sql).get(...params)
  return Number(row.c || 0)
}

export function getProductById(id) {
  return db.prepare("SELECT * FROM products WHERE id = ?").get(id)
}

export function addProductRecord(data) {
  const updatedAt = Date.now()
  const tipo = data.tipo || "producto_terminado"
  const costoUnitario = Number(data.costoUnitario || 0)
  const unidadMedida = data.unidadMedida || "unidades"
  const stmt = db.prepare(
    "INSERT INTO products (nombre, descripcion, precioMinimo, precioMaximo, stockActual, stockMinimo, tipo, costoUnitario, unidadMedida, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?)"
  )
  const info = stmt.run(
    data.nombre,
    data.descripcion || null,
    Number(data.precioMinimo || 0),
    Number(data.precioMaximo || 0),
    Number(data.stockActual || 0),
    Number(data.stockMinimo || 0),
    tipo,
    costoUnitario,
    unidadMedida,
    updatedAt
  )
  return getProductById(info.lastInsertRowid)
}

export function updateProductRecord(id, data) {
  const current = getProductById(id)
  if (!current) return null
  const updated = { ...current, ...data, updatedAt: Date.now() }
  const tipoVal = updated.tipo || current.tipo || "producto_terminado"
  const costoVal = updated.costoUnitario == null ? current.costoUnitario || 0 : Number(updated.costoUnitario)
  const unidadVal = updated.unidadMedida || current.unidadMedida || "unidades"
  db.prepare(
    "UPDATE products SET nombre=?, descripcion=?, precioMinimo=?, precioMaximo=?, stockActual=?, stockMinimo=?, tipo=?, costoUnitario=?, unidadMedida=?, updatedAt=?, active=? WHERE id=?"
  ).run(
    updated.nombre,
    updated.descripcion,
    Number(updated.precioMinimo || 0),
    Number(updated.precioMaximo || 0),
    Number(updated.stockActual || 0),
    Number(updated.stockMinimo || 0),
    tipoVal,
    costoVal,
    unidadVal,
    updated.updatedAt,
    updated.active == null ? (current.active ?? 1) : Number(updated.active ? 1 : 0),
    id
  )
  return getProductById(id)
}

export function deleteProductRecord(id) {
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

export function updateProductStockRaw(productId, newStock) {
  db.prepare("UPDATE products SET stockActual=?, updatedAt=? WHERE id=?").run(newStock, Date.now(), productId)
}

export function updateProductStockAndCostoRaw(productId, newStock, newCosto) {
  db.prepare("UPDATE products SET stockActual = ?, costoUnitario = ?, updatedAt = ? WHERE id = ?").run(
    newStock,
    newCosto,
    Date.now(),
    productId
  )
}
