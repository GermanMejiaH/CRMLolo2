import db from "../db.js"
import { getCostoManoObraUnitaria } from "./settingService.js"

function getMonthTimestamps(year, month) {
  const now = new Date()
  const y = year ? Number(year) : now.getFullYear()
  const m = month ? Number(month) - 1 : now.getMonth()

  const startOfMonth = new Date(y, m, 1, 0, 0, 0, 0).getTime()
  const endOfMonth = new Date(y, m + 1, 0, 23, 59, 59, 999).getTime()
  return { startOfMonth, endOfMonth, y, m: m + 1 }
}

export function getExecutiveDashboard(filters = {}) {
  const { startOfMonth, endOfMonth } = getMonthTimestamps(filters.year, filters.month)

  // Ventas del mes
  const ventasRow = db
    .prepare(
      `SELECT COALESCE(SUM(total), 0) as totalVentas
       FROM orders
       WHERE estado != 'Cancelado' AND createdAt >= ? AND createdAt <= ?`
    )
    .get(startOfMonth, endOfMonth)
  const ventasMesActual = Number(ventasRow?.totalVentas || 0)

  // Utilidad del mes (usa utilidadHistorica si existe, o fallback a cálculo)
  const orderItemsRow = db
    .prepare(
      `SELECT oi.subtotal, oi.utilidadHistorica, oi.costoTotalHistorico, oi.cantidad, oi.productoId, p.costoUnitario
       FROM order_items oi
       JOIN orders o ON o.id = oi.orderId
       LEFT JOIN products p ON p.id = oi.productoId
       WHERE o.estado != 'Cancelado' AND o.createdAt >= ? AND o.createdAt <= ?`
    )
    .all(startOfMonth, endOfMonth)

  let utilidadMesActual = 0
  const costoManoObraUnit = getCostoManoObraUnitaria()

  for (const item of orderItemsRow) {
    if (item.utilidadHistorica != null) {
      utilidadMesActual += Number(item.utilidadHistorica)
    } else {
      const subtotal = Number(item.subtotal || 0)
      const cost = Number(item.costoTotalHistorico || (item.costoUnitario || 0) * item.cantidad)
      utilidadMesActual += subtotal - cost
    }
  }

  // Producción del mes
  const prodRow = db
    .prepare(
      `SELECT COALESCE(SUM(cantidadProducida), 0) as unidades,
              COALESCE(SUM(costoTotalProduccion), 0) as costoTotal
       FROM assembly_orders
       WHERE date >= ? AND date <= ?`
    )
    .get(startOfMonth, endOfMonth)
  const produccionMesActual = {
    unidades: Number(prodRow?.unidades || 0),
    costoTotal: Number(prodRow?.costoTotal || 0)
  }

  // Pedidos pendientes
  const pendRow = db.prepare("SELECT COUNT(1) as count FROM orders WHERE estado = 'Pendiente'").get()
  const pedidosPendientes = Number(pendRow?.count || 0)

  // Clientes activos
  const cliRow = db.prepare("SELECT COUNT(1) as count FROM clients WHERE active = 1 OR active IS NULL").get()
  const clientesActivos = Number(cliRow?.count || 0)

  // Productos activos
  const prodActRow = db.prepare("SELECT COUNT(1) as count FROM products WHERE active = 1 OR active IS NULL").get()
  const productosActivos = Number(prodActRow?.count || 0)

  return {
    ventasMesActual,
    utilidadMesActual,
    produccionMesActual,
    pedidosPendientes,
    clientesActivos,
    productosActivos
  }
}

export function getOperationalAlerts() {
  // 1. Stock crítico (stockActual <= stockMinimo / 2)
  const stockCritico = db
    .prepare(
      `SELECT id, nombre, tipo, stockActual, stockMinimo, unidadMedida
       FROM products
       WHERE (active = 1 OR active IS NULL) AND stockActual <= (stockMinimo / 2)`
    )
    .all()

  // 2. Material próximo a agotarse (tipo = materia_prima y stockActual <= stockMinimo)
  const materialAgotarse = db
    .prepare(
      `SELECT id, nombre, stockActual, stockMinimo, unidadMedida
       FROM products
       WHERE (active = 1 OR active IS NULL) AND tipo = 'materia_prima' AND stockActual <= stockMinimo`
    )
    .all()

  // 3. Productos sin ventas recientes en los últimos 30 días
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
  const productosSinVentas = db
    .prepare(
      `SELECT id, nombre, stockActual, precioMinimo
       FROM products
       WHERE (active = 1 OR active IS NULL) AND tipo = 'producto_terminado'
         AND id NOT IN (
           SELECT DISTINCT oi.productoId
           FROM order_items oi
           JOIN orders o ON o.id = oi.orderId
           WHERE o.estado != 'Cancelado' AND o.createdAt >= ?
         )`
    )
    .all(thirtyDaysAgo)

  // 4. Clientes inactivos sin compras en los últimos 60 días
  const sixtyDaysAgo = Date.now() - 60 * 24 * 60 * 60 * 1000
  const clientesInactivos = db
    .prepare(
      `SELECT id, nombre, contacto, telefono, email
       FROM clients
       WHERE (active = 1 OR active IS NULL)
         AND id NOT IN (
           SELECT DISTINCT clienteId
           FROM orders
           WHERE estado != 'Cancelado' AND createdAt >= ?
         )`
    )
    .all(sixtyDaysAgo)

  const totalAlertas = stockCritico.length + materialAgotarse.length + productosSinVentas.length + clientesInactivos.length
  const criticas = stockCritico.length

  return {
    stockCritico,
    materialAgotarse,
    productosSinVentas,
    clientesInactivos,
    resumen: {
      totalAlertas,
      criticas
    }
  }
}

export function getInventoryProjections() {
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
  const products = db
    .prepare("SELECT id, nombre, tipo, stockActual, stockMinimo, unidadMedida FROM products WHERE active = 1 OR active IS NULL")
    .all()

  const projections = []

  for (const p of products) {
    let usoUltimos30Dias = 0

    if (p.tipo === "producto_terminado") {
      const salesRow = db
        .prepare(
          `SELECT COALESCE(SUM(oi.cantidad), 0) as total
           FROM order_items oi
           JOIN orders o ON o.id = oi.orderId
           WHERE o.estado != 'Cancelado' AND oi.productoId = ? AND o.createdAt >= ?`
        )
        .get(p.id, thirtyDaysAgo)
      usoUltimos30Dias = Number(salesRow?.total || 0)
    } else {
      const consRow = db
        .prepare(
          `SELECT COALESCE(SUM(ABS(cantidad)), 0) as total
           FROM kardex_movements
           WHERE productId = ? AND tipoMovimiento IN ('ENSAMBLADO_CONSUMO', 'AJUSTE_SALIDA') AND fecha >= ?`
        )
        .get(p.id, thirtyDaysAgo)
      usoUltimos30Dias = Number(consRow?.total || 0)
    }

    const consumoPromedioDiario = Number((usoUltimos30Dias / 30).toFixed(2))
    const stockActual = Number(p.stockActual || 0)
    const stockMinimo = Number(p.stockMinimo || 0)

    const diasRestantes = consumoPromedioDiario > 0 ? Math.floor(stockActual / consumoPromedioDiario) : 999
    const fechaAgotamientoEstimada =
      diasRestantes < 999 ? new Date(Date.now() + diasRestantes * 24 * 60 * 60 * 1000).toISOString().split("T")[0] : null
    const requiereReorden = diasRestantes <= 7 || stockActual <= stockMinimo

    projections.push({
      productoId: p.id,
      nombre: p.nombre,
      tipo: p.tipo,
      unidadMedida: p.unidadMedida || "unidades",
      stockActual,
      stockMinimo,
      usoUltimos30Dias,
      consumoPromedioDiario,
      diasRestantes: diasRestantes === 999 ? null : diasRestantes,
      fechaAgotamientoEstimada,
      requiereReorden
    })
  }

  return projections.sort((a, b) => {
    const da = a.diasRestantes == null ? 9999 : a.diasRestantes
    const dbVal = b.diasRestantes == null ? 9999 : b.diasRestantes
    return da - dbVal
  })
}

export function getClientRankings() {
  const sixtyDaysAgo = Date.now() - 60 * 24 * 60 * 60 * 1000

  // 1. Más ventas
  const masVentas = db
    .prepare(
      `SELECT c.id as clienteId, c.nombre as clienteNombre, COALESCE(SUM(o.total), 0) as totalVentas
       FROM clients c
       JOIN orders o ON o.clienteId = c.id
       WHERE o.estado != 'Cancelado'
       GROUP BY c.id
       ORDER BY totalVentas DESC
       LIMIT 10`
    )
    .all()

  // 2. Más utilidad
  const masUtilidad = db
    .prepare(
      `SELECT c.id as clienteId, c.nombre as clienteNombre, COALESCE(SUM(COALESCE(o.utilidadHistorica, o.total)), 0) as utilidadTotal
       FROM clients c
       JOIN orders o ON o.clienteId = c.id
       WHERE o.estado != 'Cancelado'
       GROUP BY c.id
       ORDER BY utilidadTotal DESC
       LIMIT 10`
    )
    .all()

  // 3. Más pedidos
  const masPedidos = db
    .prepare(
      `SELECT c.id as clienteId, c.nombre as clienteNombre, COUNT(o.id) as totalPedidos
       FROM clients c
       JOIN orders o ON o.clienteId = c.id
       WHERE o.estado != 'Cancelado'
       GROUP BY c.id
       ORDER BY totalPedidos DESC
       LIMIT 10`
    )
    .all()

  // 4. Clientes inactivos
  const inactivos = db
    .prepare(
      `SELECT id as clienteId, nombre as clienteNombre, contacto, telefono, email
       FROM clients
       WHERE (active = 1 OR active IS NULL)
         AND id NOT IN (
           SELECT DISTINCT clienteId FROM orders WHERE estado != 'Cancelado' AND createdAt >= ?
         )`
    )
    .all(sixtyDaysAgo)

  return {
    masVentas,
    masUtilidad,
    masPedidos,
    inactivos
  }
}

export function getProductRankings() {
  // 1. Más vendidos
  const masVendidos = db
    .prepare(
      `SELECT p.id as productoId, p.nombre as productoNombre, COALESCE(SUM(oi.cantidad), 0) as unidadesVendidas, COALESCE(SUM(oi.subtotal), 0) as totalVentas
       FROM products p
       JOIN order_items oi ON oi.productoId = p.id
       JOIN orders o ON o.id = oi.orderId
       WHERE o.estado != 'Cancelado'
       GROUP BY p.id
       ORDER BY unidadesVendidas DESC
       LIMIT 10`
    )
    .all()

  // 2. Más rentables
  const masRentables = db
    .prepare(
      `SELECT p.id as productoId, p.nombre as productoNombre, COALESCE(SUM(COALESCE(oi.utilidadHistorica, oi.subtotal)), 0) as utilidadTotal
       FROM products p
       JOIN order_items oi ON oi.productoId = p.id
       JOIN orders o ON o.id = oi.orderId
       WHERE o.estado != 'Cancelado'
       GROUP BY p.id
       ORDER BY utilidadTotal DESC
       LIMIT 10`
    )
    .all()

  // 3. Menos rentables
  const menosRentables = db
    .prepare(
      `SELECT p.id as productoId, p.nombre as productoNombre, COALESCE(SUM(COALESCE(oi.utilidadHistorica, oi.subtotal)), 0) as utilidadTotal
       FROM products p
       JOIN order_items oi ON oi.productoId = p.id
       JOIN orders o ON o.id = oi.orderId
       WHERE o.estado != 'Cancelado'
       GROUP BY p.id
       ORDER BY utilidadTotal ASC
       LIMIT 10`
    )
    .all()

  // 4. Menor rotación (días transcurridos desde última venta)
  const products = db.prepare("SELECT id, nombre, stockActual FROM products WHERE (active = 1 OR active IS NULL) AND tipo = 'producto_terminado'").all()
  const menorRotacion = products
    .map((p) => {
      const lastSaleRow = db
        .prepare(
          `SELECT MAX(o.createdAt) as ultimaVenta
           FROM orders o
           JOIN order_items oi ON oi.orderId = o.id
           WHERE o.estado != 'Cancelado' AND oi.productoId = ?`
        )
        .get(p.id)
      const lastTs = lastSaleRow?.ultimaVenta
      const diasSinVenta = lastTs ? Math.floor((Date.now() - Number(lastTs)) / (24 * 60 * 60 * 1000)) : 999
      return {
        productoId: p.id,
        nombre: p.nombre,
        stockActual: p.stockActual,
        diasSinVenta: diasSinVenta === 999 ? null : diasSinVenta
      }
    })
    .sort((a, b) => (b.diasSinVenta ?? 9999) - (a.diasSinVenta ?? 9999))
    .slice(0, 10)

  return {
    masVendidos,
    masRentables,
    menosRentables,
    menorRotacion
  }
}

export function getBusinessHealth() {
  const now = new Date()
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime()
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime()

  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0).getTime()
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).getTime()

  // Ventas
  const vCurrent = Number(db.prepare("SELECT COALESCE(SUM(total), 0) as t FROM orders WHERE estado != 'Cancelado' AND createdAt >= ? AND createdAt <= ?").get(currentMonthStart, currentMonthEnd)?.t || 0)
  const vPrev = Number(db.prepare("SELECT COALESCE(SUM(total), 0) as t FROM orders WHERE estado != 'Cancelado' AND createdAt >= ? AND createdAt <= ?").get(prevMonthStart, prevMonthEnd)?.t || 0)
  const vCambio = vPrev > 0 ? Number((((vCurrent - vPrev) / vPrev) * 100).toFixed(2)) : (vCurrent > 0 ? 100 : 0)

  // Utilidad
  const uCurrentRow = db.prepare("SELECT COALESCE(SUM(utilidadHistorica), 0) as u FROM orders WHERE estado != 'Cancelado' AND createdAt >= ? AND createdAt <= ?").get(currentMonthStart, currentMonthEnd)
  const uPrevRow = db.prepare("SELECT COALESCE(SUM(utilidadHistorica), 0) as u FROM orders WHERE estado != 'Cancelado' AND createdAt >= ? AND createdAt <= ?").get(prevMonthStart, prevMonthEnd)
  const uCurrent = Number(uCurrentRow?.u || vCurrent * 0.4)
  const uPrev = Number(uPrevRow?.u || vPrev * 0.4)
  const uCambio = uPrev > 0 ? Number((((uCurrent - uPrev) / uPrev) * 100).toFixed(2)) : (uCurrent > 0 ? 100 : 0)

  // Producción
  const pCurrent = Number(db.prepare("SELECT COALESCE(SUM(cantidadProducida), 0) as p FROM assembly_orders WHERE date >= ? AND date <= ?").get(currentMonthStart, currentMonthEnd)?.p || 0)
  const pPrev = Number(db.prepare("SELECT COALESCE(SUM(cantidadProducida), 0) as p FROM assembly_orders WHERE date >= ? AND date <= ?").get(prevMonthStart, prevMonthEnd)?.p || 0)
  const pCambio = pPrev > 0 ? Number((((pCurrent - pPrev) / pPrev) * 100).toFixed(2)) : (pCurrent > 0 ? 100 : 0)

  // Inventario
  const prodCriticosCount = Number(db.prepare("SELECT COUNT(1) as c FROM products WHERE (active = 1 OR active IS NULL) AND stockActual <= (stockMinimo / 2)").get()?.c || 0)

  function evaluateStatus(cambioPercent) {
    if (cambioPercent > 5) return "Mejorando"
    if (cambioPercent >= -5) return "Estable"
    return "Requiere atención"
  }

  const statusVentas = evaluateStatus(vCambio)
  const statusUtilidad = evaluateStatus(uCambio)
  const statusProduccion = evaluateStatus(pCambio)
  const statusInventario = prodCriticosCount === 0 ? "Excelente" : prodCriticosCount <= 2 ? "Estable" : "Requiere atención"

  const statusList = [statusVentas, statusUtilidad, statusProduccion]
  let saludGeneral = "Estable"

  if (statusList.includes("Requiere atención") || statusInventario === "Requiere atención") {
    saludGeneral = "Requiere atención"
  } else if (statusList.filter((s) => s === "Mejorando").length >= 2) {
    saludGeneral = "Mejorando"
  }

  return {
    ventas: { mesActual: vCurrent, mesAnterior: vPrev, cambioPercent: vCambio, estado: statusVentas },
    utilidad: { mesActual: uCurrent, mesAnterior: uPrev, cambioPercent: uCambio, estado: statusUtilidad },
    produccion: { mesActual: pCurrent, mesAnterior: pPrev, cambioPercent: pCambio, estado: statusProduccion },
    inventario: { productosCriticos: prodCriticosCount, estado: statusInventario },
    saludGeneral
  }
}

export function getMonthlyClosureData(year, month) {
  const { startOfMonth, endOfMonth, y, m } = getMonthTimestamps(year, month)

  const dashboard = getExecutiveDashboard({ year: y, month: m })
  const rankings = {
    topClientes: getClientRankings().masVentas.slice(0, 5),
    topProductos: getProductRankings().masVendidos.slice(0, 5)
  }

  return {
    periodo: `${y}-${String(m).padStart(2, "0")}`,
    ventasTotales: dashboard.ventasMesActual,
    utilidadTotal: dashboard.utilidadMesActual,
    produccion: dashboard.produccionMesActual,
    topClientes: rankings.topClientes,
    topProductos: rankings.topProductos
  }
}
