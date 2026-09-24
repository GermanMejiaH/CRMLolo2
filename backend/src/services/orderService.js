import db from "../db.js"
import * as orderRepo from "../repositories/orderRepository.js"
import * as productRepo from "../repositories/productRepository.js"
import * as clientRepo from "../repositories/clientRepository.js"
import { adjustStock, recordKardexMovement } from "./inventoryService.js"
import { logActivity } from "../utils/logger.js"

export function listOrders(filters = {}) {
  return orderRepo.listOrders(filters)
}

export function listOrdersWithNames(filters = {}) {
  return orderRepo.listOrdersWithNames(filters)
}

export function getOrder(id) {
  return orderRepo.getOrderById(id)
}

export function addOrder(data) {
  const createdAt = Date.now()
  const metodo = data.metodoPago && String(data.metodoPago).trim() ? String(data.metodoPago).trim() : "Efectivo"

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

  let totalPedido = 0
  const processedItems = itemsToProcess.map((item) => {
    const pid = Number(item.productoId)
    const cant = Number(item.cantidad || 1)
    let unitPrice = item.precioUnitario

    if (unitPrice == null) {
      const customPrice = clientRepo.getClientProductPrice(Number(data.clienteId), pid)
      if (customPrice) {
        unitPrice = customPrice.price
      } else {
        const client = clientRepo.getClientById(Number(data.clienteId))
        if (client && client.precioPersonalizado != null) {
          unitPrice = client.precioPersonalizado
        } else {
          const product = productRepo.getProductById(pid)
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

      if (estadoInicial !== "Cancelado") {
        adjustStock(item.productoId, -item.cantidad, "venta_pedido", String(orderId), data.userId || null)
        const pUpdated = productRepo.getProductById(item.productoId)
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

    orderRepo.addOrderAuditEntry(orderId, data.userId || null, "creado")
    return orderId
  })

  const newOrderId = transaction()
  logActivity("CREACION_PEDIDO", { orderId: newOrderId, clienteId: data.clienteId, total: totalPedido, userId: data.userId })
  return orderRepo.getOrderById(newOrderId)
}

export function updateOrder(id, data) {
  const current = orderRepo.getOrderById(id)
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
          const pUpdated = productRepo.getProductById(item.productoId)
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
      logActivity("CANCELACION_PEDIDO", { orderId: id, userId })
    }
    // 2. Cambio de estado de Cancelado a activo -> Descontar stock
    else if (!isOldActive && isNewActive) {
      const itemsToDeduct = current.items && current.items.length > 0
        ? current.items
        : [{ productoId: current.productoId, cantidad: current.cantidad }]
      for (const item of itemsToDeduct) {
        if (item.productoId && item.cantidad > 0) {
          const prod = productRepo.getProductById(item.productoId)
          if ((prod?.stockActual || 0) < item.cantidad) {
            throw new Error(`Stock insuficiente para reactivar el pedido (${prod?.nombre || item.productoId})`)
          }
          adjustStock(item.productoId, -Number(item.cantidad), "venta_pedido", String(id), userId)
          const pUpdated = productRepo.getProductById(item.productoId)
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
      logActivity("REACTIVACION_PEDIDO", { orderId: id, userId, estado: newEstado })
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
  return orderRepo.getOrderById(id)
}

export function deleteOrder(id, userId) {
  const current = orderRepo.getOrderById(id)
  if (!current) return false

  const transaction = db.transaction(() => {
    if (current.estado !== "Cancelado") {
      const itemsToRestore = current.items && current.items.length > 0
        ? current.items
        : [{ productoId: current.productoId, cantidad: current.cantidad }]
      for (const item of itemsToRestore) {
        if (item.productoId && item.cantidad > 0) {
          adjustStock(item.productoId, Number(item.cantidad), "pedido_eliminado", String(id), userId || null)
          const pUpdated = productRepo.getProductById(item.productoId)
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
  logActivity("ELIMINACION_PEDIDO", { orderId: id, userId })
  return true
}

export function addOrderAuditEntry(orderId, userId, observation) {
  return orderRepo.addOrderAuditEntry(orderId, userId, observation)
}

export function listOrderAudit(orderId, options = {}) {
  return orderRepo.listOrderAudit(orderId, options)
}

export function countOrderAudit(orderId) {
  return orderRepo.countOrderAudit(orderId)
}

export function listOrderAuditDetailed(orderId, options = {}) {
  return orderRepo.listOrderAuditDetailed(orderId, options)
}

export function addProforma(data) {
  return orderRepo.addProformaRecord(data)
}

export function listProformas() {
  return orderRepo.listProformas()
}
