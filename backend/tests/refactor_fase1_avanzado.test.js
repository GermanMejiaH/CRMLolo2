import test from "node:test"
import assert from "node:assert/strict"
import fs from "fs"
import path from "path"
import os from "os"

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "crm-lolo-refactor-test-"))
const tempDbPath = path.join(tempDir, "test-refactor.db")

process.env.NODE_ENV = "test"
process.env.DB_PATH = tempDbPath
process.env.STORAGE_DIR = tempDir
process.env.JWT_SECRET = "secret_testing_key_12345"

test("Pruebas avanzadas de Refactorización Fase 1: Kardex, Cancelaciones Múltiples, Restauración y Transacciones", async (t) => {
  const { app } = await import("../src/server.js")
  const store = await import("../src/store.js")
  const db = (await import("../src/db.js")).default

  let server = null
  let baseUrl = ""
  let authToken = ""
  let clientId = null
  let prodAId = null
  let prodBId = null

  t.before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const address = server.address()
        baseUrl = `http://127.0.0.1:${address.port}`
        resolve()
      })
    })

    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@lolo", password: "admin123" })
    })
    const loginJson = await loginRes.json()
    authToken = loginJson.token

    const clientRes = await fetch(`${baseUrl}/clientes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ nombre: "Cliente Pruebas Avanzadas" })
    })
    const client = await clientRes.json()
    clientId = client.id

    // Crear Producto A con stock 50
    const paRes = await fetch(`${baseUrl}/productos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        nombre: "Módulo Avanzado A",
        precioMinimo: 100000,
        precioMaximo: 150000,
        stockActual: 50,
        stockMinimo: 5
      })
    })
    const pa = await paRes.json()
    prodAId = pa.id

    // Crear Producto B con stock 30
    const pbRes = await fetch(`${baseUrl}/productos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        nombre: "Módulo Avanzado B",
        precioMinimo: 80000,
        precioMaximo: 120000,
        stockActual: 30,
        stockMinimo: 5
      })
    })
    const pb = await pbRes.json()
    prodBId = pb.id
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

  let order1Id = null
  let order2Id = null
  let order3Id = null

  await t.test("Auditoría completa de movimientos de Kardex e historial de stock", async () => {
    // 1. Ajuste manual de stock (+10 a Prod A)
    store.adjustStock(prodAId, 10, "Ajuste manual prueba", "REF-AUDIT", 1)
    let pA = store.getProduct(prodAId)
    assert.equal(pA.stockActual, 60)

    // 2. Kardex debe reflejar el movimiento
    const kardex = store.getKardex(prodAId)
    assert.ok(kardex.length >= 1)
    assert.equal(kardex[0].cantidad, 10)
    assert.equal(kardex[0].stockResultante, 60)
  })

  await t.test("Cancelaciones múltiples y restauración exacta de inventario", async () => {
    // Crear 3 pedidos
    // Pedido 1: Prod A (cantidad 10)
    const o1Res = await fetch(`${baseUrl}/pedidos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        clienteId: clientId,
        items: [{ productoId: prodAId, cantidad: 10, precioUnitario: 100000 }]
      })
    })
    order1Id = (await o1Res.json()).id

    // Pedido 2: Prod A (cantidad 15) y Prod B (cantidad 5)
    const o2Res = await fetch(`${baseUrl}/pedidos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        clienteId: clientId,
        items: [
          { productoId: prodAId, cantidad: 15, precioUnitario: 100000 },
          { productoId: prodBId, cantidad: 5, precioUnitario: 80000 }
        ]
      })
    })
    order2Id = (await o2Res.json()).id

    // Pedido 3: Prod B (cantidad 10)
    const o3Res = await fetch(`${baseUrl}/pedidos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        clienteId: clientId,
        items: [{ productoId: prodBId, cantidad: 10, precioUnitario: 80000 }]
      })
    })
    order3Id = (await o3Res.json()).id

    // Verificar stock tras crear 3 pedidos
    // Stock Prod A: 60 - 10 - 15 = 35
    // Stock Prod B: 30 - 5 - 10 = 15
    assert.equal(store.getProduct(prodAId).stockActual, 35)
    assert.equal(store.getProduct(prodBId).stockActual, 15)

    // Cancelar Pedido 1 -> Debería restaurar 10 uds de Prod A (35 -> 45)
    await fetch(`${baseUrl}/pedidos/${order1Id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ estado: "Cancelado" })
    })
    assert.equal(store.getProduct(prodAId).stockActual, 45)

    // Cancelar Pedido 2 -> Debería restaurar 15 uds de Prod A (45 -> 60) y 5 de Prod B (15 -> 20)
    await fetch(`${baseUrl}/pedidos/${order2Id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ estado: "Cancelado" })
    })
    assert.equal(store.getProduct(prodAId).stockActual, 60)
    assert.equal(store.getProduct(prodBId).stockActual, 20)

    // Reactivar Pedido 1 -> Debería volver a descontar 10 uds de Prod A (60 -> 50)
    await fetch(`${baseUrl}/pedidos/${order1Id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ estado: "Completado" })
    })
    assert.equal(store.getProduct(prodAId).stockActual, 50)

    // Eliminar Pedido 3 (activo con 10 uds de Prod B) -> Debería restaurar Prod B (20 -> 30)
    await fetch(`${baseUrl}/pedidos/${order3Id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${authToken}` }
    })
    assert.equal(store.getProduct(prodBId).stockActual, 30)
  })

  await t.test("Control de errores en transacciones de ensamblado y reactivación sin suficiente stock", async () => {
    // 1. Intentar reactivar un pedido cuya cantidad requerida excede el stock actual
    // Pedido 2 estaba cancelado con 15 uds de Prod A. Agotemos el stock de Prod A a solo 5 uds.
    store.adjustStock(prodAId, -45, "Ajuste vaciado", "TEST-ERR", 1) // Stock pasa a 5
    assert.equal(store.getProduct(prodAId).stockActual, 5)

    // Intentar reactivar Pedido 2 (requiere 15) debe ser rechazado por falta de stock
    const reactivateRes = await fetch(`${baseUrl}/pedidos/${order2Id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ estado: "Pendiente" })
    })

    assert.equal(reactivateRes.status, 400)
    // El stock debe permanecer inalterado en 5
    assert.equal(store.getProduct(prodAId).stockActual, 5)

    // 2. Intentar ejecutar ensamblado sin receta configurada debe fallar
    assert.throws(() => {
      store.executeAssemblyOrder(prodAId, 10, 1, "Sin receta")
    }, /receta/)
  })

  await t.test("Verificación de generación de archivos de log activity.log y error.log", async () => {
    const logsDir = path.join(tempDir, "logs")
    const activityFile = path.join(logsDir, "activity.log")
    const errorFile = path.join(logsDir, "error.log")

    assert.ok(fs.existsSync(activityFile), "activity.log debe existir")
    const activityContent = fs.readFileSync(activityFile, "utf8")
    assert.ok(activityContent.includes("LOGIN_EXITOSO"), "activity.log debe registrar inicios de sesión")
    assert.ok(activityContent.includes("CREACION_PEDIDO"), "activity.log debe registrar creación de pedidos")
    assert.ok(activityContent.includes("CANCELACION_PEDIDO"), "activity.log debe registrar cancelaciones")
  })
})
