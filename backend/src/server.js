import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import jwt from "jsonwebtoken"
import bcrypt from "bcryptjs"
import fs from "fs"
import path from "path"
import PDFDocument from "pdfkit"
import nodemailer from "nodemailer"
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
  getOrder,
  addOrder,
  updateOrder,
  addProforma,
  listProformas,
  users,
  listStockMovementsDetailed,
  countStockMovements,
  listOrderAuditDetailed,
  countOrderAudit,
  getDashboardStats,
  updateUserPasswordByEmail
} from "./store.js"

dotenv.config()

const app = express()
const allowedOrigin = process.env.CORS_ORIGIN || ""
app.use(cors(allowedOrigin ? { origin: allowedOrigin } : {}))
app.use(express.json())

const port = process.env.PORT || 4000
const jwtSecret = process.env.JWT_SECRET
if (!jwtSecret) {
  console.error("JWT_SECRET is required")
  process.exit(1)
}

// Initialize admin password from env if provided
if (process.env.ADMIN_PASSWORD) {
  const adminEmail = process.env.ADMIN_EMAIL || "admin@lolo"
  try {
    const hash = bcrypt.hashSync(process.env.ADMIN_PASSWORD, 10)
    updateUserPasswordByEmail(adminEmail, hash)
    console.log("Admin password updated from env for:", adminEmail)
  } catch (e) {
    console.error("Failed to update admin password from env:", e.message)
  }
}

const storageRoot = path.join(process.cwd(), "backend", "storage")
const proformaDir = path.join(storageRoot, "proformas")
fs.mkdirSync(proformaDir, { recursive: true })
app.use("/static/proformas", express.static(proformaDir))

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

app.post("/auth/login", (req, res) => {
  const { email, password } = req.body || {}
  const u = users.findByEmail(email)
  if (!u) return res.status(401).json({ error: "invalid_credentials" })
  let ok = false
  if (u.passwordHash.startsWith("plain:")) {
    ok = password === u.passwordHash.replace("plain:", "")
  } else {
    ok = bcrypt.compareSync(password, u.passwordHash)
  }
  if (!ok) return res.status(401).json({ error: "invalid_credentials" })
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
    const items = listClients({ q, email, minPrecio, maxPrecio, limit: l, offset, includeInactive: String(includeInactive) === 'true' })
    const total = countClients({ q, email, minPrecio, maxPrecio, includeInactive: String(includeInactive) === 'true' })
    res.json({ items, total })
  } else {
    const data = listClients({ q, email, minPrecio, maxPrecio, includeInactive: String(includeInactive) === 'true' })
    res.json(data)
  }
})

app.post("/clientes", auth, allowRoles("Admin", "Operador"), (req, res) => {
  const { nombre, contacto, telefono, email, direccion, precioPersonalizado, notas } = req.body || {}
  if (!nombre) return res.status(400).json({ error: "nombre" })
  if (email && !validEmail(email)) return res.status(400).json({ error: "email" })
  const precio = precioPersonalizado == null ? null : Number(precioPersonalizado)
  const c = addClient({ nombre, contacto, telefono, email, direccion, precioPersonalizado: precio, notas })
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

app.get("/productos", auth, (req, res) => {
  const { q, page, limit, includeInactive } = req.query
  if (page && limit) {
    const p = Math.max(1, Number(page))
    const l = Math.max(1, Number(limit))
    const offset = (p - 1) * l
    const items = listProducts({ q, limit: l, offset, includeInactive: String(includeInactive) === 'true' })
    const total = countProducts({ q, includeInactive: String(includeInactive) === 'true' })
    res.json({ items, total })
  } else {
    const data = listProducts({ q, includeInactive: String(includeInactive) === 'true' })
    res.json(data)
  }
})

app.post("/productos", auth, allowRoles("Admin", "Operador"), (req, res) => {
  const { nombre, descripcion, precioMinimo, precioMaximo, stockActual, stockMinimo } = req.body || {}
  if (!nombre) return res.status(400).json({ error: "nombre" })
  const p = addProduct({ nombre, descripcion, precioMinimo: Number(precioMinimo || 0), precioMaximo: Number(precioMaximo || 0), stockActual: Number(stockActual || 0), stockMinimo: Number(stockMinimo || 0) })
  res.status(201).json(p)
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
    if (endOfDay) { d.setHours(23,59,59,999) } else { d.setHours(0,0,0,0) }
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

app.post("/pedidos", auth, allowRoles("Admin", "Operador"), (req, res) => {
  const { clienteId, productoId, cantidad, precioUnitario, metodoPago, notas } = req.body || {}
  if (!clienteId || !productoId) return res.status(400).json({ error: "referencias" })
  const cant = Number(cantidad || 0)
  if (cant <= 0) return res.status(400).json({ error: "cantidad" })
  const prod = getProduct(Number(productoId))
  if (!prod) return res.status(400).json({ error: "producto" })
  if ((prod.stockActual || 0) < cant) return res.status(400).json({ error: "stock" })
  const client = getClient(Number(clienteId))
  if (!client) return res.status(400).json({ error: "cliente" })
  const unit = precioUnitario != null ? Number(precioUnitario) : Number(client.precioPersonalizado || prod.precioMinimo || 0)
  const total = unit * cant
  const estado = "Pendiente"
  const pedido = addOrder({ clienteId: Number(clienteId), productoId: Number(productoId), cantidad: cant, precioUnitario: unit, total, estado, metodoPago: metodoPago || "", notas: notas || "" })
  pedido.audit.push({ userId: req.user.sub, date: Date.now(), observation: "creado" })
  res.status(201).json(pedido)
})

app.put("/pedidos/:id", auth, allowRoles("Admin", "Operador"), (req, res) => {
  const id = Number(req.params.id)
  const body = req.body || {}
  const before = getOrder(id)
  if (!before) return res.status(404).json({ error: "not_found" })
  const updated = updateOrder(id, body)
  updated.audit.push({ userId: req.user.sub, date: Date.now(), observation: "actualizado" })
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
  const prod = getProduct(pedido.productoId)
  const ts = Date.now()
  const fileName = `${id}-${ts}.pdf`
  const filePath = path.join(proformaDir, fileName)
  const doc = new PDFDocument()
  const stream = fs.createWriteStream(filePath)
  doc.pipe(stream)
  doc.fontSize(18).text("Proforma")
  doc.moveDown()
  doc.fontSize(12).text(`Pedido: ${pedido.id}`)
  doc.text(`Fecha: ${new Date(ts).toLocaleString()}`)
  doc.text(`Cliente: ${client?.nombre || ""}`)
  doc.text(`Producto: ${prod?.nombre || ""}`)
  doc.text(`Cantidad: ${pedido.cantidad}`)
  doc.text(`Precio unitario: ${pedido.precioUnitario}`)
  doc.text(`Total: ${pedido.total}`)
  doc.end()
  await new Promise(r => stream.on("finish", r))
  const url = `/static/proformas/${fileName}`
  const record = addProforma({ pedidoId: id, clienteId: pedido.clienteId, total: pedido.total, url })
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && client?.email) {
    try {
      const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: false, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } })
      await transporter.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to: client.email, subject: "Proforma", text: "Adjunto proforma", attachments: [{ filename: fileName, path: filePath }] })
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

// removed legacy KPIs route

app.get("/reportes/ventas.csv", auth, (req, res) => {
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
  const data = listOrdersWithNames(filters)
  const header = ["id","fecha","clienteId","clienteNombre","productoId","productoNombre","cantidad","precioUnitario","total","estado","metodoPago"].join(",")
  const rows = data.map(o => [o.id, new Date(o.createdAt).toISOString(), o.clienteId, o.clienteNombre || "", o.productoId, o.productoNombre || "", o.cantidad, o.precioUnitario, o.total, o.estado, o.metodoPago].join(","))
  const csv = [header, ...rows].join("\n")
  res.setHeader("Content-Type", "text/csv")
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
  const items = listOrders(filters)
  const totalVentas = items.reduce((s, o) => s + Number(o.total || 0), 0)
  const pedidos = items.length
  const completados = items.filter(o => o.estado === "Completado").length
  const ticketPromedio = pedidos ? Math.round(totalVentas / pedidos) : 0
  const totalesPorMetodoPago = {}
  for (const m of payments) {
    totalesPorMetodoPago[m] = items.filter(o => o.metodoPago === m).reduce((s, o) => s + Number(o.total || 0), 0)
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
    if (endOfDay) { d.setHours(23,59,59,999) } else { d.setHours(0,0,0,0) }
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

app.listen(port, () => {})
