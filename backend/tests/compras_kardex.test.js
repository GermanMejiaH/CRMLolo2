import test from "node:test"
import assert from "node:assert/strict"
import fs from "fs"
import path from "path"
import os from "os"

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "crm-lolo-compras-test-"))
const tempDbPath = path.join(tempDir, "test-compras.db")

process.env.NODE_ENV = "test"
process.env.DB_PATH = tempDbPath
process.env.STORAGE_DIR = tempDir
process.env.JWT_SECRET = "secret_compras_test_key_999"

test("Pruebas de Compras, Kardex y Capacidad Teórica de Producción", async (t) => {
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

  let rawCableId = 0
  let rawTinId = 0
  let finishedModuleId = 0

  await t.test("Autenticar usuario admin", async () => {
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@lolo", password: "admin123" })
    })
    const data = await loginRes.json()
    assert.equal(loginRes.status, 200)
    assert.ok(data.token)
    authToken = data.token
  })

  await t.test("Crear materias primas y producto terminado", async () => {
    const cableRes = await fetch(`${baseUrl}/productos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        nombre: "Cable Morado Test",
        tipo: "materia_prima",
        stockActual: 0,
        stockMinimo: 10,
        costoUnitario: 500,
        unidadMedida: "metros"
      })
    })
    const cable = await cableRes.json()
    assert.equal(cableRes.status, 201)
    rawCableId = cable.id

    const tinRes = await fetch(`${baseUrl}/productos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        nombre: "Estaño para soldar Test",
        tipo: "materia_prima",
        stockActual: 0,
        stockMinimo: 50,
        costoUnitario: 200,
        unidadMedida: "gramos"
      })
    })
    const tin = await tinRes.json()
    assert.equal(tinRes.status, 201)
    rawTinId = tin.id

    const modRes = await fetch(`${baseUrl}/productos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        nombre: "Módulo XR-Test",
        tipo: "producto_terminado",
        precioMinimo: 30000,
        precioMaximo: 50000,
        stockActual: 0,
        stockMinimo: 5
      })
    })
    const mod = await modRes.json()
    assert.equal(modRes.status, 201)
    finishedModuleId = mod.id
  })

  await t.test("Registrar orden de compra / importación de insumos", async () => {
    const buyRes = await fetch(`${baseUrl}/compras`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        proveedor: "Shenzhen Electronics Co.",
        items: [
          { productId: rawCableId, cantidad: 100, costoUnitario: 500 },
          { productId: rawTinId, cantidad: 200, costoUnitario: 200 }
        ],
        notas: "Importación Lote 001"
      })
    })
    const purchase = await buyRes.json()
    assert.equal(buyRes.status, 201)
    assert.equal(purchase.proveedor, "Shenzhen Electronics Co.")
    assert.equal(purchase.totalCost, 90000)
    assert.equal(purchase.items.length, 2)

    const prodCable = store.getProduct(rawCableId)
    assert.equal(prodCable.stockActual, 100)
    assert.equal(prodCable.unidadMedida, "metros")

    const prodTin = store.getProduct(rawTinId)
    assert.equal(prodTin.stockActual, 200)
    assert.equal(prodTin.unidadMedida, "gramos")
  })

  await t.test("Consultar Kardex de movimientos tras la compra", async () => {
    const kardexRes = await fetch(`${baseUrl}/kardex/${rawCableId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    const kardex = await kardexRes.json()
    assert.equal(kardexRes.status, 200)
    assert.equal(kardex.length, 1)
    assert.equal(kardex[0].tipoMovimiento, "COMPRA")
    assert.equal(kardex[0].cantidad, 100)
    assert.equal(kardex[0].unidadMedida, "metros")
    assert.equal(kardex[0].stockResultante, 100)
  })

  await t.test("Configurar Receta BOM y verificar Capacidad Teórica de Ensamblado", async () => {
    const setBomRes = await fetch(`${baseUrl}/bom/${finishedModuleId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        items: [
          { materiaPrimaId: rawCableId, cantidadRequerida: 0.5 },
          { materiaPrimaId: rawTinId, cantidadRequerida: 2 }
        ]
      })
    })
    assert.equal(setBomRes.status, 200)

    const capRes = await fetch(`${baseUrl}/produccion/capacidad-teorica/${finishedModuleId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    const cap = await capRes.json()
    assert.equal(capRes.status, 200)
    assert.equal(cap.capacidadMaxima, 100)
    assert.equal(cap.cuelloDeBotella.materiaPrimaId, rawTinId)
  })

  await t.test("Ejecutar Ensamblado y auditar descuento automático en Kardex", async () => {
    const ensRes = await fetch(`${baseUrl}/produccion/ensamblar`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        productoTerminadoId: finishedModuleId,
        cantidadProducida: 10
      })
    })
    assert.equal(ensRes.status, 201)

    const cableFinal = store.getProduct(rawCableId)
    assert.equal(cableFinal.stockActual, 95)

    const tinFinal = store.getProduct(rawTinId)
    assert.equal(tinFinal.stockActual, 180)

    const modFinal = store.getProduct(finishedModuleId)
    assert.equal(modFinal.stockActual, 10)

    const modKardex = await fetch(`${baseUrl}/kardex/${finishedModuleId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    const modKardexData = await modKardex.json()
    assert.equal(modKardexData.length, 1)
    assert.equal(modKardexData[0].tipoMovimiento, "ENSAMBLADO_PRODUCCION")
    assert.equal(modKardexData[0].cantidad, 10)
    assert.equal(modKardexData[0].stockResultante, 10)
  })
})
