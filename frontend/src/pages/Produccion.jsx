import React, { useEffect, useState } from "react"
import {
  Cpu,
  Package,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  History,
  Layers,
  Search,
  RefreshCw,
  Clock
} from "lucide-react"
import { useToast } from "../components/ToastContext"
import {
  getProductos,
  verificarEnsamblado,
  ejecutarEnsamblado,
  getHistorialProduccion,
  getCapacidadTeorica
} from "../api/client"

export default function Produccion({ token }) {
  const { addToast } = useToast()

  // State
  const [productosTerminados, setProductosTerminados] = useState([])
  const [selectedProdId, setSelectedProdId] = useState("")
  const [cantidad, setCantidad] = useState("10")
  const [verificacion, setVerificacion] = useState(null)
  const [capacidadTeorica, setCapacidadTeorica] = useState(null)
  const [loadingCheck, setLoadingCheck] = useState(false)
  const [loadingAssembly, setLoadingAssembly] = useState(false)

  // History state
  const [historial, setHistorial] = useState([])
  const [loadingHistorial, setLoadingHistorial] = useState(false)

  useEffect(() => {
    loadFinishedProducts()
    loadHistorial()
  }, [token])

  useEffect(() => {
    if (selectedProdId && token) {
      loadCapacidad(selectedProdId)
    }
  }, [selectedProdId, token])

  async function loadCapacidad(id) {
    try {
      const res = await getCapacidadTeorica(token, id)
      setCapacidadTeorica(res)
    } catch {
      setCapacidadTeorica(null)
    }
  }

  async function loadFinishedProducts() {
    if (!token) return
    try {
      const res = await getProductos(token, { tipo: "producto_terminado" })
      const list = Array.isArray(res) ? res : res.items || []
      setProductosTerminados(list)
      if (list.length > 0 && !selectedProdId) {
        setSelectedProdId(String(list[0].id))
      }
    } catch {
      addToast("Error al cargar productos terminados", "error")
    }
  }

  async function loadHistorial() {
    if (!token) return
    setLoadingHistorial(true)
    try {
      const res = await getHistorialProduccion(token, { limit: 20 })
      setHistorial(Array.isArray(res) ? res : res.items || [])
    } catch {
      addToast("Error al cargar historial de producción", "error")
    } finally {
      setLoadingHistorial(false)
    }
  }

  async function handleVerificar() {
    if (!selectedProdId || !cantidad || Number(cantidad) <= 0) {
      addToast("Selecciona un producto y una cantidad mayor a 0", "warning")
      return
    }
    setLoadingCheck(true)
    try {
      const res = await verificarEnsamblado(token, Number(selectedProdId), Number(cantidad))
      setVerificacion(res)
      if (!res.available) {
        addToast("Advertencia: Stock insuficiente para algunos insumos", "warning")
      } else {
        addToast("Verificación exitosa: Insumos completos para el ensamblado", "success")
      }
    } catch (e) {
      addToast(e.message || "Error al verificar ensamblado", "error")
      setVerificacion(null)
    } finally {
      setLoadingCheck(false)
    }
  }

  async function handleEjecutarEnsamblado() {
    if (!selectedProdId || !cantidad || Number(cantidad) <= 0) return
    if (verificacion && !verificacion.available) {
      addToast("No se puede ensamblar: Stock insuficiente de materias primas", "error")
      return
    }

    setLoadingAssembly(true)
    try {
      const res = await ejecutarEnsamblado(token, Number(selectedProdId), Number(cantidad))
      const count = res.order?.cantidadProducida || cantidad
      addToast(`¡Ensamblado exitoso! Se produjeron ${count} unidades.`, "success")
      setVerificacion(null)
      loadFinishedProducts()
      loadHistorial()
      if (selectedProdId) loadCapacidad(selectedProdId)
    } catch (e) {
      addToast(e.message || "Error al ejecutar orden de ensamblado", "error")
    } finally {
      setLoadingAssembly(false)
    }
  }

  const selectedProdObj = productosTerminados.find((p) => String(p.id) === String(selectedProdId))

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6 text-slate-100">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Cpu className="w-8 h-8 text-cyan-400" />
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
            Ensamblado y Producción
          </h1>
        </div>
        <p className="text-gray-400 ml-11">
          Simulador de recetas BOM, verificación de stock de materias primas y órdenes de ensamblado atómicas.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Assembly Form & Pre-check Simulator */}
        <div className="lg:col-span-2 bg-slate-800/50 backdrop-blur-sm border border-cyan-500/30 rounded-xl p-6 shadow-xl shadow-cyan-500/10 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-700/60 pb-4">
            <h2 className="text-xl font-semibold text-cyan-400 flex items-center gap-2">
              <Layers className="w-5 h-5" /> Orden de Ensamblado
            </h2>
            <span className="text-xs text-slate-400 bg-slate-900 px-3 py-1 rounded-full border border-slate-700">
              Proceso Atómico de Stock
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Producto Terminado a Ensamblar</label>
              <select
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none transition-colors"
                value={selectedProdId}
                onChange={(e) => {
                  setSelectedProdId(e.target.value)
                  setVerificacion(null)
                }}
              >
                {productosTerminados.length === 0 ? (
                  <option value="">No hay productos terminados creados</option>
                ) : (
                  productosTerminados.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} (Stock actual: {p.stockActual} unid | Costo BOM: ${p.costoUnitario || 0})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Cantidad a Fabricar</label>
              <input
                type="number"
                min="1"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none transition-colors"
                value={cantidad}
                onChange={(e) => {
                  setCantidad(e.target.value)
                  setVerificacion(null)
                }}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleVerificar}
              disabled={loadingCheck || !selectedProdId}
              className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg text-sm transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {loadingCheck ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Verificar Insumos Requeridos
            </button>

            <button
              onClick={handleEjecutarEnsamblado}
              disabled={loadingAssembly || !verificacion || !verificacion.available}
              className="px-6 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-semibold rounded-lg text-sm shadow-lg shadow-green-500/20 transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loadingAssembly ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Ejecutar Ensamblado
            </button>
          </div>

          {/* Verification Simulator Table */}
          {verificacion && (
            <div className="mt-6 border-t border-slate-700/60 pt-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-200">
                  Pre-Chequeo de Receta BOM ({cantidad} unidades)
                </h3>
                {verificacion.available ? (
                  <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-300 border border-green-500/40 text-xs font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-green-400" /> Stock Suficiente
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 text-xs font-semibold flex items-center gap-1.5">
                    <XCircle className="w-4 h-4 text-red-400" /> Insumos Faltantes
                  </span>
                )}
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-3 text-left">Insumo / Materia Prima</th>
                      <th className="p-3 text-center">Req. / Unid</th>
                      <th className="p-3 text-center">Total Req.</th>
                      <th className="p-3 text-center">Stock Actual</th>
                      <th className="p-3 text-center">Estado Insumo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!verificacion.items || verificacion.items.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="p-4 text-center text-slate-500">
                          Este producto no tiene insumos configurados en su Receta BOM. Agrega insumos en el menú
                          Productos.
                        </td>
                      </tr>
                    ) : (
                      verificacion.items.map((d) => (
                        <tr key={d.materiaPrimaId} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                          <td className="p-3 font-medium text-white">{d.materiaPrimaNombre}</td>
                          <td className="p-3 text-center text-slate-300">
                            {d.cantidadRequeridaUnitaria} {d.materiaPrimaUnidadMedida || "unid"}
                          </td>
                          <td className="p-3 text-center text-cyan-300 font-semibold">
                            {d.cantidadTotalRequerida} {d.materiaPrimaUnidadMedida || "unid"}
                          </td>
                          <td className="p-3 text-center text-slate-300">
                            {d.stockActual} {d.materiaPrimaUnidadMedida || "unid"}
                          </td>
                          <td className="p-3 text-center">
                            {d.suficiente ? (
                              <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-green-500/20 text-green-300 border border-green-500/30 inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> OK
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-red-500/20 text-red-300 border border-red-500/30 inline-flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" /> Faltan {d.faltante}{" "}
                                {d.materiaPrimaUnidadMedida || "unid"}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {verificacion.totalCost > 0 && (
                    <tfoot className="bg-slate-950/80 border-t border-slate-800 font-semibold">
                      <tr>
                        <td colSpan="3" className="p-3 text-right text-slate-300">
                          Costo Estimado de Fabricación:
                        </td>
                        <td colSpan="2" className="p-3 text-center text-green-400 font-bold text-base">
                          ${verificacion.totalCost.toLocaleString()} (${verificacion.unitCost}/unid)
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Info Card */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-purple-500/30 rounded-xl p-6 shadow-xl shadow-purple-500/10 space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-semibold text-purple-300 mb-2 flex items-center gap-2">
              <Package className="w-5 h-5" /> Modelo de Ensamblado CRM LOLO
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed mb-4">
              En CRM LOLO, los módulos principales son importados desde China y los suministros de ensamblado (cable,
              estaño, resina) son comprados localmente.
            </p>
            <ul className="text-xs text-slate-400 space-y-2 border-t border-slate-700/60 pt-4">
              <li className="flex items-start gap-2">
                <span className="text-cyan-400 font-bold">1.</span>
                <span>
                  Define cada componente como <strong>Materia Prima</strong> en la sección Productos.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-cyan-400 font-bold">2.</span>
                <span>
                  Configura la <strong>Receta BOM</strong> especificando cuántos insumos requiere cada Módulo LOLO.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-cyan-400 font-bold">3.</span>
                <span>
                  Ejecuta la <strong>Orden de Ensamblado</strong>: el sistema descontará atómicamente el stock de
                  materias primas e incrementará los Productos Terminados listos para venta.
                </span>
              </li>
            </ul>
          </div>

          {selectedProdObj && (
            <div className="bg-slate-900/80 p-4 rounded-lg border border-slate-700 text-xs space-y-2">
              <div className="text-slate-400 font-medium">Producto Seleccionado</div>
              <div className="text-sm font-bold text-white">{selectedProdObj.nombre}</div>
              <div className="flex justify-between text-slate-300 pt-1 border-t border-slate-800">
                <span>Stock Actual:</span>
                <span className="font-semibold text-cyan-400">{selectedProdObj.stockActual} unid</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Costo Unitario BOM:</span>
                <span className="font-semibold text-green-400">${selectedProdObj.costoUnitario || 0}</span>
              </div>

              {capacidadTeorica && (
                <div className="pt-2 border-t border-slate-800 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300 font-medium">Capacidad Máx. Ensamblado:</span>
                    <span className="font-bold text-emerald-400 text-sm">{capacidadTeorica.capacidadMaxima} unid</span>
                  </div>
                  {capacidadTeorica.cuelloDeBotella ? (
                    <div className="bg-amber-500/10 border border-amber-500/30 p-2 rounded-lg text-[11px] text-amber-300">
                      <strong>⚠️ Cuello de botella:</strong> {capacidadTeorica.cuelloDeBotella.materiaPrimaNombre} (stock: {capacidadTeorica.cuelloDeBotella.stockActual} {capacidadTeorica.cuelloDeBotella.unidadMedida})
                    </div>
                  ) : capacidadTeorica.capacidadMaxima > 0 ? (
                    <div className="text-[11px] text-emerald-400">
                      ✓ Insumos balanceados para ensamblar hasta {capacidadTeorica.capacidadMaxima} unidades.
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Assembly History */}
      <div className="bg-slate-800/50 backdrop-blur-sm border border-cyan-500/30 rounded-xl p-6 shadow-xl shadow-cyan-500/10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-cyan-400 flex items-center gap-2">
            <History className="w-5 h-5" /> Historial de Órdenes de Producción
          </h2>
          <button
            onClick={loadHistorial}
            className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors"
            title="Recargar historial"
          >
            <RefreshCw className={`w-4 h-4 ${loadingHistorial ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-700">
              <tr>
                <th className="p-3 text-left">N° Orden</th>
                <th className="p-3 text-left">Producto Terminado</th>
                <th className="p-3 text-center">Cant. Producida</th>
                <th className="p-3 text-right">Costo Total Producción</th>
                <th className="p-3 text-left">Usuario / Responsable</th>
                <th className="p-3 text-left">Fecha y Hora</th>
              </tr>
            </thead>
            <tbody>
              {historial.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-6 text-center text-slate-500">
                    No hay órdenes de ensamblado registradas.
                  </td>
                </tr>
              ) : (
                historial.map((h) => (
                  <tr key={h.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="p-3 font-mono text-cyan-400">#ORD-{h.id}</td>
                    <td className="p-3 font-medium text-white">{h.productoNombre}</td>
                    <td className="p-3 text-center text-cyan-300 font-bold">{h.cantidad}</td>
                    <td className="p-3 text-right text-green-400 font-semibold">
                      ${(h.costoTotalProduccion || 0).toLocaleString()}
                    </td>
                    <td className="p-3 text-slate-300">{h.usuarioNombre || h.usuarioId || "Sistema"}</td>
                    <td className="p-3 text-slate-400 text-xs flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(h.fecha).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
