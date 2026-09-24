import * as orderRepo from "../repositories/orderRepository.js"
import { logActivity } from "../utils/logger.js"

export function addOrderPayment(orderId, { monto, metodoPago, nota }, userId) {
  const payment = orderRepo.addOrderPaymentRecord(orderId, { monto, metodoPago, nota }, userId)
  const summary = orderRepo.getOrderPaymentSummary(orderId)

  logActivity("ABONO_REGISTRADO", {
    orderId,
    monto,
    metodoPago,
    userId,
    saldoPendiente: summary.saldoPendiente
  })

  return { payment, ...summary }
}

export function getOrderPayments(orderId) {
  const items = orderRepo.getOrderPaymentsList(orderId)
  const summary = orderRepo.getOrderPaymentSummary(orderId)
  return { items, ...summary }
}

export function getOrderPaymentSummary(orderId) {
  return orderRepo.getOrderPaymentSummary(orderId)
}
