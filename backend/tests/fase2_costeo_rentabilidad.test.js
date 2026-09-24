import test from "node:test"
import assert from "node:assert/strict"
import fs from "fs"
import path from "path"
import os from "os"

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "crm-lolo-fase2-test-"))
const tempDbPath = path.join(tempDir, "test-fase2.db")

process.env.NODE_ENV = "test"
process.env.DB_PATH = tempDbPath
process.env.STORAGE_DIR = tempDir
process.env.JWT_SECRET = "secret_fase2_test_key_999"

test("Pruebas FASE 2: Costeo, Rentabilidad, Flujo de Caja, Stock Negativo y Backups", async (t) => {
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
  let rawBoxId = 0
  let finishedModuleId = 0
  let clientId = 0
  let orderId1 = 0
  let orderId2 = 0

  await t.test("Autenticación y Configuración de Mano de Obra (Módulo 1)", async () => {
    // 1. Auth login
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@lolo", password: "admin123" })
    })
    const loginData = await loginRes.json()
    assert.equal(loginRes.status, 200)
    authToken = loginData.token

    // 2. GET /configuracion default (1000 COP)
    const getCfgRes = await fetch(`${baseUrl}/configuracion`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    const cfgData = await getCfgRes.json()
    assert.equal(getCfgRes.status, 200)
    assert.equal(cfgData.costoManoObraUnitaria, 1000)

    // 3. PUT /configuracion update to 1200 COP
    const putCfgRes = await fetch(`${baseUrl}/configuracion`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ costoManoObraUnitaria: 1200 })
    })
    const putCfgData = await putCfgRes.json()
    assert.equal(putCfgRes.status, 200)
    assert.equal(putCfgData.costoManoObraUnitaria, 1200)

    // Reset back to 1000 COP for consistency
    await fetch(`${baseUrl}/configuracion`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ costoManoObraUnitaria: 1000 })
    })
  })

  await t.test("Creación de insumos, receta BOM y ejecución de Ensamblado con desglose de costos (Módulo 1)", async () => {
    // Insmo 1: Cableado ($2,000 / m)
    const r1 = await fetch(`${baseUrl}/productos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ nombre: "Cableado Eléctrico", tipo: "materia_prima", costoUnitario: 2000, stockActual: 100, stockMinimo: 10 })
    })
    const d1 = await r1.json()
    rawCableId = d1.id

    // Insumo 2: Caja Plástica ($3,000 / u)
    const r2 = await fetch(`${baseUrl}/productos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ nombre: "Caja Estacionaria", tipo: "materia_prima", costoUnitario: 3000, stockActual: 50, stockMinimo: 5 })
    })
    const d2 = await r2.json()
    rawBoxId = d2.id

    // Producto Terminado: Módulo Estacionaria Moto
    const r3 = await fetch(`${baseUrl}/productos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ nombre: "Módulo Estacionaria Moto X1", tipo: "producto_terminado", precioMinimo: 15000, precioMaximo: 25000, stockActual: 0, stockMinimo: 5 })
    })
    const d3 = await r3.json()
    finishedModuleId = d3.id

    // BOM: 2m Cableado ($4,000) + 1 Caja ($3,000) = $7,000 materiales
    await fetch(`${baseUrl}/bom/${finishedModuleId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        items: [
          { materiaPrimaId: rawCableId, cantidadRequerida: 2 },
          { materiaPrimaId: rawBoxId, cantidadRequerida: 1 }
        ]
      })
    })

    // Exec assembly: 10 modules
    // Materiales = 10 * 7,000 = 70,000 COP
    // Mano de obra = 10 * 1,000 = 10,000 COP
    // Costo total = 80,000 COP
    // Costo unitario = 8,000 COP
    const assRes = await fetch(`${baseUrl}/produccion/ensamblar`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ productoTerminadoId: finishedModuleId, cantidadProducida: 10, notas: "Lote de prueba FASE 2" })
    })
    const assData = await assRes.json()
    assert.equal(assRes.status, 201)
    const oInfo = assData.order || assData
    assert.equal(oInfo.cantidadProducida, 10)
    assert.equal(oInfo.costoMateriales, 70000)
    assert.equal(oInfo.costoManoObra, 10000)
    assert.equal(oInfo.costoTotalProduccion, 80000)
    assert.equal(oInfo.costoUnitario, 8000)
  })

  await t.test("Rentabilidad por Pedido, Cliente y Producto (Módulos 2, 3, 4)", async () => {
    // Crear cliente
    const cRes = await fetch(`${baseUrl}/clientes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ nombre: "Taller MotoPro", contacto: "Pedro Gomez", telefono: "3000000000" })
    })
    const cData = await cRes.json()
    clientId = cData.id

    // Crear Pedido 1: 5 módulos a $20,000 c/u = $100,000 venta. Costo est: 5 * 8,000 = 40,000. Ganancia: 60,000 (60%)
    const oRes1 = await fetch(`${baseUrl}/pedidos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        clienteId: clientId,
        items: [{ productoId: finishedModuleId, cantidad: 5, precioUnitario: 20000 }]
      })
    })
    const oData1 = await oRes1.json()
    orderId1 = oData1.id
    assert.equal(oRes1.status, 201)

    // 1. Rentabilidad por Pedido (Módulo 2)
    const rPedRes = await fetch(`${baseUrl}/reportes/rentabilidad/pedidos`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    const rPedData = await rPedRes.json()
    assert.equal(rPedRes.status, 200)
    assert.ok(Array.isArray(rPedData))
    const ped1 = rPedData.find((p) => p.orderId === orderId1)
    assert.ok(ped1)
    assert.equal(ped1.totalVenta, 100000)
    assert.equal(ped1.costoEstimado, 40000)
    assert.equal(ped1.ganancia, 60000)
    assert.equal(ped1.margenPercent, 60)

    // 2. Rentabilidad por Cliente (Módulo 3)
    const rCliRes = await fetch(`${baseUrl}/reportes/rentabilidad/clientes`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    const rCliData = await rCliRes.json()
    assert.equal(rCliRes.status, 200)
    assert.ok(Array.isArray(rCliData))
    const cli1 = rCliData.find((c) => c.clienteId === clientId)
    assert.ok(cli1)
    assert.equal(cli1.ventasTotales, 100000)
    assert.equal(cli1.costosEstimados, 40000)
    assert.equal(cli1.ganancia, 60000)

    // 3. Productos más rentables (Módulo 4)
    const rProdRes = await fetch(`${baseUrl}/reportes/rentabilidad/productos`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    const rProdData = await rProdRes.json()
    assert.equal(rProdRes.status, 200)
    assert.ok(Array.isArray(rProdData))
    const prod1 = rProdData.find((p) => p.productoId === finishedModuleId)
    assert.ok(prod1)
    assert.equal(prod1.unidadesVendidas, 5)
    assert.equal(prod1.ventas, 100000)
    assert.equal(prod1.utilidad, 60000)
  })

  await t.test("Flujo de Caja Simple (Módulo 5)", async () => {
    // Registrar abono de $50,000 en el Pedido 1
    const abonoRes = await fetch(`${baseUrl}/pedidos/${orderId1}/abonos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ monto: 50000, metodoPago: "Efectivo", nota: "Abono inicial 50%" })
    })
    assert.equal(abonoRes.status, 201)

    // Consultar Flujo de Caja
    const fcRes = await fetch(`${baseUrl}/reportes/flujo-caja`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
    const fcData = await fcRes.json()
    assert.equal(fcRes.status, 200)
    assert.ok(fcData.ingresos)
    assert.ok(fcData.egresos)
    assert.equal(fcData.ingresos.abonos, 50000)
    assert.equal(fcData.egresos.manoObra, 10000)
    assert.equal(fcData.balance, fcData.totalIngresos - fcData.totalEgresos)
  })

  await t.test("Validación de Seguridad de Inventario contra Stock Negativo (Módulo 7)", async () => {
    // Intentar ajustar stock produciendo stock negativo -> Debe lanzar excepción en adjustStock y HTTP 400/500
    assert.throws(() => {
      store.adjustStock(finishedModuleId, -9999, "intento_invalido", "TEST-NEG")
    }, /stock negativo/i)

    // Verificar que stock actual sigue siendo 5 (10 producidos - 5 vendidos)
    const pCurrent = store.getProduct(finishedModuleId)
    assert.equal(pCurrent.stockActual, 5)

    // Intentar crear un pedido solicitando 100 unidades (solo hay 5) -> Debe fallar sin modificar stock
    const badOrderRes = await fetch(`${baseUrl}/pedidos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        clienteId: clientId,
        items: [{ productoId: finishedModuleId, cantidad: 100, precioUnitario: 20000 }]
      })
    })
    assert.equal(badOrderRes.status, 400)
    const pAfterBadOrder = store.getProduct(finishedModuleId)
    assert.equal(pAfterBadOrder.stockActual, 5)
  })

  await t.test("Respaldos Automáticos y Retención Pruning (Módulo 6)", async () => {
    // Exec backup endpoint
    const bRes = await fetch(`${baseUrl}/admin/backup`, {
      method: "POST",
      headers: { Authorization: `Bearer ${authToken}` }
    })
    const bData = await bRes.json()
    assert.equal(bRes.status, 200)
    assert.equal(bData.success, true)
    assert.ok(fs.existsSync(bData.backupPath))

    // Test pruning helper directly
    const backupDir = path.dirname(bData.backupPath)
    // Create dummy fake backup files to test pruning
    for (let i = 0; i < 35; i++) {
      fs.writeFileSync(path.join(backupDir, `fake-data-${100 + i}.db`), "dummy backup data")
    }
    const deleted = store.triggerBackup ? await store.triggerBackup() : null
    assert.ok(deleted)
  })
})
