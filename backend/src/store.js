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

function countProducts(filters = {}) {
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

function addProduct(data) {
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
    const estadoInicial = String(data.estado || "Pendiente")
    const info = stmtOrder.run(
      Number(data.clienteId),
      primaryItem.productoId,
      primaryItem.cantidad,
      primaryItem.precioUnitario,
      totalPedido,
      estadoInicial,
      metodo,
      data.notas || null,
      createdAt
    )
    const orderId = info.lastInsertRowid

    for (const item of processedItems) {
      stmtItem.run(orderId, item.productoId, item.cantidad, item.precioUnitario, item.subtotal)

      // Descontar stock del producto si el pedido no nace como Cancelado
      if (estadoInicial !== "Cancelado") {
        adjustStock(item.productoId, -item.cantidad, "venta_pedido", String(orderId), data.userId || null)
        const pUpdated = getProduct(item.productoId)
        recordKardexMovement(
          item.productoId,
          "VENTA",
          -item.cantidad,
          pUpdated ? pUpdated.stockActual : 0,
          `PEDIDO-${orderId}`,
          data.userId || null,
          `Venta al generar pedido #${orderId}`
        )
      }
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

  const userId = data.userId || null
  const newEstado = data.estado != null ? String(data.estado) : current.estado
  const newMetodo = data.metodoPago == null ? current.metodoPago : String(data.metodoPago).trim() || "Efectivo"
  const newClienteId = data.clienteId != null ? Number(data.clienteId) : current.clienteId
  const newNotas = data.notas != null ? data.notas : current.notas

  const isOldActive = current.estado !== "Cancelado"
  const isNewActive = newEstado !== "Cancelado"

  const transaction = db.transaction(() => {
    // 1. Cambio de estado de activo a Cancelado -> Restaurar stock
    if (isOldActive && !isNewActive) {
      const itemsToRestore = current.items && current.items.length > 0
        ? current.items
        : [{ productoId: current.productoId, cantidad: current.cantidad }]
      for (const item of itemsToRestore) {
        if (item.productoId && item.cantidad > 0) {
          adjustStock(item.productoId, Number(item.cantidad), "pedido_cancelado", String(id), userId)
          const pUpdated = getProduct(item.productoId)
          recordKardexMovement(
            item.productoId,
            "CANCELACION_PEDIDO",
            Number(item.cantidad),
            pUpdated ? pUpdated.stockActual : 0,
            `PEDIDO-${id}`,
            userId,
            `Restauración de stock por cancelación de pedido #${id}`
          )
        }
      }
    }
    // 2. Cambio de estado de Cancelado a activo -> Descontar stock
    else if (!isOldActive && isNewActive) {
      const itemsToDeduct = current.items && current.items.length > 0
        ? current.items
        : [{ productoId: current.productoId, cantidad: current.cantidad }]
      for (const item of itemsToDeduct) {
        if (item.productoId && item.cantidad > 0) {
          adjustStock(item.productoId, -Number(item.cantidad), "venta_pedido", String(id), userId)
          const pUpdated = getProduct(item.productoId)
          recordKardexMovement(
            item.productoId,
            "VENTA",
            -Number(item.cantidad),
            pUpdated ? pUpdated.stockActual : 0,
            `PEDIDO-${id}`,
            userId,
            `Descuento de stock por reactivación de pedido #${id}`
          )
        }
      }
    }

    db.prepare(
      "UPDATE orders SET clienteId=?, productoId=?, cantidad=?, precioUnitario=?, total=?, estado=?, metodoPago=?, notas=? WHERE id=?"
    ).run(
      newClienteId,
      data.productoId ?? current.productoId,
      data.cantidad ?? current.cantidad,
      data.precioUnitario ?? current.precioUnitario,
      data.total ?? current.total,
      newEstado,
      newMetodo,
      newNotas,
      id
    )
  })

  transaction()
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

function deleteOrder(id, userId) {
  const current = getOrder(id)
  if (!current) return false

  const transaction = db.transaction(() => {
    if (current.estado !== "Cancelado") {
      const itemsToRestore = current.items && current.items.length > 0
        ? current.items
        : [{ productoId: current.productoId, cantidad: current.cantidad }]
      for (const item of itemsToRestore) {
        if (item.productoId && item.cantidad > 0) {
          adjustStock(item.productoId, Number(item.cantidad), "pedido_eliminado", String(id), userId || null)
          const pUpdated = getProduct(item.productoId)
          recordKardexMovement(
            item.productoId,
            "ELIMINACION_PEDIDO",
            Number(item.cantidad),
            pUpdated ? pUpdated.stockActual : 0,
            `PEDIDO-${id}`,
            userId || null,
            `Restauración de stock por eliminación de pedido #${id}`
          )
        }
      }
    }
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

function getBom(productoTerminadoId) {
  return db
    .prepare(
      `SELECT b.*, p.nombre as materiaPrimaNombre, p.stockActual, p.costoUnitario, p.unidadMedida as materiaPrimaUnidadMedida
       FROM bom_items b
       JOIN products p ON p.id = b.materiaPrimaId
       WHERE b.productoTerminadoId = ?`
    )
    .all(Number(productoTerminadoId))
}

function setBom(productoTerminadoId, items) {
  const now = Date.now()
  const pt = getProduct(productoTerminadoId)
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

function checkAssemblyAvailability(productoTerminadoId, cantidadProducida) {
  const pt = getProduct(productoTerminadoId)
  if (!pt) throw new Error("Producto terminado no encontrado")
  const recipe = getBom(productoTerminadoId)
  if (recipe.length === 0) {
    return {
      available: false,
      reason: "El producto no tiene una receta (BOM) configurada",
      items: [],
      totalCost: 0,
      unitCost: 0
    }
  }

  let totalUnitCost = 0
  let allAvailable = true

  const evaluatedItems = recipe.map((item) => {
    const required = Number(item.cantidadRequerida) * Number(cantidadProducida)
    const currentStock = Number(item.stockActual || 0)
    const isSufficient = currentStock >= required
    if (!isSufficient) allAvailable = false
    const itemUnitCost = Number(item.costoUnitario || 0) * Number(item.cantidadRequerida)
    totalUnitCost += itemUnitCost

    return {
      materiaPrimaId: item.materiaPrimaId,
      materiaPrimaNombre: item.materiaPrimaNombre,
      materiaPrimaUnidadMedida: item.materiaPrimaUnidadMedida || "unidades",
      cantidadRequeridaUnitaria: item.cantidadRequerida,
      cantidadTotalRequerida: required,
      stockActual: currentStock,
      suficiente: isSufficient,
      faltante: isSufficient ? 0 : required - currentStock,
      costoUnitarioMateria: item.costoUnitario || 0
    }
  })

  const totalCost = Math.round(totalUnitCost * Number(cantidadProducida))
  const unitCost = Math.round(totalUnitCost)

  return {
    available: allAvailable,
    reason: allAvailable ? "OK" : "Materia prima / insumos insuficientes",
    items: evaluatedItems,
    totalCost,
    unitCost
  }
}

function recordKardexMovement(productId, tipoMovimiento, cantidad, stockResultante, referenciaId = null, userId = null, notas = null) {
  const p = getProduct(productId)
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

function createPurchase(data, userId) {
  const proveedor = data.proveedor
  const items = data.items || []
  const notas = data.notas || null
  const date = Date.now()

  let totalCost = 0
  const processedItems = items.map((it) => {
    const pid = Number(it.productId)
    const cant = Number(it.cantidad)
    const costoUnit = Number(it.costoUnitario)
    const subtotal = Math.round(cant * costoUnit)
    totalCost += subtotal
    return { productId: pid, cantidad: cant, costoUnitario: costoUnit, subtotal }
  })

  const transaction = db.transaction(() => {
    const info = db
      .prepare("INSERT INTO purchases (proveedor, totalCost, fecha, userId, notas, createdAt) VALUES (?,?,?,?,?,?)")
      .run(proveedor, totalCost, date, userId || null, notas, date)
    const purchaseId = info.lastInsertRowid

    const stmtItem = db.prepare(
      "INSERT INTO purchase_items (purchaseId, productId, cantidad, costoUnitario, subtotal) VALUES (?,?,?,?,?)"
    )

    for (const item of processedItems) {
      stmtItem.run(purchaseId, item.productId, item.cantidad, item.costoUnitario, item.subtotal)

      const p = getProduct(item.productId)
      if (p) {
        const oldStock = Number(p.stockActual || 0)
        const oldCosto = Number(p.costoUnitario || 0)
        const newStock = oldStock + item.cantidad
        let newCosto = item.costoUnitario
        if (newStock > 0 && oldStock * oldCosto + item.cantidad * item.costoUnitario > 0) {
          newCosto = Math.round((oldStock * oldCosto + item.cantidad * item.costoUnitario) / newStock)
        }

        db.prepare("UPDATE products SET stockActual = ?, costoUnitario = ?, updatedAt = ? WHERE id = ?").run(
          newStock,
          newCosto,
          date,
          item.productId
        )

        recordKardexMovement(
          item.productId,
          "COMPRA",
          item.cantidad,
          newStock,
          `COMPRA-${purchaseId}`,
          userId,
          `Compra a ${proveedor}`
        )
      }
    }

    return purchaseId
  })

  const purchaseId = transaction()
  return getPurchase(purchaseId)
}

function getPurchase(id) {
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

function listPurchases({ limit = 50, offset = 0 } = {}) {
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

function getKardex(productId, { limit = 50, offset = 0 } = {}) {
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

function getCapacidadEnsambladoTeorica(productoTerminadoId) {
  const pt = getProduct(productoTerminadoId)
  if (!pt) throw new Error("Producto terminado no encontrado")
  const recipe = getBom(productoTerminadoId)

  if (!recipe || recipe.length === 0) {
    return {
      productoTerminadoId: Number(productoTerminadoId),
      productoTerminadoNombre: pt.nombre,
      capacidadMaxima: 0,
      reason: "Sin receta BOM configurada",
      cuelloDeBotella: null,
      insumos: []
    }
  }

  let minUnits = Infinity
  let bottleneck = null

  const insumosEvaluados = recipe.map((item) => {
    const required = Number(item.cantidadRequerida || 0)
    const available = Number(item.stockActual || 0)
    const possible = required > 0 ? Math.floor(available / required) : 0

    if (possible < minUnits) {
      minUnits = possible
      bottleneck = {
        materiaPrimaId: item.materiaPrimaId,
        materiaPrimaNombre: item.materiaPrimaNombre,
        stockActual: available,
        unidadMedida: item.materiaPrimaUnidadMedida || "unidades",
        cantidadRequeridaUnitaria: required
      }
    }

    return {
      materiaPrimaId: item.materiaPrimaId,
      materiaPrimaNombre: item.materiaPrimaNombre,
      stockActual: available,
      unidadMedida: item.materiaPrimaUnidadMedida || "unidades",
      cantidadRequeridaUnitaria: required,
      capacidadPosible: possible
    }
  })

  const capacidadMaxima = minUnits === Infinity ? 0 : Math.max(0, minUnits)

  return {
    productoTerminadoId: Number(productoTerminadoId),
    productoTerminadoNombre: pt.nombre,
    capacidadMaxima,
    cuelloDeBotella: capacidadMaxima === 0 || bottleneck ? bottleneck : null,
    insumos: insumosEvaluados
  }
}

function executeAssemblyOrder(productoTerminadoId, cantidadProducida, userId, notas) {
  const check = checkAssemblyAvailability(productoTerminadoId, cantidadProducida)
  if (!check.available) {
    throw new Error(`No se puede ensamblar: ${check.reason}`)
  }

  const date = Date.now()
  const pt = getProduct(productoTerminadoId)

  const transaction = db.transaction(() => {
    // 1. Descontar materias primas
    for (const item of check.items) {
      adjustStock(
        item.materiaPrimaId,
        -item.cantidadTotalRequerida,
        "Consumo Producción",
        `Ensamblado de ${cantidadProducida} uds de ${pt.nombre}`,
        userId
      )
      const mp = getProduct(item.materiaPrimaId)
      recordKardexMovement(
        item.materiaPrimaId,
        "ENSAMBLADO_CONSUMO",
        -item.cantidadTotalRequerida,
        mp ? mp.stockActual : 0,
        null,
        userId,
        `Consumo para producir ${cantidadProducida} uds de ${pt.nombre}`
      )
    }

    // 2. Aumentar stock de producto terminado y actualizar costo unitario
    adjustStock(
      productoTerminadoId,
      Number(cantidadProducida),
      "Entrada Producción",
      `Ensamblado de ${cantidadProducida} uds`,
      userId
    )
    db.prepare("UPDATE products SET costoUnitario = ? WHERE id = ?").run(check.unitCost, Number(productoTerminadoId))

    const ptUpdated = getProduct(productoTerminadoId)

    // 3. Registrar orden de ensamblado
    const info = db
      .prepare(
        "INSERT INTO assembly_orders (productoTerminadoId, cantidadProducida, costoTotalProduccion, costoUnitario, date, userId, notas) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
      .run(
        Number(productoTerminadoId),
        Number(cantidadProducida),
        check.totalCost,
        check.unitCost,
        date,
        userId || null,
        notas || null
      )

    const orderId = info.lastInsertRowid

    recordKardexMovement(
      productoTerminadoId,
      "ENSAMBLADO_PRODUCCION",
      Number(cantidadProducida),
      ptUpdated ? ptUpdated.stockActual : 0,
      `ORDEN-${orderId}`,
      userId,
      `Ensamblado de ${cantidadProducida} uds`
    )

    return db.prepare("SELECT * FROM assembly_orders WHERE id = ?").get(orderId)
  })

  const order = transaction()
  return { order, summary: check }
}

function listAssemblyOrders() {
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

function getReporteRentabilidad(filters = {}) {
  const { from, to, clienteId, productoId } = filters
  let sql = `
    SELECT oi.id, oi.orderId, oi.productoId, oi.cantidad, oi.precioUnitario, oi.subtotal as totalVenta,
           o.clienteId, o.createdAt, c.nombre as clienteNombre, p.nombre as productoNombre, p.costoUnitario as productoCostoUnitario
    FROM order_items oi
    JOIN orders o ON o.id = oi.orderId
    LEFT JOIN clients c ON c.id = o.clienteId
    LEFT JOIN products p ON p.id = oi.productoId
    WHERE o.estado != 'Cancelado'`
  const params = []

  if (typeof from === "number") {
    sql += " AND o.createdAt >= ?"
    params.push(Number(from))
  }
  if (typeof to === "number") {
    sql += " AND o.createdAt <= ?"
    params.push(Number(to))
  }
  if (clienteId) {
    sql += " AND o.clienteId = ?"
    params.push(Number(clienteId))
  }
  if (productoId) {
    sql += " AND oi.productoId = ?"
    params.push(Number(productoId))
  }

  const items = db.prepare(sql).all(...params)

  let totalVentas = 0
  let totalCOGS = 0

  const mapProducto = {}
  const mapCliente = {}

  for (const item of items) {
    const v = Number(item.totalVenta || 0)
    totalVentas += v

    const recipe = getBom(item.productoId)
    let unitCogs = 0
    if (recipe && recipe.length > 0) {
      unitCogs = recipe.reduce(
        (sum, ingredient) => sum + Number(ingredient.cantidadRequerida || 0) * Number(ingredient.costoUnitario || 0),
        0
      )
    } else {
      unitCogs = Number(item.productoCostoUnitario || 0)
    }

    const itemCogs = Math.round(unitCogs * Number(item.cantidad || 0))
    totalCOGS += itemCogs
    const gananciaItem = v - itemCogs

    const pid = item.productoId
    if (!mapProducto[pid]) {
      mapProducto[pid] = {
        productoId: pid,
        productoNombre: item.productoNombre,
        totalUnidades: 0,
        totalVentas: 0,
        totalCOGS: 0,
        gananciaBruta: 0
      }
    }
    mapProducto[pid].totalUnidades += Number(item.cantidad || 0)
    mapProducto[pid].totalVentas += v
    mapProducto[pid].totalCOGS += itemCogs
    mapProducto[pid].gananciaBruta += gananciaItem

    const cid = item.clienteId
    if (!mapCliente[cid]) {
      mapCliente[cid] = {
        clienteId: cid,
        clienteNombre: item.clienteNombre,
        totalVentas: 0,
        totalCOGS: 0,
        gananciaBruta: 0
      }
    }
    mapCliente[cid].totalVentas += v
    mapCliente[cid].totalCOGS += itemCogs
    mapCliente[cid].gananciaBruta += gananciaItem
  }

  const gananciaBrutaTotal = totalVentas - totalCOGS
  const margenPromedioPercent = totalVentas > 0 ? Number(((gananciaBrutaTotal / totalVentas) * 100).toFixed(2)) : 0

  const porProducto = Object.values(mapProducto)
    .map((p) => ({
      ...p,
      margenPercent: p.totalVentas > 0 ? Number(((p.gananciaBruta / p.totalVentas) * 100).toFixed(2)) : 0
    }))
    .sort((a, b) => b.gananciaBruta - a.gananciaBruta)

  const porCliente = Object.values(mapCliente)
    .map((c) => ({
      ...c,
      margenPercent: c.totalVentas > 0 ? Number(((c.gananciaBruta / c.totalVentas) * 100).toFixed(2)) : 0
    }))
    .sort((a, b) => b.gananciaBruta - a.gananciaBruta)

  return {
    summary: {
      totalVentas,
      totalCOGS,
      gananciaBrutaTotal,
      margenPromedioPercent
    },
    porProducto,
    porCliente
  }
}

function getAlertasStockYReorden(tipoFilter = "materia_prima") {
  let sql = `SELECT * FROM products WHERE (active = 1 OR active IS NULL) AND stockActual <= stockMinimo`
  const params = []

  if (tipoFilter && tipoFilter !== "todas") {
    sql += ` AND tipo = ?`
    params.push(tipoFilter)
  }

  sql += ` ORDER BY (stockMinimo - stockActual) DESC`

  const products = db.prepare(sql).all(...params)

  const items = products.map((p) => {
    const stockActual = Number(p.stockActual || 0)
    const stockMinimo = Number(p.stockMinimo || 0)
    const faltanteMinimo = Math.max(0, stockMinimo - stockActual)
    const sugerenciaReorden = Math.max(faltanteMinimo, stockMinimo * 2 - stockActual)

    return {
      productoId: p.id,
      nombre: p.nombre,
      tipo: p.tipo,
      unidadMedida: p.unidadMedida || "unidades",
      stockActual,
      stockMinimo,
      costoUnitario: p.costoUnitario || 0,
      faltanteMinimo,
      sugerenciaReorden,
      costoEstimadoReorden: Math.round(sugerenciaReorden * (p.costoUnitario || 0))
    }
  })

  return {
    alertasCount: items.length,
    items
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
  getClientResumen360,
  getBom,
  setBom,
  checkAssemblyAvailability,
  executeAssemblyOrder,
  listAssemblyOrders,
  recordKardexMovement,
  createPurchase,
  getPurchase,
  listPurchases,
  getKardex,
  getCapacidadEnsambladoTeorica,
  getReporteRentabilidad,
  getAlertasStockYReorden
}


