import React, { useEffect, useState } from "react"
import { Package, AlertTriangle, Plus, Search, TrendingUp, TrendingDown, Filter, Trash2, Edit2, X, Save, ChevronLeft, ChevronRight, Check, RefreshCw } from "lucide-react"
import { useToast } from '../components/ToastContext'
import Modal from '../components/Modal'
import { getProductos, getProductosPaged, createProducto, ajustarStockProducto, updateProducto, getProductoMovimientos, desactivarProducto, deleteProducto } from '../api/client'

export default function Productos({ token }) {
  const { addToast } = useToast()
  const [items, setItems] = useState([])
  const [nuevo, setNuevo] = useState({ nombre: "", precioMinimo: "", precioMaximo: "", stockActual: "", stockMinimo: "" })
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedTerm, setDebouncedTerm] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [total, setTotal] = useState(0)
  const [editingId, setEditingId] = useState(null)
  const [editValues, setEditValues] = useState({ nombre: "", descripcion: "", precioMinimo: "", precioMaximo: "", stockMinimo: "" })
  const [showAdjust, setShowAdjust] = useState(false)
  const [adjustData, setAdjustData] = useState({ diff: "", motivo: "", referencia: "" })
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [showMovs, setShowMovs] = useState(false)
  const [movs, setMovs] = useState([])
  const [movPage, setMovPage] = useState(1)
  const [movLimit, setMovLimit] = useState(10)
  const [movTotal, setMovTotal] = useState(0)
  const [movFilterType, setMovFilterType] = useState("")
  const [movFilterText, setMovFilterText] = useState("")
  const [includeInactive, setIncludeInactive] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteProductId, setDeleteProductId] = useState(null)
  const [showPermanentDeleteConfirm, setShowPermanentDeleteConfirm] = useState(false)
  const [permanentDeleteId, setPermanentDeleteId] = useState(null)

  async function load() {
    if (!token) return
    try {
      const params = { q: debouncedTerm, page, limit, includeInactive }
      const data = await getProductosPaged(token, params)
      if (Array.isArray(data)) {
        setItems(data)
        setTotal(data.length)
      } else {
        setItems(data.items || [])
        setTotal(Number(data.total || 0))
      }
    } catch {
      addToast('Error al cargar productos', 'error')
    }
  }

  useEffect(() => { load() }, [token, page, limit, debouncedTerm, includeInactive])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedTerm(searchTerm), 300)
    return () => clearTimeout(t)
  }, [searchTerm])

  async function crear() {
    if (!nuevo.nombre || !nuevo.precioMinimo || !nuevo.precioMaximo || !nuevo.stockActual || !nuevo.stockMinimo) {
      addToast('Por favor completa todos los campos', 'warning')
      return
    }
    try {
      const payload = {
        nombre: nuevo.nombre,
        descripcion: '',
        precioMinimo: parseFloat(nuevo.precioMinimo),
        precioMaximo: parseFloat(nuevo.precioMaximo),
        stockActual: parseInt(nuevo.stockActual),
        stockMinimo: parseInt(nuevo.stockMinimo)
      }
      const created = await createProducto(token, payload)
      setItems([...items, created])
      setNuevo({ nombre: "", precioMinimo: "", precioMaximo: "", stockActual: "", stockMinimo: "" })
      setShowForm(false)
      addToast('Producto creado exitosamente', 'success')
    } catch (e) {
      addToast('Error al crear producto', 'error')
    }
  }

  const filteredItems = items

  const getStockStatus = (actual, minimo) => {
    if (actual <= minimo) return "critical"
    if (actual <= minimo * 1.5) return "warning"
    return "good"
  }

  function beginEdit(item) {
    setEditingId(item.id)
    setEditValues({ nombre: String(item.nombre), descripcion: String(item.descripcion || ""), precioMinimo: String(item.precioMinimo), precioMaximo: String(item.precioMaximo), stockMinimo: String(item.stockMinimo) })
  }

  async function saveEdit(id) {
    try {
      const payload = {
        nombre: editValues.nombre,
        descripcion: editValues.descripcion,
        precioMinimo: parseFloat(editValues.precioMinimo),
        precioMaximo: parseFloat(editValues.precioMaximo),
        stockMinimo: parseInt(editValues.stockMinimo)
      }
      await updateProducto(token, id, payload)
      addToast('Producto actualizado', 'success')
      setEditingId(null)
      load()
    } catch {
      addToast('Error al actualizar', 'error')
    }
  }

  async function desactivar(id) {
    try {
      await desactivarProducto(token, id)
      addToast('Producto desactivado', 'success')
      load()
    } catch {
      addToast('Error al desactivar', 'error')
    }
  }

  async function reactivar(id) {
    try {
      await updateProducto(token, id, { active: 1 })
      addToast('Producto reactivado', 'success')
      load()
    } catch {
      addToast('Error al reactivar', 'error')
    }
  }

  function promptDesactivar(id) {
    setDeleteProductId(id)
    setShowDeleteConfirm(true)
  }

  async function confirmDesactivar() {
    if (!deleteProductId) return
    await desactivar(deleteProductId)
    setShowDeleteConfirm(false)
    setDeleteProductId(null)
  }

  function cancelDesactivar() {
    setShowDeleteConfirm(false)
    setDeleteProductId(null)
  }

  function promptEliminarDefinitivamente(id) {
    setPermanentDeleteId(id)
    setShowPermanentDeleteConfirm(true)
  }

  async function confirmEliminarDefinitivamente() {
    if (!permanentDeleteId) return
    try {
      await deleteProducto(token, permanentDeleteId)
      addToast('Producto eliminado definitivamente', 'success')
      load()
    } catch (e) {
      addToast(e.message || 'Error al eliminar producto', 'error')
    } finally {
      setShowPermanentDeleteConfirm(false)
      setPermanentDeleteId(null)
    }
  }

  function cancelEliminarDefinitivamente() {
    setShowPermanentDeleteConfirm(false)
    setPermanentDeleteId(null)
  }

  function cancelEdit() { setEditingId(null) }

  function openAdjust(item) {
    setSelectedProduct(item)
    setAdjustData({ diff: "", motivo: "", referencia: "" })
    setShowAdjust(true)
  }

  async function openMovs(item) {
    setSelectedProduct(item)
    setShowMovs(true)
    setMovPage(1)
    await loadMovs(item.id, 1, movLimit)
  }

  async function loadMovs(id, pageArg, limitArg) {
    try {
      const data = await getProductoMovimientos(token, id, { page: pageArg, limit: limitArg })
      setMovs(data.items || [])
      setMovTotal(Number(data.total || 0))
    } catch {
      addToast('Error al cargar movimientos', 'error')
    }
  }

  async function confirmarAjuste() {
    if (!selectedProduct) return
    const d = parseInt(adjustData.diff)
    if (!d) { addToast('Cantidad inválida', 'warning'); return }
    try {
      await ajustarStockProducto(token, selectedProduct.id, { diff: d, motivo: adjustData.motivo || 'ajuste', referencia: adjustData.referencia || '' })
      addToast('Stock ajustado', 'success')
      setShowAdjust(false)
      setSelectedProduct(null)
      load()
    } catch {
      addToast('Error al ajustar stock', 'error')
    }
  }

  const movsFiltered = movs.filter(m => {
    const typeOk = movFilterType ? m.type === movFilterType : true
    const text = movFilterText.toLowerCase()
    const textOk = movFilterText ? ((m.reason || "").toLowerCase().includes(text) || (m.ref || "").toLowerCase().includes(text)) : true
    return typeOk && textOk
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Package className="w-8 h-8 text-cyan-400" />
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
            Gestión de Productos
          </h1>
        </div>
        <p className="text-gray-400 ml-11">Control de inventario y precios para módulos LOLO</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-800/50 backdrop-blur-sm border border-cyan-500/30 rounded-lg p-4 shadow-lg shadow-cyan-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total Productos</p>
              <p className="text-3xl font-bold text-cyan-400">{items.length}</p>
            </div>
            <Package className="w-10 h-10 text-cyan-400/50" />
          </div>
        </div>
        
        <div className="bg-slate-800/50 backdrop-blur-sm border border-yellow-500/30 rounded-lg p-4 shadow-lg shadow-yellow-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Stock Bajo</p>
              <p className="text-3xl font-bold text-yellow-400">
                {items.filter(i => i.stockActual <= i.stockMinimo).length}
              </p>
            </div>
            <AlertTriangle className="w-10 h-10 text-yellow-400/50" />
          </div>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm border border-purple-500/30 rounded-lg p-4 shadow-lg shadow-purple-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Stock Total</p>
              <p className="text-3xl font-bold text-purple-400">
                {items.reduce((sum, i) => sum + i.stockActual, 0)}
              </p>
            </div>
            <TrendingUp className="w-10 h-10 text-purple-400/50" />
          </div>
        </div>
      </div>

      {/* Search and Add Button */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar producto..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-800/50 border border-cyan-500/30 rounded-lg pl-10 pr-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 focus:shadow-lg focus:shadow-cyan-500/30 transition-all"
          />
        </div>
        <div 
          onClick={() => setIncludeInactive(!includeInactive)}
          className="flex items-center gap-3 cursor-pointer group select-none px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg hover:border-cyan-500/50 transition-all"
        >
          <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${
            includeInactive 
              ? 'bg-gradient-to-r from-cyan-500 to-purple-500 border-transparent shadow-lg shadow-cyan-500/20' 
              : 'border-slate-600 bg-slate-800/50 group-hover:border-cyan-500/50'
          }`}>
            {includeInactive && <Check className="w-3.5 h-3.5 text-white" />}
          </div>
          <span className={`text-sm font-medium transition-colors ${
            includeInactive ? 'text-cyan-400' : 'text-gray-400 group-hover:text-gray-300'
          }`}>
            Mostrar inactivos
          </span>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-gradient-to-r from-cyan-500 to-purple-500 text-white px-6 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-cyan-500/50 transition-all transform hover:scale-105"
        >
          <Plus className="w-5 h-5" />
          Nuevo Producto
        </button>
      </div>

      {/* Create Form */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title="Crear Nuevo Producto"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Nombre</label>
            <input
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-cyan-500 transition-colors"
              placeholder="Nombre del producto"
              value={nuevo.nombre}
              onChange={e => setNuevo({ ...nuevo, nombre: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Precio Mínimo</label>
              <input
                type="number"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-cyan-500 transition-colors"
                placeholder="0"
                value={nuevo.precioMinimo}
                onChange={e => setNuevo({ ...nuevo, precioMinimo: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Precio Máximo</label>
              <input
                type="number"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-cyan-500 transition-colors"
                placeholder="0"
                value={nuevo.precioMaximo}
                onChange={e => setNuevo({ ...nuevo, precioMaximo: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Stock Actual</label>
              <input
                type="number"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-cyan-500 transition-colors"
                placeholder="0"
                value={nuevo.stockActual}
                onChange={e => setNuevo({ ...nuevo, stockActual: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Stock Mínimo</label>
              <input
                type="number"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-cyan-500 transition-colors"
                placeholder="0"
                value={nuevo.stockMinimo}
                onChange={e => setNuevo({ ...nuevo, stockMinimo: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-700/50">
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={crear}
              className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white rounded-lg shadow-lg shadow-cyan-500/20 transition-all transform hover:scale-105"
            >
              Crear Producto
            </button>
          </div>
        </div>
      </Modal>

      {/* Products Table */}
      <div className="bg-slate-800/50 backdrop-blur-sm border border-cyan-500/30 rounded-lg overflow-hidden shadow-xl shadow-cyan-500/20">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-900/50">
              <tr className="border-b border-cyan-500/30">
                <th className="text-left p-4 text-cyan-400 font-semibold">Producto</th>
                <th className="text-left p-4 text-cyan-400 font-semibold">Precio Rango</th>
                <th className="text-left p-4 text-cyan-400 font-semibold">Stock Actual</th>
                <th className="text-left p-4 text-cyan-400 font-semibold">Stock Mínimo</th>
                <th className="text-left p-4 text-cyan-400 font-semibold">Estado</th>
                <th className="text-left p-4 text-cyan-400 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center p-8 text-gray-400">
                    {searchTerm ? "No se encontraron productos" : "No hay productos registrados"}
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => {
                  const status = getStockStatus(item.stockActual, item.stockMinimo)
                  return (
                    <tr 
                      key={item.id} 
                      className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all cursor-pointer"
                    >
                      <td className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-purple-500 rounded-lg flex items-center justify-center">
                            <Package className="w-5 h-5 text-white" />
                          </div>
                          {editingId === item.id ? (
                            <div className="flex flex-col gap-2">
                              <input className="bg-slate-900 border border-slate-700 rounded p-2 text-white" value={editValues.nombre} onChange={e => setEditValues({ ...editValues, nombre: e.target.value })} />
                              <input className="bg-slate-900 border border-slate-700 rounded p-2 text-white" placeholder="Descripción" value={editValues.descripcion} onChange={e => setEditValues({ ...editValues, descripcion: e.target.value })} />
                            </div>
                          ) : (
                            <div>
                              <div className="text-white font-medium flex items-center gap-2">
                                <span>{item.nombre}</span>
                                {item.active === 0 && <span className="px-2 py-0.5 text-xs rounded bg-slate-700 border border-slate-600 text-gray-300">Inactivo</span>}
                              </div>
                              {item.descripcion && <div className="text-gray-400 text-sm">{item.descripcion}</div>}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-gray-300">
                        {editingId === item.id ? (
                          <div className="flex gap-2">
                            <input type="number" className="w-24 bg-slate-900 border border-slate-700 rounded p-1 text-white" value={editValues.precioMinimo} onChange={e => setEditValues({ ...editValues, precioMinimo: e.target.value })} />
                            <input type="number" className="w-24 bg-slate-900 border border-slate-700 rounded p-1 text-white" value={editValues.precioMaximo} onChange={e => setEditValues({ ...editValues, precioMaximo: e.target.value })} />
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            <span className="text-sm text-gray-400">Min: ${item.precioMinimo.toLocaleString()}</span>
                            <span className="text-sm text-gray-400">Max: ${item.precioMaximo.toLocaleString()}</span>
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <span className="text-white font-semibold text-lg">{item.stockActual}</span>
                      </td>
                      <td className="p-4 text-gray-300">
                        {editingId === item.id ? (
                          <input type="number" className="w-24 bg-slate-900 border border-slate-700 rounded p-1 text-white" value={editValues.stockMinimo} onChange={e => setEditValues({ ...editValues, stockMinimo: e.target.value })} />
                        ) : (
                          item.stockMinimo
                        )}
                      </td>
                      <td className="p-4">
                        {status === "critical" && (
                          <div className="flex items-center gap-2 bg-red-500/20 border border-red-500 rounded-lg px-3 py-1 w-fit">
                            <AlertTriangle className="w-4 h-4 text-red-400" />
                            <span className="text-red-400 font-semibold text-sm">Crítico</span>
                          </div>
                        )}
                        {status === "warning" && (
                          <div className="flex items-center gap-2 bg-yellow-500/20 border border-yellow-500 rounded-lg px-3 py-1 w-fit">
                            <TrendingDown className="w-4 h-4 text-yellow-400" />
                            <span className="text-yellow-400 font-semibold text-sm">Bajo</span>
                          </div>
                        )}
                        {status === "good" && (
                          <div className="flex items-center gap-2 bg-green-500/20 border border-green-500 rounded-lg px-3 py-1 w-fit">
                            <TrendingUp className="w-4 h-4 text-green-400" />
                            <span className="text-green-400 font-semibold text-sm">Óptimo</span>
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {editingId === item.id ? (
                            <>
                              <button className="px-2 py-1 bg-green-600 text-white rounded flex items-center gap-1" onClick={() => saveEdit(item.id)}><Save className="w-4 h-4" /> Guardar</button>
                              <button className="px-2 py-1 bg-slate-700 text-white rounded flex items-center gap-1" onClick={cancelEdit}><X className="w-4 h-4" /> Cancelar</button>
                            </>
                          ) : (
                            <>
                            <>
                              {item.active === 0 ? (
                                <>
                                  <button className="px-2 py-1 border border-green-500 text-green-400 rounded flex items-center gap-1 hover:bg-green-500/10 transition-colors" onClick={() => reactivar(item.id)}>
                                    <RefreshCw className="w-4 h-4" /> Reactivar
                                  </button>
                                  <button className="px-2 py-1 border border-red-500 text-red-400 rounded flex items-center gap-1 hover:bg-red-500/10 transition-colors" onClick={() => promptEliminarDefinitivamente(item.id)}>
                                    <Trash2 className="w-4 h-4" /> Eliminar Definitivamente
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button className="px-2 py-1 border border-cyan-500 text-cyan-400 rounded" onClick={() => beginEdit(item)}><Edit2 className="w-4 h-4" /> Editar</button>
                                  <button className="px-2 py-1 border border-purple-500 text-purple-400 rounded" onClick={() => openAdjust(item)}>Ajustar</button>
                                  <button className="px-2 py-1 border border-yellow-500 text-yellow-400 rounded" onClick={() => openMovs(item)}>Movimientos</button>
                                  <button className="px-2 py-1 border border-red-500 text-red-400 rounded" onClick={() => promptDesactivar(item.id)}><Trash2 className="w-4 h-4" /> Desactivar</button>
                                </>
                              )}
                            </>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={showDeleteConfirm} onClose={cancelDesactivar} title="Desactivar producto">
        <div className="space-y-4">
          <div className="text-gray-300">El producto se ocultará de los listados, pero no se eliminará.</div>
          <div className="flex justify-end gap-3">
            <button className="px-3 py-2 text-slate-400" onClick={cancelDesactivar}>Cancelar</button>
            <button className="px-3 py-2 bg-red-600 text-white rounded" onClick={confirmDesactivar}>Desactivar</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showPermanentDeleteConfirm} onClose={cancelEliminarDefinitivamente} title="Eliminar producto definitivamente">
        <div className="space-y-4">
          <div className="text-gray-300">¿Estás seguro de que deseas eliminar este producto permanentemente? Esta acción no se puede deshacer.</div>
          <div className="flex justify-end gap-3">
            <button className="px-3 py-2 text-slate-400" onClick={cancelEliminarDefinitivamente}>Cancelar</button>
            <button className="px-3 py-2 bg-red-600 text-white rounded" onClick={confirmEliminarDefinitivamente}>Eliminar Definitivamente</button>
          </div>
        </div>
      </Modal>

      <div className="flex items-center justify-between mt-4">
        <div className="text-gray-400">Página {page} de {Math.max(1, Math.ceil(total / limit))}</div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1 border border-slate-600 text-gray-300 rounded disabled:opacity-50" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}><ChevronLeft className="w-4 h-4" /></button>
          <button className="px-3 py-1 border border-slate-600 text-gray-300 rounded disabled:opacity-50" disabled={page >= Math.max(1, Math.ceil(total / limit))} onClick={() => setPage(p => p + 1)}><ChevronRight className="w-4 h-4" /></button>
          <select className="ml-2 bg-slate-800 border border-slate-700 rounded text-white p-1" value={limit} onChange={e => { setPage(1); setLimit(Number(e.target.value)) }}>
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
          </select>
        </div>
      </div>

      <Modal isOpen={showAdjust} onClose={() => setShowAdjust(false)} title="Ajustar Stock">
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Cantidad</label>
              <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" value={adjustData.diff} onChange={e => setAdjustData({ ...adjustData, diff: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Motivo</label>
              <input className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" value={adjustData.motivo} onChange={e => setAdjustData({ ...adjustData, motivo: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Referencia</label>
              <input className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" value={adjustData.referencia} onChange={e => setAdjustData({ ...adjustData, referencia: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="px-4 py-2 bg-slate-700 text-white rounded" onClick={() => setShowAdjust(false)}>Cancelar</button>
            <button className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-purple-600 text-white rounded" onClick={confirmarAjuste}>Confirmar</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showMovs} onClose={() => setShowMovs(false)} title="Historial de Movimientos">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <select className="bg-slate-800 border border-slate-700 rounded text-white p-1" value={movFilterType} onChange={e => setMovFilterType(e.target.value)}>
                <option value="">Todos</option>
                <option value="entrada">Entrada</option>
                <option value="salida">Salida</option>
              </select>
              <input className="bg-slate-800 border border-slate-700 rounded text-white p-1" placeholder="Filtrar por motivo/ref" value={movFilterText} onChange={e => setMovFilterText(e.target.value)} />
              <button className="px-2 py-1 border border-slate-600 text-gray-300 rounded" onClick={() => { setMovFilterType(""); setMovFilterText("") }}>Limpiar</button>
            </div>
            <button className="px-3 py-1 border border-green-500 text-green-400 rounded" onClick={async () => {
              if (!selectedProduct) return
              try {
                const data = await getProductoMovimientos(token, selectedProduct.id, { page: 1, limit: 1000 })
                const rows = (data.items || []).filter(m => {
                  const typeOk = movFilterType ? m.type === movFilterType : true
                  const t = movFilterText.toLowerCase()
                  const textOk = movFilterText ? ((m.reason || "").toLowerCase().includes(t) || (m.ref || "").toLowerCase().includes(t)) : true
                  return typeOk && textOk
                }).map(m => [
                  new Date(m.date).toISOString(),
                  m.type,
                  m.diff,
                  m.reason || "",
                  m.ref || "",
                  m.userName || m.userId || ""
                ])
                const csv = ["fecha,type,diff,motivo,referencia,usuario", ...rows.map(r => r.join(","))].join("\n")
                const blob = new Blob([csv], { type: "text/csv" })
                const url = URL.createObjectURL(blob)
                const a = document.createElement("a")
                a.href = url
                a.download = `movimientos_${selectedProduct.nombre}_${new Date().toISOString().split('T')[0]}.csv`
                a.click()
              } catch {
                addToast('Error al exportar', 'error')
              }
            }}>Exportar CSV</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-300">
                  <th className="p-2 text-left">Fecha</th>
                  <th className="p-2 text-left">Tipo</th>
                  <th className="p-2 text-left">Cantidad</th>
                  <th className="p-2 text-left">Motivo</th>
                  <th className="p-2 text-left">Referencia</th>
                  <th className="p-2 text-left">Usuario</th>
                </tr>
              </thead>
              <tbody>
                {movsFiltered.length === 0 ? (
                  <tr><td className="p-3 text-gray-400" colSpan="6">Sin movimientos</td></tr>
                ) : movsFiltered.map(m => (
                  <tr key={m.id} className="border-t border-slate-700">
                    <td className="p-2 text-gray-300">{new Date(m.date).toLocaleString()}</td>
                    <td className="p-2 text-gray-300">{m.type}</td>
                    <td className="p-2 text-gray-300">{m.diff}</td>
                    <td className="p-2 text-gray-300">{m.reason || ''}</td>
                    <td className="p-2 text-gray-300">{m.ref || ''}</td>
                    <td className="p-2 text-gray-300">{m.userName || m.userId || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between mt-2">
            <div className="text-gray-400">Página {movPage} de {Math.max(1, Math.ceil(movTotal / movLimit))}</div>
            <div className="flex items-center gap-2">
              <button className="px-3 py-1 border border-slate-600 text-gray-300 rounded disabled:opacity-50" disabled={movPage <= 1} onClick={async () => { const np = movPage - 1; setMovPage(np); await loadMovs(selectedProduct.id, np, movLimit) }}><ChevronLeft className="w-4 h-4" /></button>
              <button className="px-3 py-1 border border-slate-600 text-gray-300 rounded disabled:opacity-50" disabled={movPage >= Math.max(1, Math.ceil(movTotal / movLimit))} onClick={async () => { const np = movPage + 1; setMovPage(np); await loadMovs(selectedProduct.id, np, movLimit) }}><ChevronRight className="w-4 h-4" /></button>
              <select className="ml-2 bg-slate-800 border border-slate-700 rounded text-white p-1" value={movLimit} onChange={async e => { const nl = Number(e.target.value); setMovLimit(nl); setMovPage(1); await loadMovs(selectedProduct.id, 1, nl) }}>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
