import db from "./db.js"
import * as clientService from "./services/clientService.js"
import * as productService from "./services/productService.js"
import * as orderService from "./services/orderService.js"
import * as inventoryService from "./services/inventoryService.js"
import * as paymentService from "./services/paymentService.js"
import * as bomService from "./services/bomService.js"
import * as reportService from "./services/reportService.js"
import * as userRepo from "./repositories/userRepository.js"

const payments = ["Efectivo", "Transferencia", "Tarjeta"]
const orderStates = ["Pendiente", "Completado", "Cancelado"]

// Seed User & Demo Data
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
    clientService.addClient({
      nombre: "Moto Repuestos SAS",
      contacto: "Carlos Rodríguez",
      telefono: "+57 300 123 4567",
      email: "carlos@motorepuestos.com",
      direccion: "Calle 45 #23-12, Medellín",
      precioPersonalizado: 42000,
      notas: "Cliente preferencial"
    })
    clientService.addClient({
      nombre: "Auto Express",
      contacto: "María González",
      telefono: "+57 301 234 5678",
      email: "maria@autoexpress.co",
      direccion: "Carrera 70 #45-89, Medellín",
      precioPersonalizado: 38000,
      notas: ""
    })
    clientService.addClient({
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
    productService.addProduct({
      nombre: "Módulo XR-2000",
      descripcion: "Módulo avanzado",
      precioMinimo: 25000,
      precioMaximo: 45000,
      stockActual: 15,
      stockMinimo: 10
    })
    productService.addProduct({
      nombre: "Estacionaria Pro",
      descripcion: "Equipo industrial",
      precioMinimo: 30000,
      precioMaximo: 50000,
      stockActual: 5,
      stockMinimo: 8
    })
    productService.addProduct({
      nombre: "Kit Básico M1",
      descripcion: "Kit de inicio",
      precioMinimo: 25000,
      precioMaximo: 40000,
      stockActual: 25,
      stockMinimo: 12
    })
  }
}

// User object compatibility
const users = {
  findByEmail(email) {
    return userRepo.findUserByEmail(email)
  }
}

// Delegated exports
export const listClients = clientService.listClients
export const countClients = clientService.countClients
export const addClient = clientService.addClient
export const updateClient = clientService.updateClient
export const getClient = clientService.getClient
export const getClientProductPrices = clientService.getClientProductPrices
export const getClientProductPrice = clientService.getClientProductPrice
export const setClientProductPrice = clientService.setClientProductPrice
export const deleteClientProductPrice = clientService.deleteClientProductPrice
export const getClientResumen360 = clientService.getClientResumen360

export const listProducts = productService.listProducts
export const countProducts = productService.countProducts
export const addProduct = productService.addProduct
export const getProduct = productService.getProduct
export const updateProduct = productService.updateProduct
export const deleteProduct = productService.deleteProduct

export const adjustStock = inventoryService.adjustStock
export const listStockMovements = inventoryService.listStockMovements
export const listStockMovementsDetailed = inventoryService.listStockMovementsDetailed
export const countStockMovements = inventoryService.countStockMovements
export const recordKardexMovement = inventoryService.recordKardexMovement
export const getKardex = inventoryService.getKardex
export const createPurchase = inventoryService.createPurchase
export const getPurchase = inventoryService.getPurchase
export const listPurchases = inventoryService.listPurchases
export const getCapacidadEnsambladoTeorica = inventoryService.getCapacidadEnsambladoTeorica
export const checkAssemblyAvailability = inventoryService.checkAssemblyAvailability
export const executeAssemblyOrder = inventoryService.executeAssemblyOrder
export const listAssemblyOrders = inventoryService.listAssemblyOrders
export const getAlertasStockYReorden = inventoryService.getAlertasStockYReorden

export const listOrders = orderService.listOrders
export const listOrdersWithNames = orderService.listOrdersWithNames
export const getOrder = orderService.getOrder
export const addOrder = orderService.addOrder
export const updateOrder = orderService.updateOrder
export const deleteOrder = orderService.deleteOrder
export const addOrderAuditEntry = orderService.addOrderAuditEntry
export const listOrderAudit = orderService.listOrderAudit
export const countOrderAudit = orderService.countOrderAudit
export const listOrderAuditDetailed = orderService.listOrderAuditDetailed
export const addProforma = orderService.addProforma
export const listProformas = orderService.listProformas

export const addOrderPayment = paymentService.addOrderPayment
export const getOrderPayments = paymentService.getOrderPayments
export const getOrderPaymentSummary = paymentService.getOrderPaymentSummary

export const getBom = bomService.getBom
export const setBom = bomService.setBom

import * as settingService from "./services/settingService.js"
import { runBackup } from "./backup.js"

export const getCostoManoObraUnitaria = settingService.getCostoManoObraUnitaria
export const setCostoManoObraUnitaria = settingService.setCostoManoObraUnitaria
export const getSetting = settingService.getSetting
export const setSetting = settingService.setSetting

import * as dashboardService from "./services/dashboardService.js"

export const getExecutiveDashboard = dashboardService.getExecutiveDashboard
export const getOperationalAlerts = dashboardService.getOperationalAlerts
export const getInventoryProjections = dashboardService.getInventoryProjections
export const getClientRankings = dashboardService.getClientRankings
export const getProductRankings = dashboardService.getProductRankings
export const getBusinessHealth = dashboardService.getBusinessHealth
export const getMonthlyClosureData = dashboardService.getMonthlyClosureData

export const listSalesSeries = reportService.listSalesSeries
export const getDashboardStats = reportService.getDashboardStats
export const getReporteRentabilidad = reportService.getReporteRentabilidad
export const getRentabilidadPedidos = reportService.getRentabilidadPedidos
export const getRentabilidadClientes = reportService.getRentabilidadClientes
export const getRentabilidadProductos = reportService.getRentabilidadProductos
export const getFlujoCajaSimple = reportService.getFlujoCajaSimple

export const triggerBackup = runBackup

export const updateUserPasswordByEmail = userRepo.updateUserPasswordByEmail
export const updateLegacyUserPassword = userRepo.updateLegacyUserPassword

export { payments, orderStates, users }
