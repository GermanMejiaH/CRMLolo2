import React, { useEffect, useState } from "react"
import { Users, Plus, Search, Mail, Phone, MapPin, DollarSign, Calendar, Edit, Trash2, X, Filter, Download, Save, ChevronLeft, ChevronRight, Check, RefreshCw } from "lucide-react"
import Modal from "../components/Modal"
import { useToast } from "../components/ToastContext"
import { getClientes, getClientesPaged, createCliente, updateCliente, desactivarCliente } from "../api/client"

export default function Clientes({ token }) {
  const { addToast } = useToast()
  const [clientes, setClientes] = useState([])
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedTerm, setDebouncedTerm] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [priceEditingId, setPriceEditingId] = useState(null)
  const [priceEditingValue, setPriceEditingValue] = useState("")
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(12)
  const [total, setTotal] = useState(0)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    minPrecio: "",
    maxPrecio: ""
  })
  const [includeInactive, setIncludeInactive] = useState(false)
  
  const [formData, setFormData] = useState({
    nombre: "",
    contacto: "",
    telefono: "",
    email: "",
    direccion: "",
    precioPersonalizado: "",
    notas: ""
  })

  useEffect(() => {
    loadClientes()
  }, [token, page, limit, debouncedTerm, filters.minPrecio, filters.maxPrecio, includeInactive])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedTerm(searchTerm), 300)
    return () => clearTimeout(t)
  }, [searchTerm])

  async function loadClientes() {
    if (!token) return
    try {
      const params = { q: debouncedTerm, page, limit, minPrecio: filters.minPrecio || undefined, maxPrecio: filters.maxPrecio || undefined, includeInactive }
      const data = await getClientesPaged(token, params)
      const arr = Array.isArray(data) ? data : (data.items || [])
      const normalized = arr.map(c => ({
        ...c,
        fechaRegistro: new Date(c.createdAt).toISOString().split('T')[0],
        activo: !!c.active
      }))
      setClientes(normalized)
      setTotal(Array.isArray(data) ? normalized.length : Number(data.total || normalized.length))
    } catch {
      addToast("Error al cargar clientes", "error")
    }
  }

  async function handleSubmit() {
    if (!formData.nombre || !formData.email) {
      addToast("Nombre y email son obligatorios", "error")
      return
    }

    try {
      const payload = {
        nombre: formData.nombre,
        contacto: formData.contacto || null,
        telefono: formData.telefono || null,
        email: formData.email || null,
        direccion: formData.direccion || null,
        precioPersonalizado: formData.precioPersonalizado === "" ? null : Number(formData.precioPersonalizado),
        notas: formData.notas || null,
      }
      if (editingId) {
        await updateCliente(token, editingId, payload)
        addToast("Cliente actualizado correctamente", "success")
      } else {
        await createCliente(token, payload)
        addToast("Cliente creado exitosamente", "success")
      }
      resetForm()
      loadClientes()
    } catch (error) {
      addToast("Error al guardar cliente", "error")
    }
  }

  function resetForm() {
    setFormData({
      nombre: "",
      contacto: "",
      telefono: "",
      email: "",
      direccion: "",
      precioPersonalizado: "",
      notas: ""
    })
    setShowForm(false)
    setEditingId(null)
  }

  function handleEdit(cliente) {
    setFormData({
      nombre: cliente.nombre,
      contacto: cliente.contacto,
      telefono: cliente.telefono,
      email: cliente.email,
      direccion: cliente.direccion,
      precioPersonalizado: cliente.precioPersonalizado,
      notas: cliente.notas || ""
    })
    setEditingId(cliente.id)
    setShowForm(true)
  }

  async function handleDelete(id) {
    if (!confirm("¿Estás seguro de desactivar este cliente?")) return
    try {
      await desactivarCliente(token, id)
      addToast("Cliente desactivado", "success")
      loadClientes()
    } catch (e) {
      addToast(e.message || "Error al desactivar cliente", "error")
    }
  }

  async function reactivar(id) {
    if (!confirm("¿Estás seguro de reactivar este cliente?")) return
    try {
      await updateCliente(token, id, { active: true })
      addToast("Cliente reactivado", "success")
      loadClientes()
    } catch (e) {
      addToast(e.message || "Error al reactivar cliente", "error")
    }
  }

  function exportToCSV() {
    const headers = ["ID", "Nombre", "Contacto", "Teléfono", "Email", "Dirección", "Precio", "Fecha Registro"]
    const rows = filteredClientes.map(c => [
      c.id,
      c.nombre,
      c.contacto,
      c.telefono,
      c.email,
      c.direccion,
      c.precioPersonalizado,
      c.fechaRegistro
    ])
    
    const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n")
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `clientes_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const filteredClientes = clientes

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-CO', { 
      style: 'currency', 
      currency: 'COP',
      minimumFractionDigits: 0 
    }).format(value)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Users className="w-8 h-8 text-cyan-400" />
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
            Gestión de Clientes
          </h1>
        </div>
        <p className="text-gray-400 ml-11">Administra tu cartera de clientes y precios personalizados</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-800/50 backdrop-blur-sm border border-cyan-500/30 rounded-lg p-4 shadow-lg shadow-cyan-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total Clientes</p>
              <p className="text-3xl font-bold text-cyan-400">{clientes.filter(c => c.activo).length}</p>
            </div>
            <Users className="w-10 h-10 text-cyan-400/50" />
          </div>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm border border-green-500/30 rounded-lg p-4 shadow-lg shadow-green-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Nuevos (mes)</p>
              <p className="text-3xl font-bold text-green-400">
                {clientes.filter(c => {
                  const fecha = new Date(c.fechaRegistro)
                  const hoy = new Date()
                  return fecha.getMonth() === hoy.getMonth() && fecha.getFullYear() === hoy.getFullYear()
                }).length}
              </p>
            </div>
            <Calendar className="w-10 h-10 text-green-400/50" />
          </div>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm border border-purple-500/30 rounded-lg p-4 shadow-lg shadow-purple-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Precio Promedio</p>
              <p className="text-3xl font-bold text-purple-400">
                {formatCurrency(
                  clientes.reduce((sum, c) => sum + (c.precioPersonalizado || 0), 0) / clientes.length || 0
                )}
              </p>
            </div>
            <DollarSign className="w-10 h-10 text-purple-400/50" />
          </div>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm border border-yellow-500/30 rounded-lg p-4 shadow-lg shadow-yellow-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Con Precio Custom</p>
              <p className="text-3xl font-bold text-yellow-400">
                {clientes.filter(c => c.precioPersonalizado > 0).length}
              </p>
            </div>
            <DollarSign className="w-10 h-10 text-yellow-400/50" />
          </div>
        </div>
      </div>

      {/* Search, Filters and Actions */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, email o contacto..."
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
          onClick={() => setShowFilters(!showFilters)}
          className={`px-6 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${
            showFilters 
              ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-lg shadow-yellow-500/50' 
              : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
          }`}
        >
          <Filter className="w-5 h-5" />
          Filtros
        </button>

        <button
          onClick={exportToCSV}
          className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-green-500/50 transition-all transform hover:scale-105"
        >
          <Download className="w-5 h-5" />
          Exportar
        </button>

        <button
          onClick={() => setShowForm(true)}
          className="bg-gradient-to-r from-cyan-500 to-purple-500 text-white px-6 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-cyan-500/50 transition-all transform hover:scale-105"
        >
          <Plus className="w-5 h-5" />
          Nuevo Cliente
        </button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-slate-800/50 backdrop-blur-sm border border-yellow-500/30 rounded-lg p-6 mb-6 shadow-xl shadow-yellow-500/20">
          <h3 className="text-xl font-semibold text-yellow-400 mb-4 flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtros de Precio
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="number"
              placeholder="Precio mínimo (COP)"
              value={filters.minPrecio}
              onChange={e => setFilters({ ...filters, minPrecio: e.target.value })}
              className="bg-slate-900/50 border border-cyan-500/30 rounded-lg p-3 text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 focus:shadow-lg focus:shadow-cyan-500/30 transition-all"
            />
            <input
              type="number"
              placeholder="Precio máximo (COP)"
              value={filters.maxPrecio}
              onChange={e => setFilters({ ...filters, maxPrecio: e.target.value })}
              className="bg-slate-900/50 border border-cyan-500/30 rounded-lg p-3 text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 focus:shadow-lg focus:shadow-cyan-500/30 transition-all"
            />
          </div>
          <button
            onClick={() => setFilters({ minPrecio: "", maxPrecio: "" })}
            className="mt-4 text-gray-400 hover:text-white transition-all"
          >
            Limpiar filtros
          </button>
        </div>
      )}

      {/* Form Modal */}
      <Modal
        isOpen={showForm}
        onClose={resetForm}
        title={editingId ? "Editar Cliente" : "Nuevo Cliente"}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-gray-300 text-sm mb-1 block">Nombre / Razón Social *</label>
              <input
                required
                value={formData.nombre}
                onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                className="w-full bg-slate-900/50 border border-cyan-500/30 rounded-lg p-3 text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 focus:shadow-lg focus:shadow-cyan-500/30 transition-all"
                placeholder="Ej: Moto Repuestos SAS"
              />
            </div>

            <div>
              <label className="text-gray-300 text-sm mb-1 block">Persona de Contacto</label>
              <input
                value={formData.contacto}
                onChange={e => setFormData({ ...formData, contacto: e.target.value })}
                className="w-full bg-slate-900/50 border border-cyan-500/30 rounded-lg p-3 text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 focus:shadow-lg focus:shadow-cyan-500/30 transition-all"
                placeholder="Ej: Carlos Rodríguez"
              />
            </div>

            <div>
              <label className="text-gray-300 text-sm mb-1 block">Teléfono</label>
              <input
                value={formData.telefono}
                onChange={e => setFormData({ ...formData, telefono: e.target.value })}
                className="w-full bg-slate-900/50 border border-cyan-500/30 rounded-lg p-3 text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 focus:shadow-lg focus:shadow-cyan-500/30 transition-all"
                placeholder="+57 300 123 4567"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-gray-300 text-sm mb-1 block">Email *</label>
              <input
                required
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-slate-900/50 border border-cyan-500/30 rounded-lg p-3 text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 focus:shadow-lg focus:shadow-cyan-500/30 transition-all"
                placeholder="ejemplo@correo.com"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-gray-300 text-sm mb-1 block">Dirección</label>
              <input
                value={formData.direccion}
                onChange={e => setFormData({ ...formData, direccion: e.target.value })}
                className="w-full bg-slate-900/50 border border-cyan-500/30 rounded-lg p-3 text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 focus:shadow-lg focus:shadow-cyan-500/30 transition-all"
                placeholder="Calle 45 #23-12, Medellín"
              />
            </div>

            <div className="md:col-span-2">
            <label className="text-gray-300 text-sm mb-1 block">Precio Personalizado</label>
            <input
              type="number"
              value={formData.precioPersonalizado}
              onChange={e => setFormData({ ...formData, precioPersonalizado: e.target.value })}
              className="w-full bg-slate-900/50 border border-purple-500/30 rounded-lg p-3 text-white placeholder-gray-400 focus:outline-none focus:border-purple-400 focus:shadow-lg focus:shadow-purple-500/30 transition-all"
              placeholder="Precio"
            />
            </div>

            <div className="md:col-span-2">
              <label className="text-gray-300 text-sm mb-1 block">Notas</label>
              <textarea
                value={formData.notas}
                onChange={e => setFormData({ ...formData, notas: e.target.value })}
                rows={3}
                className="w-full bg-slate-900/50 border border-cyan-500/30 rounded-lg p-3 text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 focus:shadow-lg focus:shadow-cyan-500/30 transition-all"
                placeholder="Información adicional sobre el cliente..."
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSubmit}
              className="flex-1 bg-gradient-to-r from-cyan-500 to-purple-500 text-white py-3 rounded-lg font-semibold hover:shadow-lg hover:shadow-cyan-500/50 transition-all transform hover:scale-105"
            >
              {editingId ? "Actualizar Cliente" : "Crear Cliente"}
            </button>
            <button
              onClick={resetForm}
              className="px-6 bg-slate-700 text-gray-300 py-3 rounded-lg font-semibold hover:bg-slate-600 transition-all"
            >
              Cancelar
            </button>
          </div>
        </div>
      </Modal>

      {/* Clients Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClientes.length === 0 ? (
          <div className="col-span-full bg-slate-800/50 backdrop-blur-sm border border-cyan-500/30 rounded-lg p-12 text-center">
            <Users className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">
              {searchTerm || filters.minPrecio || filters.maxPrecio 
                ? "No se encontraron clientes con esos criterios" 
                : "No hay clientes registrados"}
            </p>
          </div>
        ) : (
          filteredClientes.map(cliente => (
            <div
              key={cliente.id}
              className="bg-slate-800/50 backdrop-blur-sm border border-cyan-500/30 rounded-lg p-6 shadow-xl shadow-cyan-500/20 hover:shadow-cyan-500/40 hover:border-cyan-400/50 transition-all hover:-translate-y-1"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-purple-500 rounded-full flex items-center justify-center">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-lg">{cliente.nombre}</h3>
                    <p className="text-gray-400 text-sm">{cliente.contacto}</p>
                  </div>
                </div>
                {!cliente.activo && (
                  <span className="bg-red-500/20 text-red-400 text-xs px-2 py-1 rounded-full border border-red-500/50">
                    Inactivo
                  </span>
                )}
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-gray-300 text-sm">
                  <Mail className="w-4 h-4 text-cyan-400" />
                  <span>{cliente.email}</span>
                </div>
                {cliente.telefono && (
                  <div className="flex items-center gap-2 text-gray-300 text-sm">
                    <Phone className="w-4 h-4 text-green-400" />
                    <span>{cliente.telefono}</span>
                  </div>
                )}
                {cliente.direccion && (
                  <div className="flex items-center gap-2 text-gray-300 text-sm">
                    <MapPin className="w-4 h-4 text-purple-400" />
                    <span>{cliente.direccion}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-gray-300 text-sm">
                  <Calendar className="w-4 h-4 text-yellow-400" />
                  <span>Desde {new Date(cliente.fechaRegistro).toLocaleDateString('es-CO')}</span>
                </div>
              </div>

              {cliente.precioPersonalizado > 0 && (
                <div className="bg-purple-500/20 border border-purple-500 rounded-lg p-3 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-purple-300 text-sm font-semibold">Precio Personalizado</span>
                    {priceEditingId === cliente.id ? (
                      <div className="flex items-center gap-2">
                        <input type="number" className="w-28 bg-slate-900 border border-slate-700 rounded p-1 text-white" value={priceEditingValue} onChange={e => setPriceEditingValue(e.target.value)} />
                        <button className="px-2 py-1 bg-green-600 text-white rounded flex items-center gap-1" onClick={async () => {
                          const v = parseFloat(priceEditingValue)
                          if (isNaN(v)) { addToast("Precio inválido", "warning"); return }
                          try { await updateCliente(token, cliente.id, { precioPersonalizado: v }); addToast("Precio actualizado", "success"); setPriceEditingId(null); loadClientes() } catch { addToast("Error al actualizar", "error") }
                        }}><Save className="w-4 h-4" /> Guardar</button>
                        <button className="px-2 py-1 bg-slate-700 text-white rounded flex items-center gap-1" onClick={() => setPriceEditingId(null)}><X className="w-4 h-4" /> Cancelar</button>
                      </div>
                    ) : (
                      <button className="text-purple-400 text-lg font-bold flex items-center gap-2" onClick={() => { setPriceEditingId(cliente.id); setPriceEditingValue(String(cliente.precioPersonalizado || "")) }}>
                        {formatCurrency(cliente.precioPersonalizado)}
                        <Edit className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {cliente.notas && (
                <div className="bg-slate-900/50 rounded-lg p-3 mb-4">
                  <p className="text-gray-400 text-sm italic">{cliente.notas}</p>
                </div>
              )}

              <div className="flex gap-2">
                {cliente.activo ? (
                  <>
                    <button
                      onClick={() => handleEdit(cliente)}
                      className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white py-2 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all"
                    >
                      <Edit className="w-4 h-4" />
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(cliente.id)}
                      className="flex-1 bg-red-600 hover:bg-red-500 text-white py-2 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                      Eliminar
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => reactivar(cliente.id)}
                    className="flex-1 bg-green-600 hover:bg-green-500 text-white py-2 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Reactivar
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
      <div className="flex items-center justify-between mt-6">
        <div className="text-gray-400">Página {page} de {Math.max(1, Math.ceil(total / limit))}</div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1 border border-slate-600 text-gray-300 rounded disabled:opacity-50" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}><ChevronLeft className="w-4 h-4" /></button>
          <button className="px-3 py-1 border border-slate-600 text-gray-300 rounded disabled:opacity-50" disabled={page >= Math.max(1, Math.ceil(total / limit))} onClick={() => setPage(p => p + 1)}><ChevronRight className="w-4 h-4" /></button>
          <select className="ml-2 bg-slate-800 border border-slate-700 rounded text-white p-1" value={limit} onChange={e => { setPage(1); setLimit(Number(e.target.value)) }}>
            <option value={6}>6</option>
            <option value={12}>12</option>
            <option value={24}>24</option>
          </select>
        </div>
      </div>
    </div>
  )
}
