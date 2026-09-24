import test from "node:test"
import assert from "node:assert/strict"
import fs from "fs"
import path from "path"
import os from "os"

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "crm-lolo-fase3-test-"))
const tempDbPath = path.join(tempDir, "test-fase3.db")

process.env.NODE_ENV = "test"
process.env.DB_PATH = tempDbPath
process.env.STORAGE_DIR = tempDir
process.env.JWT_SECRET = "secret_fase3_test_key_777"

test("Pruebas FASE 3: Inteligencia de Negocio, Dashboard Ejecutivo, Rankings, Cierre Mensual y Salud", async (t) => {
  const { app } = await import("../src/server.js")
  const store = await import("../src/store.js")
  const db = (await import("../src/db.js")).default

  let server = null
  let baseUrl = ""
  let authToken = ""

  t.before(() => {
    return new Promise((resolve) => {
      server = app.listen(0, async () => {
        const address = server.address()
        baseUrl = `http://127.0.0.1:${address.port}`
        resolve()
      })
    })
  })

  t.after(() => {
    return new Promise((resolve) => {
      server.close(() => {
        try {
          db.close()
          fs.rmSync(tempDir, { recursive: true, force: true })
        } catch {}
        resolve()
      })
    })
  })

  let rawWireId = 0
  let rawBoxId = 0
  let finishedProductId = 0
  let clientId1 = 0
  let clientId2 = 0
  let orderId1 = 0

  await t.test("Autenticación y preparación de catálogo de prueba FASE 3", async () => {
    // 1. Auth login
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@lolo", password: "admin123" })
    })
    const loginData = await loginRes.json()
    assert.equal(loginRes.status, 200)
    authToken = loginData.token

    // 2. Crear clientes
    const c1Res = await fetch(`${baseUrl}/clientes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ nombre: "Distribuidora MotoMax", contacto: "Jorge Ramirez" })
    })
    const c1Data = await c1Res.json()
    clientId1 = c1Data.id

    const c2Res = await fetch(`${baseUrl}/clientes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ nombre: "Repuestos El Imán", contacto: "Ana Lopez" })
    })
    const c2Data = await c2Res.json()
    clientId2 = c2Data.id

    // 3. Crear materias primas y producto terminado
    const m1Res = await fetch(`${baseUrl}/productos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ nombre: "Cable Cobre 18AWG", tipo: "materia_prima", costoUnitario: 1500, stockActual: 200, stockMinimo: 30 })
    })
    const m1Data = await m1Res.json()
    rawWireId = m1Data.id

    const m2Res = await fetch(`${baseUrl}/productos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ nombre: "Carcasa ABS Moto", tipo: "materia_prima", costoUnitario: 2500, stockActual: 100, stockMinimo: 20 })
    })
    const m2Data = await m2Res.json()
    rawBoxId = m2Data.id

    const pTermRes = await fetch(`${baseUrl}/productos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ nombre: "Estacionaria Moto F3", tipo: "producto_terminado", precioMinimo: 18000, precioMaximo: 30000, stockActual: 0, stockMinimo: 10 })
    })
    const pTermData = await pTermRes.json()
    finishedProductId = pTermData.id

    // 4. Configurar BOM: 2m Cable ($3,000) + 1 Carcasa ($2,500) = $5,500 materiales + $1,000 mano obra = $6,500 costo unitario
    await fetch(`${baseUrl}/bom/${finishedProductId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        items: [
          { materiaPrimaId: rawWireId, cantidadRequerida: 2 },
          { materiaPrimaId: rawBoxId, cantidadRequerida: 1 }
        ]
      })
    })

    // 5. Ensamblar 20 unidades
    const assRes = await fetch(`${baseUrl}/produccion/ensamblar`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ productoTerminadoId: finishedProductId, cantidadProducida: 20, notas: "Lote de inicio FASE 3" })
    })
    assert.equal(assRes.status, 201)
  })

  await t.test("Snapshot Histórico de Rentabilidad Congelado al Crear Pedido (Módulo 1)", async () => {
    // Vender 10 unidades a $25,000 c/u = $250,000 total. Costo unitario congelado = $6,500 ($65,000 total costo). Utilidad = $185,000
    const oRes = await fetch(`${baseUrl}/pedidos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        clienteId: clientId1,
        items: [{ productoId: finishedProductId, cantidad: 10, precioUnitario: 25000 }]
      })
    })
    const oData = await oRes.json()
    orderId1 = oData.id
    assert.equal(oRes.status, 201)

    // Consultar pedido directamente en DB para validar columnas de snapshot histórico
    const dbOrder = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId1)
    assert.equal(dbOrder.costoTotalHistorico, 65000)
    assert.equal(dbOrder.utilidadHistorica, 185000)
    assert.equal(dbOrder.margenHistorico, 74)

    const dbItem = db.prepare("SELECT * FROM order_items WHERE orderId = ?").get(orderId1)
    assert.equal(dbItem.costoMaterialesHistorico, 55000)
    assert.equal(dbItem.costoManoObraHistorico, 10000)
    assert.equal(dbItem.costoTotalHistorico, 65000)
    assert.equal(dbItem.utilidadHistorica, 185000)

    // AHORA MODIFICAR PRECIOS EN EL CATÁLOGO FUTURO
    // Cambiar costo de materia prima e incremento de mano de obra
    db.prepare("UPDATE products SET costoUnitario = 10000 WHERE id = ?").run(rawWireId)

    // Verificar que el snapshot del pedido anterior PERMANECE INTACTO (congelado)
    const dbOrderAfter = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId1)
    assert.equal(dbOrderAfter.costoTotalHistorico, 65000)
    assert.equal(dbOrderAfter.utilidadHistorica, 185000)
  })

  await t.test("Dashboard Ejecutivo (Módulo 2)", async () => {
    const dashRes = await fetch(`${baseUrl}/dashboard/ejecutivo`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    const dash = await dashRes.json()
    assert.equal(dashRes.status, 200)
    assert.equal(dash.ventasMesActual, 250000)
    assert.equal(dash.utilidadMesActual, 185000)
    assert.equal(dash.produccionMesActual.unidades, 20)
    assert.ok(dash.clientesActivos >= 2)
    assert.ok(dash.productosActivos >= 3)
  })

  await t.test("Alertas Operativas Determinísticas (Módulo 3)", async () => {
    const alertRes = await fetch(`${baseUrl}/alertas/operativas`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    const alerts = await alertRes.json()
    assert.equal(alertRes.status, 200)
    assert.ok(alerts.resumen)
    assert.ok(Array.isArray(alerts.stockCritico))
    assert.ok(Array.isArray(alerts.materialAgotarse))
    assert.ok(Array.isArray(alerts.clientesInactivos))
  })

  await t.test("Proyección de Inventario Basada en Consumo (Módulo 4)", async () => {
    const projRes = await fetch(`${baseUrl}/inventario/proyeccion`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    const proj = await projRes.json()
    assert.equal(projRes.status, 200)
    assert.ok(Array.isArray(proj))

    const item = proj.find((p) => p.productoId === finishedProductId)
    assert.ok(item)
    assert.equal(item.usoUltimos30Dias, 10)
    assert.equal(item.consumoPromedioDiario, 0.33)
    assert.ok(item.diasRestantes > 0)
  })

  await t.test("Rankings de Clientes y Productos (Módulos 5 y 6)", async () => {
    // 1. Ranking Clientes
    const cliRankRes = await fetch(`${baseUrl}/reportes/rankings/clientes`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    const cliRank = await cliRankRes.json()
    assert.equal(cliRankRes.status, 200)
    assert.ok(Array.isArray(cliRank.masVentas))
    assert.equal(cliRank.masVentas[0].clienteId, clientId1)

    // 2. Ranking Productos
    const prodRankRes = await fetch(`${baseUrl}/reportes/rankings/productos`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    const prodRank = await prodRankRes.json()
    assert.equal(prodRankRes.status, 200)
    assert.ok(Array.isArray(prodRank.masVendidos))
    assert.equal(prodRank.masVendidos[0].productoId, finishedProductId)
  })

  await t.test("Cierre Mensual PDF y Excel/CSV (Módulo 7)", async () => {
    // 1. PDF
    const pdfRes = await fetch(`${baseUrl}/cierre-mensual/pdf`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    assert.equal(pdfRes.status, 200)
    assert.equal(pdfRes.headers.get("content-type"), "application/pdf")
    const pdfBuffer = await pdfRes.arrayBuffer()
    assert.ok(pdfBuffer.byteLength > 1000)
    const headerStr = Buffer.from(pdfBuffer).slice(0, 5).toString("utf8")
    assert.equal(headerStr, "%PDF-")

    // 2. CSV
    const csvRes = await fetch(`${baseUrl}/cierre-mensual/csv`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    assert.equal(csvRes.status, 200)
    assert.ok(csvRes.headers.get("content-type").includes("text/csv"))
    const csvText = await csvRes.text()
    assert.ok(csvText.includes("CIERRE MENSUAL"))
    assert.ok(csvText.includes("250000"))
  })

  await t.test("Salud del Negocio y Scorecard (Módulo 8)", async () => {
    const healthRes = await fetch(`${baseUrl}/salud-negocio`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    const health = await healthRes.json()
    assert.equal(healthRes.status, 200)
    assert.ok(health.ventas)
    assert.ok(health.utilidad)
    assert.ok(health.produccion)
    assert.ok(health.inventario)
    assert.ok(["Mejorando", "Estable", "Requiere atención"].includes(health.saludGeneral))
  })
})
