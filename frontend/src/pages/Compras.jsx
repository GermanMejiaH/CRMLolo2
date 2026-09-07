import React, { useEffect, useState } from "react"
import { Truck, Plus, Eye, Calendar, User, DollarSign, Package, FileText, CheckCircle2, AlertCircle } from "lucide-react"
import { getCompras, createCompra, getProductos } from "../api/client"
import { useToast } from "../components/ToastContext"
import Modal from "../components/Modal"

export default function Compras({ token }) {
  const { addToast } = useToast()

  const [compras, setCompras] = useState([])
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)

  // Modal crear compra
  const [modalCreateOpen, setModalCreateOpen] = useState(false)
  const [loadingSubmit, setLoadingSubmit] = useState(false)
  const [proveedor, setProveedor] = useState("")
  const [notas, setNotas] = useState("")
  const [items, setItems] = useState([{ productId: "", cantidad: 1, costoUnitario: 0 }])

  // Modal ver detalle compra
  const [selectedCompra, setSelectedCompra] = useState(null)

  useEffect(() => {
    loadData()
  }, [token])

  async function loadData() {
    if (!token) return
    setLoading(true)
    try {
      const [compRes, prodRes] = await Promise.all([getCompras(token), getProductos(token, { limit: 100 })])
      setCompras(Array.isArray(compRes) ? compRes : [])
      const prodsList = Array.isArray(prodRes) ? prodRes : prodRes.items || []
      setProductos(prodsList)
    } catch {
      addToast("Error al cargar órdenes de compra e insumos", "error")
    } finally {
      setLoading(false)
    }
  }

  function handleAddItem() {
    setItems((prev) => [...prev, { productId: "", cantidad: 1, costoUnitario: 0 }])
  }

  function handleRemoveItem(index) {
    if (items.length <= 1) return
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  function handleItemChange(index, field, val) {
    setItems((prev) => {
      const copy = [...prev]
      copy[index] = { ...copy[index], [field]: val }

      // Si cambia el producto, auto-asignar su costo unitario si lo tiene
      if (field === "productId") {
        const selectedProd = productos.find((p) => String(p.id) === String(val))
        if (selectedProd && selectedProd.costoUnitario) {
          copy[index].costoUnitario = selectedProd.costoUnitario
        }
      }

      return copy
    })
  }

  const calculatedTotal = items.reduce((sum, item) => {
    const qty = Number(item.cantidad || 0)
    const cost = Number(item.costoUnitario || 0)
    return sum + qty * cost
  }, 0)

  async function handleSubmitCompra(e) {
    e.preventDefault()
    if (!proveedor.trim()) {
      addToast("Indica el nombre del proveedor o importador", "warning")
      return
    }

    const validItems = items.filter((it) => it.productId && Number(it.cantidad) > 0)
    if (validItems.length === 0) {
      addToast("Agrega al menos un insumo/materia prima válido a la compra", "warning")
      return
    }

    setLoadingSubmit(true)
    try {
      const payload = {
        proveedor: proveedor.trim(),
        notas: notas.trim() || null,
        items: validItems.map((it) => ({
          productId: Number(it.productId),
          cantidad: Number(it.cantidad),
          costoUnitario: Number(it.costoUnitario)
        }))
      }

      await createCompra(token, payload)
      addToast("¡Orden de compra / importación registrada exitosamente!", "success")
      setModalCreateOpen(false)
      setProveedor("")
      setNotas("")
      setItems([{ productId: "", cantidad: 1, costoUnitario: 0 }])
      loadData()
    } catch (err) {
      addToast(err.message || "Error al guardar la orden de compra", "error")
    } finally {
      setLoadingSubmit(false)
    }
  }

  const totalInversion = compras.reduce((sum, c) => sum + Number(c.totalCost || 0), 0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6 text-slate-100">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Truck className="w-8 h-8 text-cyan-400" />
            <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
              Compras e Importaciones
            </h1>
          </div>
          <p className="text-slate-400">
            Abastecimiento de materias primas, insumos (cable, estaño, resina) e importaciones desde China.
          </p>
        </div>

        <button
          onClick={() => setModalCreateOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-medium rounded-xl shadow-lg shadow-cyan-500/20 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
        >
          <Plus className="w-5 h-5" /> Registrar Compra / Importación
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-slate-800/40 backdrop-blur-md border border-cyan-500/20 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between text-cyan-400 mb-2">
            <span className="text-sm font-medium">Órdenes de Compra</span>
            <FileText className="w-5 h-5" />
          </div>
          <p className="text-3xl font-bold text-slate-100">{compras.length}</p>
          <p className="text-xs text-slate-400 mt-1">Registros de ingreso de stock</p>
        </div>

        <div className="bg-slate-800/40 backdrop-blur-md border border-purple-500/20 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between text-purple-400 mb-2">
            <span className="text-sm font-medium">Total Invertido en Insumos</span>
            <DollarSign className="w-5 h-5" />
          </div>
          <p className="text-3xl font-bold text-slate-100">${totalInversion.toLocaleString("es-CO")}</p>
          <p className="text-xs text-slate-400 mt-1">Sumatoria de compras e importaciones</p>
        </div>

        <div className="bg-slate-800/40 backdrop-blur-md border border-emerald-500/20 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between text-emerald-400 mb-2">
            <span className="text-sm font-medium">Catálogo de Insumos</span>
            <Package className="w-5 h-5" />
          </div>
          <p className="text-3xl font-bold text-slate-100">
            {productos.filter((p) => p.tipo === "materia_prima").length} Materias Primas
          </p>
          <p className="text-xs text-slate-400 mt-1">Registrados en la base de datos</p>
        </div>
      </div>

      {/* Tabla de Compras */}
      <div className="bg-slate-800/40 backdrop-blur-md border border-slate-700/50 rounded-2xl p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-slate-100 mb-4 flex items-center gap-2">
          <Truck className="w-5 h-5 text-cyan-400" /> Historial de Compras
        </h2>

        {loading ? (
          <div className="text-center py-12 text-slate-400">Cargando compras...</div>
        ) : compras.length === 0 ? (
          <div className="text-center py-12 text-slate-400 border border-dashed border-slate-700 rounded-xl">
            No se han registrado órdenes de compra aún.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/60 text-slate-400 uppercase text-xs">
                <tr>
                  <th className="p-3.5">N° Orden</th>
                  <th className="p-3.5">Proveedor</th>
                  <th className="p-3.5">Insumos</th>
                  <th className="p-3.5">Total Compra</th>
                  <th className="p-3.5">Fecha</th>
                  <th className="p-3.5">Responsable</th>
                  <th className="p-3.5 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {compras.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="p-3.5 font-mono text-cyan-400 font-bold">#CMP-{c.id}</td>
                    <td className="p-3.5 font-semibold text-slate-100">{c.proveedor}</td>
                    <td className="p-3.5 text-slate-300">{c.totalItems || c.items?.length || 1} insumo(s)</td>
                    <td className="p-3.5 font-bold text-emerald-400">${Number(c.totalCost).toLocaleString("es-CO")}</td>
                    <td className="p-3.5 text-slate-400">{new Date(c.fecha).toLocaleString("es-CO")}</td>
                    <td className="p-3.5 text-slate-300">{c.userName || "Admin"}</td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => setSelectedCompra(c)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-cyan-300 rounded-lg text-xs font-medium transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" /> Detalle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Registrar Compra */}
      {modalCreateOpen && (
        <Modal isOpen={modalCreateOpen} title="Registrar Compra / Importación de Insumos" onClose={() => setModalCreateOpen(false)}>
          <form onSubmit={handleSubmitCompra} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Proveedor / Importación <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ej. Shenzhen Electronics Co. / Proveedor Local"
                value={proveedor}
                onChange={(e) => setProveedor(e.target.value)}
                className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-300">
                  Materias Primas e Insumos Comprados <span className="text-red-400">*</span>
                </label>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Agregar Insumo
                </button>
              </div>

              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {items.map((item, idx) => {
                  const selProd = productos.find((p) => String(p.id) === String(item.productId))
                  const unitLabel = selProd?.unidadMedida || "unidades"
                  return (
                    <div key={idx} className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-3 space-y-2">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                        <div className="md:col-span-5">
                          <select
                            required
                            value={item.productId}
                            onChange={(e) => handleItemChange(idx, "productId", e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100"
                          >
                            <option value="">-- Selecciona Insumo --</option>
                            {productos.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.nombre} ({p.tipo === "materia_prima" ? "Materia Prima" : "Producto"})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="md:col-span-3">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="any"
                              min="0.001"
                              required
                              placeholder="Cant."
                              value={item.cantidad}
                              onChange={(e) => handleItemChange(idx, "cantidad", e.target.value)}
                              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100"
                            />
                            <span className="text-[10px] text-cyan-400 font-semibold">{unitLabel}</span>
                          </div>
                        </div>

                        <div className="md:col-span-3">
                          <input
                            type="number"
                            min="0"
                            required
                            placeholder="Costo $/u"
                            value={item.costoUnitario}
                            onChange={(e) => handleItemChange(idx, "costoUnitario", e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100"
                          />
                        </div>

                        <div className="md:col-span-1 text-right">
                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="text-red-400 hover:text-red-300 text-xs"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-[11px] text-slate-400">
                        Subtotal:{" "}
                        <span className="text-emerald-400 font-bold">
                          ${(Number(item.cantidad || 0) * Number(item.costoUnitario || 0)).toLocaleString("es-CO")}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="bg-slate-900/90 border border-cyan-500/30 rounded-xl p-3 flex justify-between items-center text-sm">
              <span className="text-slate-300">Costo Total de la Compra:</span>
              <span className="text-xl font-bold text-emerald-400">${calculatedTotal.toLocaleString("es-CO")}</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Notas / Observaciones</label>
              <textarea
                rows="2"
                placeholder="Ej. Importación Lote #045 desde China via flete marítimo..."
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModalCreateOpen(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loadingSubmit}
                className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-medium rounded-xl text-sm shadow-lg shadow-cyan-500/20"
              >
                {loadingSubmit ? "Guardando..." : "Guardar Compra"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Ver Detalle Compra */}
      {selectedCompra && (
        <Modal isOpen={Boolean(selectedCompra)} title={`Detalle de Compra #CMP-${selectedCompra.id}`} onClose={() => setSelectedCompra(null)}>
          <div className="space-y-4 text-sm text-slate-300">
            <div className="grid grid-cols-2 gap-4 bg-slate-900/60 p-3 rounded-xl border border-slate-700/50">
              <div>
                <p className="text-xs text-slate-400">Proveedor</p>
                <p className="font-bold text-slate-100">{selectedCompra.proveedor}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Fecha</p>
                <p className="font-bold text-slate-100">{new Date(selectedCompra.fecha).toLocaleString("es-CO")}</p>
              </div>
            </div>

            {selectedCompra.notas && (
              <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-800">
                <p className="text-xs text-slate-400">Observaciones</p>
                <p className="text-slate-200 text-xs italic">{selectedCompra.notas}</p>
              </div>
            )}

            <div>
              <h4 className="font-semibold text-slate-200 mb-2">Insumos Ingresados al Stock:</h4>
              <div className="border border-slate-700/50 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-400">
                    <tr>
                      <th className="p-2.5">Insumo</th>
                      <th className="p-2.5">Cantidad</th>
                      <th className="p-2.5">Costo Unit.</th>
                      <th className="p-2.5 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {(selectedCompra.items || []).map((it) => (
                      <tr key={it.id}>
                        <td className="p-2.5 font-medium text-slate-200">{it.productoNombre}</td>
                        <td className="p-2.5 text-cyan-400 font-bold">
                          {it.cantidad} {it.unidadMedida || "unidades"}
                        </td>
                        <td className="p-2.5">${Number(it.costoUnitario).toLocaleString("es-CO")}</td>
                        <td className="p-2.5 text-right font-bold text-emerald-400">
                          ${Number(it.subtotal).toLocaleString("es-CO")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 font-bold text-base">
              <span>Total Compra:</span>
              <span className="text-emerald-400">${Number(selectedCompra.totalCost).toLocaleString("es-CO")}</span>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedCompra(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl"
              >
                Cerrar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
