import express from "express"
import cors from "cors"
import jwt from "jsonwebtoken"
import bcrypt from "bcryptjs"
import fs from "fs"
import path from "path"
import PDFDocument from "pdfkit"
import nodemailer from "nodemailer"
import { buildProformaDocument } from "./proformaPdf.js"
import {
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
  listStockMovementsDetailed,
  countStockMovements,
  listOrderAuditDetailed,
  countOrderAudit,
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
  createPurchase,
  getPurchase,
  listPurchases,
  getKardex,
  getCapacidadEnsambladoTeorica
} from "./store.js"

import {
  validate,
  clientSchema,
  productSchema,
  orderSchema,
  abonoSchema,
  bomSchema,
  assemblyOrderSchema,
  purchaseSchema
} from "./schemas.js"
import config from "./config.js"

const app = express()

// Security headers middleware
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff")
  res.setHeader("X-Frame-Options", "DENY")
  res.setHeader("X-XSS-Protection", "1; mode=block")
  res.setHeader("Referrer-Policy", "no-referrer")
  next()
})

const allowedOrigin = config.corsOrigin || ""
const allowedList = allowedOrigin
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
if (!config.isProduction) {
  ;[
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    "http://192.168.*:5173"
  ].forEach((o) => {
    if (!allowedList.includes(o)) allowedList.push(o)
  })
}

function isOriginAllowed(origin) {
  if (!origin) return true
  if (config.isProduction && allowedList.length === 0) return false
  for (const rule of allowedList) {
    if (rule === origin) return true
    if (rule.includes("*")) {
      const re = new RegExp("^" + rule.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\\\*/g, "[^.]+") + "$")
      if (re.test(origin)) return true
    }
  }
  return false
}

app.use(
  cors({
    origin: (origin, cb) => {
      if (isOriginAllowed(origin)) {
        cb(null, true)
      } else {
        cb(new Error("No permitido por CORS"))
      }
    }
  })
)

app.use(express.json({ limit: "1mb" }))
app.use(express.urlencoded({ extended: true, limit: "1mb" }))

const port = config.port
const jwtSecret = config.jwtSecret

// Initialize admin password from env if provided
if (config.adminPassword) {
  try {
    const hash = bcrypt.hashSync(config.adminPassword, 10)
    updateUserPasswordByEmail(config.adminEmail, hash)
    if (!config.isTest) console.log("Admin password updated from env for:", config.adminEmail)
  } catch (e) {
    if (!config.isTest) console.error("Failed to update admin password from env:", e.message)
  }
}

const proformaDir = config.proformaDir
fs.mkdirSync(proformaDir, { recursive: true })
if (!config.isTest) {
  try {
    console.log("Storage root:", config.storageRoot)
    console.log("Proformas dir:", proformaDir)
  } catch {}
}
app.use("/static/proformas", express.static(proformaDir))

// Configurar trust proxy únicamente si está habilitado en configuración
if (config.trustProxy !== false) {
  app.set("trust proxy", config.trustProxy)
}

// Rate limiter para inicios de sesión fallidos con limpieza periódica
const loginAttempts = new Map()
const CLEANUP_INTERVAL = 10 * 60 * 1000

setInterval(() => {
  const now = Date.now()
  for (const [ip, record] of loginAttempts.entries()) {
    if (now > record.resetAt) {
      loginAttempts.delete(ip)
    }
  }
}, CLEANUP_INTERVAL).unref()

function recordFailedLogin(ip) {
  const now = Date.now()
  const windowMs = 15 * 60 * 1000
  const record = loginAttempts.get(ip) || { count: 0, resetAt: now + windowMs }
  if (now > record.resetAt) {
    record.count = 1
    record.resetAt = now + windowMs
  } else {
    record.count++
  }
  loginAttempts.set(ip, record)
}

function clearLoginAttempts(ip) {
  loginAttempts.delete(ip)
}

function loginRateLimiter(req, res, next) {
  if (config.isTest && !req.headers["x-test-rate-limit"]) return next()
  const ip = req.ip || req.socket?.remoteAddress || "unknown"
  const now = Date.now()
  const maxAttempts = 5
  const record = loginAttempts.get(ip)
  if (record && now <= record.resetAt && record.count >= maxAttempts) {
    return res.status(429).json({
      error: "too_many_requests",
      message: "Demasiados intentos fallidos de inicio de sesión. Por favor intente más tarde."
    })
  }
  next()
}

function signToken(payload) {
  return jwt.sign(payload, jwtSecret, { expiresIn: "1d" })
}

function auth(req, res, next) {
  const h = req.headers.authorization || ""
  const t = h.startsWith("Bearer ") ? h.slice(7) : null
  if (!t) return res.status(401).json({ error: "unauthorized" })
  try {
    const p = jwt.verify(t, jwtSecret)
    req.user = p
    next()
  } catch {
    res.status(401).json({ error: "unauthorized" })
  }
}

function allowRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: "forbidden" })
    next()
  }
}

function validEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

app.post("/auth/login", loginRateLimiter, (req, res) => {
  const ip = req.ip || req.socket?.remoteAddress || "unknown"
  const { email, password } = req.body || {}
  if (!email || !password) {
    recordFailedLogin(ip)
    return res.status(400).json({ error: "invalid_credentials" })
  }
  const u = users.findByEmail(email)
  if (!u) {
    recordFailedLogin(ip)
    return res.status(401).json({ error: "invalid_credentials" })
  }
  let ok = false
  let isLegacy = false
  if (u.passwordHash.startsWith("plain:")) {
    isLegacy = true
    ok = password === u.passwordHash.replace("plain:", "")
  } else {
    ok = bcrypt.compareSync(password, u.passwordHash)
  }
  if (!ok) {
    recordFailedLogin(ip)
    return res.status(401).json({ error: "invalid_credentials" })
  }
  clearLoginAttempts(ip)
  if (isLegacy) {
    try {
      const newHash = bcrypt.hashSync(password, 10)
      updateLegacyUserPassword(u.email, u.passwordHash, newHash)
    } catch (e) {
      if (!config.isTest) console.error("Failed to migrate legacy password hash:", e.message)
    }
  }
  const token = signToken({ sub: u.id, email: u.email, role: u.role, name: u.name })
  res.json({ token })
})

app.get("/dashboard", auth, (req, res) => {
  res.json(getDashboardStats())
})

app.get("/config/options", auth, (req, res) => {
  res.json({ payments, orderStates })
})

app.get("/clientes", auth, (req, res) => {
  const { q, email, minPrecio, maxPrecio, page, limit, includeInactive } = req.query
  if (page && limit) {
    const p = Math.max(1, Number(page))
    const l = Math.max(1, Number(limit))
    const offset = (p - 1) * l
    const items = listClients({
      q,
      email,
      minPrecio,
      maxPrecio,
      limit: l,
      offset,
      includeInactive: String(includeInactive) === "true"
    })
    const total = countClients({ q, email, minPrecio, maxPrecio, includeInactive: String(includeInactive) === "true" })
    res.json({ items, total })
  } else {
    const data = listClients({ q, email, minPrecio, maxPrecio, includeInactive: String(includeInactive) === "true" })
    res.json(data)
  }
})

app.post("/clientes", auth, allowRoles("Admin", "Operador"), validate(clientSchema), (req, res) => {
  const { nombre, contacto, telefono, email, direccion, precioPersonalizado, notas } = req.body
  const c = addClient({ nombre, contacto, telefono, email, direccion, precioPersonalizado, notas })
  res.status(201).json(c)
})

app.put("/clientes/:id", auth, allowRoles("Admin", "Operador"), (req, res) => {
  const id = Number(req.params.id)
  const c = updateClient(id, req.body || {})
  if (!c) return res.status(404).json({ error: "not_found" })
  res.json(c)
})

app.post("/clientes/:id/desactivar", auth, allowRoles("Admin", "Operador"), (req, res) => {
  const id = Number(req.params.id)
  try {
    const c = updateClient(id, { active: false })
    if (!c) return res.status(404).json({ error: "not_found" })
    res.json(c)
  } catch (e) {
    res.status(400).json({ error: e.message || "error" })
  }
})

// Client product price endpoints
app.get("/clientes/:id/precios", auth, (req, res) => {
  const clientId = Number(req.params.id)
  const prices = getClientProductPrices(clientId)
  res.json(prices)
})

app.get("/clientes/:clientId/precios/:productId", auth, (req, res) => {
  const clientId = Number(req.params.clientId)
  const productId = Number(req.params.productId)
  const price = getClientProductPrice(clientId, productId)
  if (!price) return res.status(404).json({ error: "not_found" })
  res.json(price)
})

app.put("/clientes/:clientId/precios/:productId", auth, allowRoles("Admin", "Operador"), (req, res) => {
  const clientId = Number(req.params.clientId)
  const productId = Number(req.params.productId)
  const { price } = req.body || {}
  if (price == null) return res.status(400).json({ error: "price_required" })
  const updated = setClientProductPrice(clientId, productId, Number(price))
  res.json(updated)
})

app.delete("/clientes/:clientId/precios/:productId", auth, allowRoles("Admin", "Operador"), (req, res) => {
  const clientId = Number(req.params.clientId)
  const productId = Number(req.params.productId)
  deleteClientProductPrice(clientId, productId)
  res.json({ ok: true })
})

app.get("/productos", auth, (req, res) => {
  const { q, page, limit, includeInactive, tipo } = req.query
  if (page && limit) {
    const p = Math.max(1, Number(page))
    const l = Math.max(1, Number(limit))
    const offset = (p - 1) * l
    const items = listProducts({ q, limit: l, offset, includeInactive: String(includeInactive) === "true", tipo })
    const total = countProducts({ q, includeInactive: String(includeInactive) === "true", tipo })
    res.json({ items, total })
  } else {
    const data = listProducts({ q, includeInactive: String(includeInactive) === "true", tipo })
    res.json(data)
  }
})

app.post("/productos", auth, allowRoles("Admin", "Operador"), validate(productSchema), (req, res) => {
  const {
    nombre,
    descripcion,
    precioMinimo,
    precioMaximo,
    stockActual,
    stockMinimo,
    tipo,
    costoUnitario,
    unidadMedida
  } = req.body
  const p = addProduct({
    nombre,
    descripcion,
    precioMinimo,
    precioMaximo,
    stockActual: stockActual ?? 0,
    stockMinimo: stockMinimo ?? 0,
    tipo: tipo || "producto_terminado",
    costoUnitario: costoUnitario ?? 0,
    unidadMedida: unidadMedida || "unidades"
  })
  res.status(201).json(p)
})

app.get("/bom/:id", auth, (req, res) => {
  const id = Number(req.params.id)
  const items = getBom(id)
  res.json(items)
})

app.post("/bom/:id", auth, allowRoles("Admin", "Operador"), validate(bomSchema), (req, res) => {
  const id = Number(req.params.id)
  try {
    const updated = setBom(id, req.body.items)
    res.json(updated)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

app.post("/produccion/verificar", auth, (req, res) => {
  const { productoTerminadoId, cantidadProducida } = req.body || {}
  if (!productoTerminadoId || !cantidadProducida) {
    return res.status(400).json({ error: "missing_params" })
  }
  try {
    const check = checkAssemblyAvailability(Number(productoTerminadoId), Number(cantidadProducida))
    res.json(check)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

app.post("/produccion/ensamblar", auth, allowRoles("Admin", "Operador"), validate(assemblyOrderSchema), (req, res) => {
  const { productoTerminadoId, cantidadProducida, notas } = req.body
  try {
    const result = executeAssemblyOrder(Number(productoTerminadoId), Number(cantidadProducida), req.user?.sub, notas)
    res.status(201).json(result)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

app.get("/produccion/historial", auth, (req, res) => {
  const history = listAssemblyOrders()
  res.json(history)
})

app.put("/productos/:id", auth, allowRoles("Admin", "Operador"), (req, res) => {
  const id = Number(req.params.id)
  const p = updateProduct(id, req.body || {})
  if (!p) return res.status(404).json({ error: "not_found" })
  res.json(p)
})

app.post("/productos/:id/ajustar", auth, allowRoles("Admin", "Operador"), (req, res) => {
  const id = Number(req.params.id)
  const { diff, motivo, referencia } = req.body || {}
  const p = adjustStock(id, Number(diff), motivo || "ajuste", referencia || "", req.user.sub)
  if (!p) return res.status(404).json({ error: "not_found" })
  res.json(p)
})

app.post("/productos/:id/desactivar", auth, allowRoles("Admin"), (req, res) => {
  const id = Number(req.params.id)
  const p = updateProduct(id, { active: 0 })
  if (!p) return res.status(404).json({ error: "not_found" })
  res.json({ ok: true })
})

app.delete("/productos/:id", auth, allowRoles("Admin"), (req, res) => {
  const id = Number(req.params.id)
  try {
    deleteProduct(id)
    res.json({ ok: true })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

app.get("/productos/:id/movimientos", auth, (req, res) => {
  const id = Number(req.params.id)
  const { page, limit } = req.query
  const p = getProduct(id)
  if (!p) return res.status(404).json({ error: "not_found" })
  const l = Math.max(1, Number(limit || 10))
  const pg = Math.max(1, Number(page || 1))
  const offset = (pg - 1) * l
  const items = listStockMovementsDetailed(id, { limit: l, offset })
  const total = countStockMovements(id)
  res.json({ items, total })
})

app.get("/pedidos", auth, (req, res) => {
  const { cliente, estado, from, to, metodoPago } = req.query
  function parseDateToTs(v, endOfDay = false) {
    if (!v) return undefined
    const asNum = Number(v)
    if (!Number.isNaN(asNum)) return asNum
    const d = new Date(String(v))
    if (Number.isNaN(d.getTime())) return undefined
    if (endOfDay) {
      d.setHours(23, 59, 59, 999)
    } else {
      d.setHours(0, 0, 0, 0)
    }
    return d.getTime()
  }
  const filters = {}
  if (cliente) filters.cliente = Number(cliente)
  if (estado) filters.estado = String(estado)
  const fromTs = parseDateToTs(from, false)
  const toTs = parseDateToTs(to, true)
  if (typeof fromTs === "number") filters.from = fromTs
  if (typeof toTs === "number") filters.to = toTs
  if (metodoPago) filters.metodoPago = String(metodoPago)
  const data = listOrders(filters)
  res.json(data)
})

app.get("/pedidos/:id", auth, (req, res) => {
  const id = Number(req.params.id)
  const o = getOrder(id)
  if (!o) return res.status(404).json({ error: "not_found" })
  res.json(o)
})

app.delete("/pedidos/:id", auth, allowRoles("Admin", "Operador"), (req, res) => {
  const id = Number(req.params.id)
  try {
    deleteOrder(id)
    res.json({ ok: true })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

app.post("/pedidos", auth, allowRoles("Admin", "Operador"), validate(orderSchema), (req, res) => {
  const { clienteId, productoId, cantidad, precioUnitario, items, metodoPago, notas } = req.body
  const client = getClient(Number(clienteId))
  if (!client) return res.status(400).json({ error: "cliente" })

  const itemsToProcess =
    Array.isArray(items) && items.length > 0
      ? items
      : [
          {
            productoId: Number(productoId),
            cantidad: Number(cantidad),
            precioUnitario: precioUnitario != null ? Number(precioUnitario) : undefined
          }
        ]

  for (const item of itemsToProcess) {
    const cant = Number(item.cantidad || 0)
    if (cant <= 0) return res.status(400).json({ error: "cantidad" })
    const prod = getProduct(Number(item.productoId))
    if (!prod) return res.status(400).json({ error: "producto" })
    if ((prod.stockActual || 0) < cant) return res.status(400).json({ error: "stock" })
  }

  const pedido = addOrder({
    clienteId: Number(clienteId),
    items: itemsToProcess,
    metodoPago: metodoPago || "Efectivo",
    notas: notas || "",
    userId: req.user?.sub
  })
  res.status(201).json(pedido)
})

app.put("/pedidos/:id", auth, allowRoles("Admin", "Operador"), (req, res) => {
  const id = Number(req.params.id)
  const body = req.body || {}
  const before = getOrder(id)
  if (!before) return res.status(404).json({ error: "not_found" })
  const updated = updateOrder(id, body)
  try {
    addOrderAuditEntry(id, req.user.sub, "actualizado")
  } catch {}
  if (body.estado === "Completado" && before.estado !== "Completado") {
    const prod = getProduct(before.productoId)
    adjustStock(prod.id, -before.cantidad, "pedido_completado", String(id), req.user.sub)
  }
  res.json(updated)
})

app.post("/pedidos/:id/proforma", auth, allowRoles("Admin", "Operador"), async (req, res) => {
  const id = Number(req.params.id)
  const pedido = getOrder(id)
  if (!pedido) return res.status(404).json({ error: "not_found" })
  const client = getClient(pedido.clienteId)
  const product = getProduct(pedido.productoId)
  const ts = Date.now()
  const fileName = `${id}-${ts}.pdf`
  const filePath = path.join(proformaDir, fileName)
  const doc = new PDFDocument({ margin: 40 })
  const stream = fs.createWriteStream(filePath)
  doc.pipe(stream)
  buildProformaDocument(doc, { pedido, client, product, ts })
  doc.end()
  await new Promise((r) => stream.on("finish", r))
  const url = `/static/proformas/${fileName}`
  const record = addProforma({ pedidoId: id, clienteId: pedido.clienteId, total: pedido.total, url })
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && client?.email) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: false,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      })
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: client.email,
        subject: "Proforma",
        text: "Adjunto proforma",
        attachments: [{ filename: fileName, path: filePath }]
      })
    } catch {}
  }
  res.json({ url, proformaId: record.id })
})

app.get("/proformas", auth, (req, res) => {
  res.json(listProformas())
})

app.get("/pedidos/:id/audit", auth, (req, res) => {
  const id = Number(req.params.id)
  const { page, limit } = req.query
  const l = Math.max(1, Number(limit || 10))
  const pg = Math.max(1, Number(page || 1))
  const offset = (pg - 1) * l
  const items = listOrderAuditDetailed(id, { limit: l, offset })
  const total = countOrderAudit(id)
  res.json({ items, total })
})

app.get("/clientes/:id/resumen-360", auth, (req, res) => {
  const id = Number(req.params.id)
  const resumen = getClientResumen360(id)
  if (!resumen) return res.status(404).json({ error: "not_found" })
  res.json(resumen)
})

app.post("/pedidos/:id/abonos", auth, allowRoles("Admin", "Operador"), validate(abonoSchema), (req, res) => {
  const id = Number(req.params.id)
  try {
    const result = addOrderPayment(id, req.body, req.user?.sub)
    res.status(201).json(result)
  } catch (e) {
    if (e.message === "Pedido no encontrado") {
      return res.status(404).json({ error: "not_found" })
    }
    res.status(400).json({ error: e.message })
  }
})

app.get("/pedidos/:id/abonos", auth, (req, res) => {
  const id = Number(req.params.id)
  const pedido = getOrder(id)
  if (!pedido) return res.status(404).json({ error: "not_found" })
  const paymentsData = getOrderPayments(id)
  res.json(paymentsData)
})

// --- RUTAS DE BOM Y PRODUCCIÓN ---
app.get("/bom/:productoId", auth, (req, res) => {
  const id = Number(req.params.productoId)
  res.json(getBom(id))
})

app.post("/bom/:productoId", auth, allowRoles("Admin", "Operador"), validate(bomSchema), (req, res) => {
  const id = Number(req.params.productoId)
  try {
    const updated = setBom(id, req.body.items)
    res.json(updated)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

app.post("/produccion/verificar", auth, (req, res) => {
  const { productoTerminadoId, cantidadProducida } = req.body || {}
  try {
    const check = checkAssemblyAvailability(Number(productoTerminadoId), Number(cantidadProducida))
    res.json(check)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

app.get("/produccion/capacidad-teorica/:productoId", auth, (req, res) => {
  const id = Number(req.params.productoId)
  try {
    const capacidad = getCapacidadEnsambladoTeorica(id)
    res.json(capacidad)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

app.post("/produccion/ensamblar", auth, allowRoles("Admin", "Operador"), validate(assemblyOrderSchema), (req, res) => {
  const { productoTerminadoId, cantidadProducida, notas } = req.body
  try {
    const result = executeAssemblyOrder(Number(productoTerminadoId), Number(cantidadProducida), req.user?.sub, notas)
    res.status(201).json(result)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

app.get("/produccion/historial", auth, (req, res) => {
  res.json(listAssemblyOrders())
})

// --- RUTAS DE COMPRAS E IMPORTACIONES ---
app.post("/compras", auth, allowRoles("Admin", "Operador"), validate(purchaseSchema), (req, res) => {
  try {
    const purchase = createPurchase(req.body, req.user?.sub)
    res.status(201).json(purchase)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

app.get("/compras", auth, (req, res) => {
  const { limit, offset } = req.query
  res.json(listPurchases({ limit: Number(limit || 50), offset: Number(offset || 0) }))
})

app.get("/compras/:id", auth, (req, res) => {
  const id = Number(req.params.id)
  const purchase = getPurchase(id)
  if (!purchase) return res.status(404).json({ error: "not_found" })
  res.json(purchase)
})

// --- RUTAS DE KARDEX ---
app.get("/kardex", auth, (req, res) => {
  const { productoId, limit, offset } = req.query
  res.json(getKardex(productoId ? Number(productoId) : null, { limit: Number(limit || 50), offset: Number(offset || 0) }))
})

app.get("/kardex/:productoId", auth, (req, res) => {
  const id = Number(req.params.productoId)
  const { limit, offset } = req.query
  res.json(getKardex(id, { limit: Number(limit || 50), offset: Number(offset || 0) }))
})


// removed legacy KPIs route

app.get("/reportes/ventas.csv", auth, (req, res) => {
  const { from, to, estado, metodoPago, delim } = req.query
  function parseDateToTs(v, endOfDay = false) {
    if (!v) return undefined
    const asNum = Number(v)
    if (!Number.isNaN(asNum)) return asNum
    const d = new Date(String(v))
    if (Number.isNaN(d.getTime())) return undefined
    if (endOfDay) {
      d.setHours(23, 59, 59, 999)
    } else {
      d.setHours(0, 0, 0, 0)
    }
    return d.getTime()
  }
  const delimChar = (() => {
    if (!delim) return ","
    const d = String(delim).toLowerCase().trim()
    if (d === ";" || d === "semicolon" || d === "semi") return ";"
    if (d === "," || d === "comma") return ","
    return ","
  })()
  function csvEscape(val) {
    const s = val == null ? "" : String(val)
    if (s.includes('"') || s.includes("\n") || s.includes("\r") || s.includes(delimChar)) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }
  const filters = {}
  const fromTs = parseDateToTs(from, false)
  const toTs = parseDateToTs(to, true)
  if (typeof fromTs === "number") filters.from = fromTs
  if (typeof toTs === "number") filters.to = toTs
  if (estado) filters.estado = String(estado)
  if (metodoPago) filters.metodoPago = String(metodoPago)
  const data = listOrdersWithNames(filters)
  const columns = [
    "id",
    "fecha",
    "clienteId",
    "clienteNombre",
    "productoId",
    "productoNombre",
    "cantidad",
    "precioUnitario",
    "total",
    "estado",
    "metodoPago"
  ]
  const header = columns.join(delimChar)
  const rows = data.map((o) => {
    const values = [
      o.id,
      new Date(o.createdAt).toISOString(),
      o.clienteId,
      o.clienteNombre || "",
      o.productoId,
      o.productoNombre || "",
      o.cantidad,
      o.precioUnitario,
      o.total,
      o.estado,
      o.metodoPago && String(o.metodoPago).trim() ? String(o.metodoPago).trim() : "Efectivo"
    ].map(csvEscape)
    return values.join(delimChar)
  })
  const sepLine = `sep=${delimChar}\r\n`
  const csvBody = [header, ...rows].join("\r\n")
  const bom = "\uFEFF"
  const csv = bom + sepLine + csvBody
  const d = new Date()
  const pad = (n) => String(n).padStart(2, "0")
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
  res.setHeader("Content-Type", "text/csv; charset=utf-8")
  res.setHeader("Content-Disposition", `attachment; filename=\"ventas-${stamp}.csv\"`)
  res.send(csv)
})

app.get("/reportes/kpis", auth, (req, res) => {
  const { from, to, estado, metodoPago } = req.query
  function parseDateToTs(v, endOfDay = false) {
    if (!v) return undefined
    const asNum = Number(v)
    if (!Number.isNaN(asNum)) return asNum
    const d = new Date(String(v))
    if (Number.isNaN(d.getTime())) return undefined
    if (endOfDay) {
      d.setHours(23, 59, 59, 999)
    } else {
      d.setHours(0, 0, 0, 0)
    }
    return d.getTime()
  }
  const filters = {}
  const fromTs = parseDateToTs(from, false)
  const toTs = parseDateToTs(to, true)
  if (typeof fromTs === "number") filters.from = fromTs
  if (typeof toTs === "number") filters.to = toTs
  if (estado) filters.estado = String(estado)
  if (metodoPago) filters.metodoPago = String(metodoPago)
  const itemsRaw = listOrders(filters)
  const items = itemsRaw.filter((o) => o.estado !== "Cancelado")
  const totalVentas = items.reduce((s, o) => s + Number(o.total || 0), 0)
  const pedidos = items.length
  const completados = items.filter((o) => o.estado === "Completado").length
  const ticketPromedio = pedidos ? Math.round(totalVentas / pedidos) : 0
  const totalesPorMetodoPago = {}
  for (const m of payments) {
    totalesPorMetodoPago[m] = items
      .filter((o) => (o.metodoPago && String(o.metodoPago).trim() ? String(o.metodoPago).trim() : "Efectivo") === m)
      .reduce((s, o) => s + Number(o.total || 0), 0)
  }
  res.json({ totalVentas, pedidos, completados, ticketPromedio, totalesPorMetodoPago })
})

app.get("/reportes/ventas-series", auth, (req, res) => {
  const { from, to, estado, metodoPago, granularity, breakdown } = req.query
  function parseDateToTs(v, endOfDay = false) {
    if (!v) return undefined
    const asNum = Number(v)
    if (!Number.isNaN(asNum)) return asNum
    const d = new Date(String(v))
    if (Number.isNaN(d.getTime())) return undefined
    if (endOfDay) {
      d.setHours(23, 59, 59, 999)
    } else {
      d.setHours(0, 0, 0, 0)
    }
    return d.getTime()
  }
  const filters = {}
  const fromTs = parseDateToTs(from, false)
  const toTs = parseDateToTs(to, true)
  if (typeof fromTs === "number") filters.from = fromTs
  if (typeof toTs === "number") filters.to = toTs
  if (estado) filters.estado = String(estado)
  if (metodoPago) filters.metodoPago = String(metodoPago)
  if (granularity) filters.granularity = String(granularity) === "month" ? "month" : "day"
  if (breakdown) filters.breakdown = String(breakdown)
  const series = listSalesSeries(filters)
  res.json(series)
})

let server = null
if (config.nodeEnv !== "test") {
  server = app.listen(port, () => {
    console.log(`CRM LOLO backend escuchando en el puerto ${port}`)
  })
}

export { app, server }
export default app
