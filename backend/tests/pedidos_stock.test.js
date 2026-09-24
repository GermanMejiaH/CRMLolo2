import test from "node:test"
import assert from "node:assert/strict"
import fs from "fs"
import path from "path"
import os from "os"

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "crm-lolo-stock-test-"))
const tempDbPath = path.join(tempDir, "test-stock.db")

process.env.NODE_ENV = "test"
process.env.DB_PATH = tempDbPath
process.env.STORAGE_DIR = tempDir
process.env.JWT_SECRET = "secret_testing_key_12345"

test("Descuento automático de inventario virtual al generar y gestionar pedidos", async (t) => {
  const { app } = await import("../src/server.js")
  const store = await import("../src/store.js")
  const db = (await import("../src/db.js")).default

  let server = null
  let baseUrl = ""
  let authToken = ""
  let clientId = null
  let prod1Id = null
  let prod2Id = null

  t.before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const address = server.address()
        baseUrl = `http://127.0.0.1:${address.port}`
        resolve()
      })
    })

    // Login as admin
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@lolo", password: "admin123" })
    })
    const loginJson = await loginRes.json()
    authToken = loginJson.token

    // Create client
    const clientRes = await fetch(`${baseUrl}/clientes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ nombre: "Cliente Test Inventario" })
    })
    const client = await clientRes.json()
    clientId = client.id

    // Create Product 1 with stock 100
    const p1Res = await fetch(`${baseUrl}/productos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        nombre: "Módulo XR-StockTest",
        precioMinimo: 50000,
        precioMaximo: 70000,
        stockActual: 100,
        stockMinimo: 10
      })
    })
    const p1 = await p1Res.json()
    prod1Id = p1.id

    // Create Product 2 with stock 50
    const p2Res = await fetch(`${baseUrl}/productos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        nombre: "Estacionaria Pro-StockTest",
        precioMinimo: 30000,
        precioMaximo: 40000,
        stockActual: 50,
        stockMinimo: 5
      })
    })
    const p2 = await p2Res.json()
    prod2Id = p2.id
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

  let createdOrderId = null

  await t.test("Generar pedido descuenta automáticamente el stock de los productos", async () => {
    const orderRes = await fetch(`${baseUrl}/pedidos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        clienteId: clientId,
        metodoPago: "Efectivo",
        items: [
          { productoId: prod1Id, cantidad: 10, precioUnitario: 50000 },
          { productoId: prod2Id, cantidad: 5, precioUnitario: 30000 }
        ]
      })
    })

    assert.equal(orderRes.status, 201)
    const order = await orderRes.json()
    createdOrderId = order.id

    // Verificar stock de Producto 1 (100 - 10 = 90)
    const p1Updated = store.getProduct(prod1Id)
    assert.equal(p1Updated.stockActual, 90)

    // Verificar stock de Producto 2 (50 - 5 = 45)
    const p2Updated = store.getProduct(prod2Id)
    assert.equal(p2Updated.stockActual, 45)

    // Verificar movimientos en Kardex
    const kardexP1 = store.getKardex(prod1Id)
    assert.ok(kardexP1.length >= 1)
    assert.equal(kardexP1[0].tipoMovimiento, "VENTA")
    assert.equal(kardexP1[0].cantidad, -10)
    assert.equal(kardexP1[0].stockResultante, 90)
  })

  await t.test("Cancelar un pedido restaura el stock automáticamente", async () => {
    const updateRes = await fetch(`${baseUrl}/pedidos/${createdOrderId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ estado: "Cancelado" })
    })

    assert.equal(updateRes.status, 200)

    // Verificar que stock se restauró (90 + 10 = 100 y 45 + 5 = 50)
    const p1Updated = store.getProduct(prod1Id)
    assert.equal(p1Updated.stockActual, 100)

    const p2Updated = store.getProduct(prod2Id)
    assert.equal(p2Updated.stockActual, 50)

    // Verificar Kardex
    const kardexP1 = store.getKardex(prod1Id)
    assert.equal(kardexP1[0].tipoMovimiento, "CANCELACION_PEDIDO")
    assert.equal(kardexP1[0].cantidad, 10)
    assert.equal(kardexP1[0].stockResultante, 100)
  })

  await t.test("Reactivar un pedido cancelado vuelve a descontar el stock", async () => {
    const reactivateRes = await fetch(`${baseUrl}/pedidos/${createdOrderId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ estado: "Completado" })
    })

    assert.equal(reactivateRes.status, 200)

    const p1Updated = store.getProduct(prod1Id)
    assert.equal(p1Updated.stockActual, 90)
  })

  await t.test("Eliminar un pedido activo restaura el stock", async () => {
    const deleteRes = await fetch(`${baseUrl}/pedidos/${createdOrderId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${authToken}` }
    })

    assert.equal(deleteRes.status, 200)

    const p1Updated = store.getProduct(prod1Id)
    assert.equal(p1Updated.stockActual, 100)

    const p2Updated = store.getProduct(prod2Id)
    assert.equal(p2Updated.stockActual, 50)
  })
})
