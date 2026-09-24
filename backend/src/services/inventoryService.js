import db from "../db.js"
import * as productRepo from "../repositories/productRepository.js"
import * as inventoryRepo from "../repositories/inventoryRepository.js"
import { getCostoManoObraUnitaria } from "./settingService.js"
import { logActivity } from "../utils/logger.js"

export function adjustStock(productId, diff, reason, ref, userId) {
  const p = productRepo.getProductById(productId)
  if (!p) return null
  const newStock = Number(p.stockActual || 0) + Number(diff)
  if (newStock < 0) {
    throw new Error(`Stock insuficiente: el ajuste resultaría en stock negativo para ${p.nombre} (Stock actual: ${p.stockActual}, cambio: ${diff})`)
  }
  productRepo.updateProductStockRaw(productId, newStock)
  inventoryRepo.recordStockMovement(productId, diff, reason, ref, userId)

  const isSystemOp = ["venta_pedido", "pedido_cancelado", "pedido_eliminado", "Consumo Producción", "Entrada Producción"].includes(reason)
  if (!isSystemOp) {
    inventoryRepo.recordKardexMovement(
      productId,
      diff >= 0 ? "AJUSTE_ENTRADA" : "AJUSTE_SALIDA",
      diff,
      newStock,
      ref || null,
      userId || null,
      reason || null
    )
  }

  logActivity("AJUSTE_STOCK", {
    productId,
    diff,
    newStock,
    reason,
    ref,
    userId
  })

  return productRepo.getProductById(productId)
}

export function listStockMovements(productId, options = {}) {
  return inventoryRepo.listStockMovements(productId, options)
}

export function listStockMovementsDetailed(productId, options = {}) {
  return inventoryRepo.listStockMovementsDetailed(productId, options)
}

export function countStockMovements(productId) {
  return inventoryRepo.countStockMovements(productId)
}

export function recordKardexMovement(productId, tipoMovimiento, cantidad, stockResultante, referenciaId = null, userId = null, notas = null) {
  const res = inventoryRepo.recordKardexMovement(productId, tipoMovimiento, cantidad, stockResultante, referenciaId, userId, notas)
  logActivity("MOVIMIENTO_KARDEX", {
    productId,
    tipoMovimiento,
    cantidad,
    stockResultante,
    referenciaId,
    userId
  })
  return res
}

export function getKardex(productId, options = {}) {
  return inventoryRepo.getKardex(productId, options)
}

export function createPurchase(data, userId) {
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

      const p = productRepo.getProductById(item.productId)
      if (p) {
        const oldStock = Number(p.stockActual || 0)
        const oldCosto = Number(p.costoUnitario || 0)
        const newStock = oldStock + item.cantidad
        let newCosto = item.costoUnitario
        if (newStock > 0 && oldStock * oldCosto + item.cantidad * item.costoUnitario > 0) {
          newCosto = Math.round((oldStock * oldCosto + item.cantidad * item.costoUnitario) / newStock)
        }

        productRepo.updateProductStockAndCostoRaw(item.productId, newStock, newCosto)

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
  logActivity("ORDEN_COMPRA_CREADA", { purchaseId, proveedor, totalCost, userId })
  return inventoryRepo.getPurchaseById(purchaseId)
}

export function getPurchase(id) {
  return inventoryRepo.getPurchaseById(id)
}

export function listPurchases(options = {}) {
  return inventoryRepo.listPurchases(options)
}

export function getCapacidadEnsambladoTeorica(productoTerminadoId) {
  const pt = productRepo.getProductById(productoTerminadoId)
  if (!pt) throw new Error("Producto terminado no encontrado")
  const recipe = inventoryRepo.getBom(productoTerminadoId)

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

export function checkAssemblyAvailability(productoTerminadoId, cantidadProducida) {
  const pt = productRepo.getProductById(productoTerminadoId)
  if (!pt) throw new Error("Producto terminado no encontrado")
  const recipe = inventoryRepo.getBom(productoTerminadoId)
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

export function executeAssemblyOrder(productoTerminadoId, cantidadProducida, userId, notas) {
  const check = checkAssemblyAvailability(productoTerminadoId, cantidadProducida)
  if (!check.available) {
    throw new Error(`No se puede ensamblar: ${check.reason}`)
  }

  const date = Date.now()
  const pt = productRepo.getProductById(productoTerminadoId)
  const costoManoObraUnitaria = getCostoManoObraUnitaria()

  const costoMateriales = check.totalCost
  const costoManoObra = Math.round(Number(cantidadProducida) * costoManoObraUnitaria)
  const costoTotalProduccion = costoMateriales + costoManoObra
  const unitCost = Math.round(costoTotalProduccion / Number(cantidadProducida))

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
      const mp = productRepo.getProductById(item.materiaPrimaId)
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

    // 2. Aumentar stock de producto terminado y actualizar costo unitario real
    adjustStock(
      productoTerminadoId,
      Number(cantidadProducida),
      "Entrada Producción",
      `Ensamblado de ${cantidadProducida} uds`,
      userId
    )
    db.prepare("UPDATE products SET costoUnitario = ? WHERE id = ?").run(unitCost, Number(productoTerminadoId))

    const ptUpdated = productRepo.getProductById(productoTerminadoId)

    // 3. Registrar orden de ensamblado
    const info = db
      .prepare(
        "INSERT INTO assembly_orders (productoTerminadoId, cantidadProducida, costoMateriales, costoManoObra, costoTotalProduccion, costoUnitario, date, userId, notas) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .run(
        Number(productoTerminadoId),
        Number(cantidadProducida),
        costoMateriales,
        costoManoObra,
        costoTotalProduccion,
        unitCost,
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
  logActivity("ENSAMBLADO_EJECUTADO", {
    orderId: order.id,
    productoTerminadoId,
    cantidadProducida,
    costoMateriales,
    costoManoObra,
    costoTotalProduccion,
    unitCost,
    userId
  })
  return {
    order,
    summary: {
      ...check,
      costoMateriales,
      costoManoObra,
      totalCost: costoTotalProduccion,
      unitCost
    }
  }
}

export function listAssemblyOrders() {
  return inventoryRepo.listAssemblyOrders()
}

export function getAlertasStockYReorden(tipoFilter = "materia_prima") {
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
