import db from "../db.js"
import { getBom } from "./bomService.js"
import { getCostoManoObraUnitaria } from "./settingService.js"
import { listSalesSeries as listSeries } from "../repositories/orderRepository.js"

export function listSalesSeries(filters = {}) {
  return listSeries(filters)
}

export function getDashboardStats() {
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

export function getReporteRentabilidad(filters = {}) {
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
  const costoManoObraUnit = getCostoManoObraUnitaria()

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

export function getRentabilidadPedidos(filters = {}) {
  const { from, to, clienteId, estado } = filters
  let sql = `
    SELECT o.id as orderId, o.clienteId, o.total as totalVenta, o.createdAt, o.estado, c.nombre as clienteNombre
    FROM orders o
    LEFT JOIN clients c ON c.id = o.clienteId
    WHERE 1=1`
  const params = []

  if (estado) {
    sql += " AND o.estado = ?"
    params.push(String(estado))
  } else {
    sql += " AND o.estado != 'Cancelado'"
  }
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

  const orders = db.prepare(sql).all(...params)
  const result = []
  const costoManoObraUnit = getCostoManoObraUnitaria()

  for (const order of orders) {
    let items = db
      .prepare(
        `SELECT oi.*, p.nombre as productoNombre, p.costoUnitario as productoCostoUnitario
         FROM order_items oi
         LEFT JOIN products p ON p.id = oi.productoId
         WHERE oi.orderId = ?`
      )
      .all(order.orderId)

    if (!items || items.length === 0) {
      const singleOrder = db.prepare("SELECT productoId, cantidad, precioUnitario, total FROM orders WHERE id = ?").get(order.orderId)
      if (singleOrder && singleOrder.productoId) {
        const p = db.prepare("SELECT nombre, costoUnitario FROM products WHERE id = ?").get(singleOrder.productoId)
        items = [
          {
            productoId: singleOrder.productoId,
            cantidad: singleOrder.cantidad,
            precioUnitario: singleOrder.precioUnitario,
            subtotal: singleOrder.total,
            productoNombre: p?.nombre || `Producto #${singleOrder.productoId}`,
            productoCostoUnitario: p?.costoUnitario || 0
          }
        ]
      }
    }

    let costoEstimado = 0
    const itemBreakdown = []

    for (const item of items || []) {
      const recipe = getBom(item.productoId)
      let unitCogs = 0
      if (recipe && recipe.length > 0) {
        const matCost = recipe.reduce(
          (sum, ing) => sum + Number(ing.cantidadRequerida || 0) * Number(ing.costoUnitario || 0),
          0
        )
        unitCogs = Math.round(matCost + costoManoObraUnit)
      } else {
        unitCogs = Number(item.productoCostoUnitario || 0)
      }

      const itemCogs = Math.round(unitCogs * Number(item.cantidad || 0))
      costoEstimado += itemCogs
      itemBreakdown.push({
        productoId: item.productoId,
        productoNombre: item.productoNombre,
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario,
        subtotal: item.subtotal,
        costoUnitarioEstimado: unitCogs,
        costoTotalEstimado: itemCogs
      })
    }

    const totalVenta = Number(order.totalVenta || 0)
    const ganancia = totalVenta - costoEstimado
    const margenPercent = totalVenta > 0 ? Number(((ganancia / totalVenta) * 100).toFixed(2)) : 0

    result.push({
      orderId: order.orderId,
      clienteId: order.clienteId,
      clienteNombre: order.clienteNombre || `Cliente #${order.clienteId}`,
      createdAt: order.createdAt,
      estado: order.estado,
      totalVenta,
      costoEstimado,
      ganancia,
      margenPercent,
      items: itemBreakdown
    })
  }

  return result
}

export function getRentabilidadClientes(filters = {}) {
  const rentabilidadPedidos = getRentabilidadPedidos(filters)
  const mapCliente = {}

  for (const ord of rentabilidadPedidos) {
    const cid = ord.clienteId
    if (!mapCliente[cid]) {
      mapCliente[cid] = {
        clienteId: cid,
        clienteNombre: ord.clienteNombre,
        ventasTotales: 0,
        costosEstimados: 0,
        ganancia: 0
      }
    }
    mapCliente[cid].ventasTotales += ord.totalVenta
    mapCliente[cid].costosEstimados += ord.costoEstimado
    mapCliente[cid].ganancia += ord.ganancia
  }

  return Object.values(mapCliente)
    .map((c) => ({
      ...c,
      margenPercent: c.ventasTotales > 0 ? Number(((c.ganancia / c.ventasTotales) * 100).toFixed(2)) : 0
    }))
    .sort((a, b) => b.ganancia - a.ganancia)
}

export function getRentabilidadProductos(filters = {}) {
  const rentabilidadPedidos = getRentabilidadPedidos(filters)
  const mapProducto = {}

  for (const ord of rentabilidadPedidos) {
    for (const item of ord.items) {
      const pid = item.productoId
      if (!mapProducto[pid]) {
        mapProducto[pid] = {
          productoId: pid,
          productoNombre: item.productoNombre,
          unidadesVendidas: 0,
          ventas: 0,
          costos: 0,
          utilidad: 0
        }
      }
      mapProducto[pid].unidadesVendidas += Number(item.cantidad || 0)
      mapProducto[pid].ventas += Number(item.subtotal || 0)
      mapProducto[pid].costos += Number(item.costoTotalEstimado || 0)
      mapProducto[pid].utilidad += Number(item.subtotal || 0) - Number(item.costoTotalEstimado || 0)
    }
  }

  return Object.values(mapProducto)
    .map((p) => ({
      ...p,
      margenPercent: p.ventas > 0 ? Number(((p.utilidad / p.ventas) * 100).toFixed(2)) : 0
    }))
    .sort((a, b) => b.utilidad - a.utilidad)
}

export function getFlujoCajaSimple(filters = {}) {
  const { from, to } = filters
  let whereOrderPayments = "WHERE 1=1"
  let whereOrders = "WHERE estado = 'Completado'"
  let wherePurchases = "WHERE 1=1"
  let whereAssembly = "WHERE 1=1"

  const paramsPayments = []
  const paramsOrders = []
  const paramsPurchases = []
  const paramsAssembly = []

  if (typeof from === "number") {
    whereOrderPayments += " AND date >= ?"
    paramsPayments.push(Number(from))
    whereOrders += " AND createdAt >= ?"
    paramsOrders.push(Number(from))
    wherePurchases += " AND fecha >= ?"
    paramsPurchases.push(Number(from))
    whereAssembly += " AND date >= ?"
    paramsAssembly.push(Number(from))
  }
  if (typeof to === "number") {
    whereOrderPayments += " AND date <= ?"
    paramsPayments.push(Number(to))
    whereOrders += " AND createdAt <= ?"
    paramsOrders.push(Number(to))
    wherePurchases += " AND fecha <= ?"
    paramsPurchases.push(Number(to))
    whereAssembly += " AND date <= ?"
    paramsAssembly.push(Number(to))
  }

  const abonosRow = db.prepare(`SELECT COALESCE(SUM(monto), 0) as total FROM order_payments ${whereOrderPayments}`).get(...paramsPayments)
  const totalAbonos = Number(abonosRow?.total || 0)

  const ordersRow = db.prepare(`
    SELECT COALESCE(SUM(total), 0) as total
    FROM orders
    ${whereOrders} AND id NOT IN (SELECT DISTINCT orderId FROM order_payments)
  `).get(...paramsOrders)
  const totalVentasPagadasDirectas = Number(ordersRow?.total || 0)

  const totalIngresos = totalAbonos + totalVentasPagadasDirectas

  const purchasesRow = db.prepare(`SELECT COALESCE(SUM(totalCost), 0) as total FROM purchases ${wherePurchases}`).get(...paramsPurchases)
  const totalCompras = Number(purchasesRow?.total || 0)

  const assemblyRow = db.prepare(`
    SELECT COALESCE(SUM(costoManoObra), 0) as manoObra,
           COALESCE(SUM(costoTotalProduccion), 0) as produccion
    FROM assembly_orders ${whereAssembly}
  `).get(...paramsAssembly)

  const totalManoObra = Number(assemblyRow?.manoObra || 0)
  const totalProduccion = Number(assemblyRow?.produccion || 0)

  const totalEgresos = totalCompras + totalProduccion
  const balance = totalIngresos - totalEgresos

  return {
    ingresos: {
      ventasPagadas: totalVentasPagadasDirectas,
      abonos: totalAbonos,
      total: totalIngresos
    },
    egresos: {
      compras: totalCompras,
      manoObra: totalManoObra,
      produccion: totalProduccion,
      total: totalEgresos
    },
    balance,
    totalIngresos,
    totalEgresos
  }
}

