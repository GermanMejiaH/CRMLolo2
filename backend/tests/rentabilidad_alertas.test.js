import test from "node:test"
import assert from "node:assert/strict"
import fs from "fs"
import path from "path"
import os from "os"

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "crm-lolo-rent-test-"))
const tempDbPath = path.join(tempDir, "test-rent.db")

process.env.NODE_ENV = "test"
process.env.DB_PATH = tempDbPath
process.env.STORAGE_DIR = tempDir
process.env.JWT_SECRET = "secret_rentabilidad_test_key_888"

test("Pruebas de Rentabilidad Real (COGS) y Alertas de Stock", async (t) => {
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
  let finishedModuleId = 0
  let clientId = 0

  await t.test("Autenticar usuario admin y crear catálogo de prueba", async () => {
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@lolo", password: "admin123" })
    })
    const data = await loginRes.json()
    assert.equal(loginRes.status, 200)
    authToken = data.token

    // Cliente
    const cliRes = await fetch(`${baseUrl}/clientes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ nombre: "Cliente Rentabilidad Test" })
    })
    const cli = await cliRes.json()
    clientId = cli.id

    // Materia Prima con stock bajo (0 actual vs 50 minimo)
    const wireRes = await fetch(`${baseUrl}/productos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        nombre: "Cable Rojo Alerta",
        tipo: "materia_prima",
        stockActual: 0,
        stockMinimo: 50,
        costoUnitario: 1000,
        unidadMedida: "metros"
      })
    })
    const wire = await wireRes.json()
    rawWireId = wire.id

    // Producto Terminado
    const modRes = await fetch(`${baseUrl}/productos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        nombre: "Módulo XR-Profit",
        tipo: "producto_terminado",
        precioMinimo: 40000,
        precioMaximo: 60000,
        stockActual: 20,
        stockMinimo: 5
      })
    })
    const mod = await modRes.json()
    finishedModuleId = mod.id

    // Configurar BOM: cada módulo usa 2 metros de Cable Rojo ($2,000 COGS por unidad)
    await fetch(`${baseUrl}/bom/${finishedModuleId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        items: [{ materiaPrimaId: rawWireId, cantidadRequerida: 2 }]
      })
    })
  })

  await t.test("Verificar Centro de Alertas de Stock Mínimo y Reordenamiento", async () => {
    const alertRes = await fetch(`${baseUrl}/alertas/stock`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    const alerts = await alertRes.json()
    assert.equal(alertRes.status, 200)
    assert.ok(alerts.alertasCount >= 1)

    const wireAlert = alerts.items.find((i) => i.productoId === rawWireId)
    assert.ok(wireAlert)
    assert.equal(wireAlert.stockActual, 0)
    assert.equal(wireAlert.stockMinimo, 50)
    assert.equal(wireAlert.sugerenciaReorden, 100) // Llevar al doble del stock mínimo
    assert.equal(wireAlert.costoEstimadoReorden, 100000) // 100m x $1,000
  })

  await t.test("Crear pedido de venta y consultar Reporte de Rentabilidad Real (COGS)", async () => {
    // Vender 5 módulos a $50,000 cada uno ($250,000 total venta)
    // COGS insumos: 5 uds * (2m * $1,000) = $10,000 COGS
    // Utilidad Bruta: $250,000 - $10,000 = $240,000 (96% de margen)
    const orderRes = await fetch(`${baseUrl}/pedidos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        clienteId: clientId,
        items: [{ productoId: finishedModuleId, cantidad: 5, precioUnitario: 50000 }]
      })
    })
    assert.equal(orderRes.status, 201)

    // Consultar reporte de rentabilidad
    const rentRes = await fetch(`${baseUrl}/reportes/rentabilidad`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    const rent = await rentRes.json()
    assert.equal(rentRes.status, 200)
    assert.ok(rent.summary)
    assert.equal(rent.summary.totalVentas, 250000)
    assert.equal(rent.summary.totalCOGS, 10000)
    assert.equal(rent.summary.gananciaBrutaTotal, 240000)
    assert.equal(rent.summary.margenPromedioPercent, 96)

    // Verificar desgloses
    assert.equal(rent.porProducto.length, 1)
    assert.equal(rent.porProducto[0].productoId, finishedModuleId)
    assert.equal(rent.porProducto[0].gananciaBruta, 240000)

    assert.equal(rent.porCliente.length, 1)
    assert.equal(rent.porCliente[0].clienteId, clientId)
    assert.equal(rent.porCliente[0].gananciaBruta, 240000)
  })
})
