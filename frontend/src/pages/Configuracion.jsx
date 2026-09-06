import React, { useEffect, useState } from "react"
import { Settings, RefreshCw, CreditCard, CheckCircle2, Search } from "lucide-react"
import { useToast } from "../components/ToastContext"
import { getOptions } from "../api/client"

export default function Configuracion({ token }) {
  const { addToast } = useToast()
  const [options, setOptions] = useState({ payments: [], orderStates: [] })
  const [searchTerm, setSearchTerm] = useState("")

  async function load() {
    if (!token) return
    try {
      const j = await getOptions(token)
      setOptions(j)
    } catch (error) {
      addToast("Error al cargar configuración", "error")
    }
  }

  useEffect(() => {
    load()
  }, [token])

  const filteredPayments = (options.payments || []).filter((p) => p.toLowerCase().includes(searchTerm.toLowerCase()))
  const filteredStates = (options.orderStates || []).filter((s) => s.toLowerCase().includes(searchTerm.toLowerCase()))

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Settings className="w-8 h-8 text-cyan-400" />
            <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
              Configuración
            </h1>
          </div>
          <button
            className="flex items-center gap-2 bg-slate-800/50 border border-cyan-500/30 rounded-lg px-4 py-2 text-gray-300"
            onClick={load}
          >
            <RefreshCw className="w-5 h-5 text-cyan-400" />
            Actualizar
          </button>
        </div>
        <p className="text-gray-400 ml-11">Preferencias del sistema</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-800/50 backdrop-blur-sm border border-cyan-500/30 rounded-lg p-4 shadow-lg shadow-cyan-500/20">
          <p className="text-gray-400 text-sm">Métodos de pago</p>
          <p className="text-3xl font-bold text-cyan-400">{options.payments.length}</p>
        </div>
        <div className="bg-slate-800/50 backdrop-blur-sm border border-cyan-500/30 rounded-lg p-4 shadow-lg shadow-cyan-500/20">
          <p className="text-gray-400 text-sm">Estados de pedido</p>
          <p className="text-3xl font-bold text-cyan-400">{options.orderStates.length}</p>
        </div>
        <div className="bg-slate-800/50 backdrop-blur-sm border border-cyan-500/30 rounded-lg p-4 shadow-lg shadow-cyan-500/20">
          <p className="text-gray-400 text-sm">Búsqueda</p>
          <div className="relative mt-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Filtrar por nombre"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800/50 border border-cyan-500/30 rounded-lg pl-10 pr-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 focus:shadow-lg focus:shadow-cyan-500/30 transition-all"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-slate-800/50 backdrop-blur-sm border border-cyan-500/30 rounded-lg overflow-hidden shadow-xl shadow-cyan-500/20">
          <div className="flex items-center gap-2 p-4 border-b border-cyan-500/30 bg-slate-900/50">
            <CreditCard className="w-5 h-5 text-cyan-400" />
            <h2 className="text-cyan-400 font-semibold">Métodos de pago</h2>
          </div>
          <div className="p-4 flex flex-wrap gap-2">
            {filteredPayments.length === 0 ? (
              <span className="text-gray-400">Sin resultados</span>
            ) : (
              filteredPayments.map((p) => (
                <span
                  key={p}
                  className="px-3 py-1 rounded-full border border-cyan-500/40 text-cyan-300 bg-slate-900/40"
                >
                  {p}
                </span>
              ))
            )}
          </div>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm border border-cyan-500/30 rounded-lg overflow-hidden shadow-xl shadow-cyan-500/20">
          <div className="flex items-center gap-2 p-4 border-b border-cyan-500/30 bg-slate-900/50">
            <CheckCircle2 className="w-5 h-5 text-cyan-400" />
            <h2 className="text-cyan-400 font-semibold">Estados de pedido</h2>
          </div>
          <div className="p-4 flex flex-wrap gap-2">
            {filteredStates.length === 0 ? (
              <span className="text-gray-400">Sin resultados</span>
            ) : (
              filteredStates.map((s) => (
                <span
                  key={s}
                  className="px-3 py-1 rounded-full border border-purple-500/40 text-purple-300 bg-slate-900/40"
                >
                  {s}
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      <CompanyConfigCard addToast={addToast} />
    </div>
  )
}

function CompanyConfigCard({ addToast }) {
  const [info, setInfo] = useState({
    name: "CRM LOLO",
    tagline: "Soluciones Industriales & Módulos",
    document: "NIT 901.234.567-8",
    address: "Calle 45 #23-12, Medellín, Colombia",
    phone: "+57 (300) 123-4567",
    email: "contacto@crmlolo.com",
    website: "www.crmlolo.com"
  })

  useEffect(() => {
    try {
      const saved = localStorage.getItem("crm_company_info")
      if (saved) setInfo(JSON.parse(saved))
    } catch {}
  }, [])

  function handleSave(e) {
    e.preventDefault()
    try {
      localStorage.setItem("crm_company_info", JSON.stringify(info))
      addToast("Datos corporativos guardados correctamente", "success")
    } catch {
      addToast("Error al guardar datos corporativos", "error")
    }
  }

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-cyan-500/30 rounded-lg overflow-hidden shadow-xl shadow-cyan-500/20">
      <div className="flex items-center gap-2 p-4 border-b border-cyan-500/30 bg-slate-900/50">
        <Settings className="w-5 h-5 text-cyan-400" />
        <h2 className="text-cyan-400 font-semibold">Datos Corporativos para Proformas PDF</h2>
      </div>
      <form onSubmit={handleSave} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-gray-300 text-sm mb-1">Nombre de la Empresa</label>
          <input
            type="text"
            value={info.name}
            onChange={(e) => setInfo({ ...info, name: e.target.value })}
            className="w-full bg-slate-900/60 border border-slate-700 rounded p-2 text-white text-sm"
          />
        </div>
        <div>
          <label className="block text-gray-300 text-sm mb-1">Eslogan / Subtítulo</label>
          <input
            type="text"
            value={info.tagline}
            onChange={(e) => setInfo({ ...info, tagline: e.target.value })}
            className="w-full bg-slate-900/60 border border-slate-700 rounded p-2 text-white text-sm"
          />
        </div>
        <div>
          <label className="block text-gray-300 text-sm mb-1">Documento / NIT</label>
          <input
            type="text"
            value={info.document}
            onChange={(e) => setInfo({ ...info, document: e.target.value })}
            className="w-full bg-slate-900/60 border border-slate-700 rounded p-2 text-white text-sm"
          />
        </div>
        <div>
          <label className="block text-gray-300 text-sm mb-1">Teléfono de Contacto</label>
          <input
            type="text"
            value={info.phone}
            onChange={(e) => setInfo({ ...info, phone: e.target.value })}
            className="w-full bg-slate-900/60 border border-slate-700 rounded p-2 text-white text-sm"
          />
        </div>
        <div>
          <label className="block text-gray-300 text-sm mb-1">Correo Electrónico</label>
          <input
            type="text"
            value={info.email}
            onChange={(e) => setInfo({ ...info, email: e.target.value })}
            className="w-full bg-slate-900/60 border border-slate-700 rounded p-2 text-white text-sm"
          />
        </div>
        <div>
          <label className="block text-gray-300 text-sm mb-1">Sitio Web</label>
          <input
            type="text"
            value={info.website}
            onChange={(e) => setInfo({ ...info, website: e.target.value })}
            className="w-full bg-slate-900/60 border border-slate-700 rounded p-2 text-white text-sm"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-gray-300 text-sm mb-1">Dirección Física</label>
          <input
            type="text"
            value={info.address}
            onChange={(e) => setInfo({ ...info, address: e.target.value })}
            className="w-full bg-slate-900/60 border border-slate-700 rounded p-2 text-white text-sm"
          />
        </div>
        <div className="md:col-span-2 flex justify-end mt-2">
          <button
            type="submit"
            className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-semibold px-6 py-2 rounded-lg shadow-lg shadow-cyan-500/30 transition-all"
          >
            Guardar Datos Corporativos
          </button>
        </div>
      </form>
    </div>
  )
}
