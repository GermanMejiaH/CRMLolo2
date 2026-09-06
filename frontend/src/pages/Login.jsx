import React, { useState } from "react"
import { LockKeyhole, Loader2 } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { login as apiLogin } from "../api/client"

export default function Login({ onToken }) {
  const [email, setEmail] = useState("admin@lolo")
  const [password, setPassword] = useState("Admin123")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const navigate = useNavigate()

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const j = await apiLogin(email, password)
      onToken(j.token)
      navigate("/")
    } catch (err) {
      setError(String(err.message || err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6 grid place-items-center">
      <form
        className="w-full max-w-sm bg-slate-900/60 backdrop-blur-sm border border-cyan-500/30 rounded-xl p-6 grid gap-4 shadow-xl shadow-cyan-500/20"
        onSubmit={submit}
      >
        <div className="flex items-center gap-3 justify-center mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-purple-500 rounded-lg flex items-center justify-center">
            <LockKeyhole className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
            Acceso
          </h1>
        </div>

        <div className="grid gap-2">
          <label className="text-sm text-gray-400">Email</label>
          <input
            className="bg-slate-800/50 border border-cyan-500/30 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
          />
        </div>
        <div className="grid gap-2">
          <label className="text-sm text-gray-400">Contraseña</label>
          <input
            className="bg-slate-800/50 border border-cyan-500/30 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
          />
        </div>
        <button
          className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 transition text-white px-4 py-2 rounded-lg font-semibold flex items-center justify-center gap-2"
          disabled={loading}
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />} Entrar
        </button>
        {error && <div className="text-red-400 text-sm text-center">{error}</div>}
      </form>
    </div>
  )
}
