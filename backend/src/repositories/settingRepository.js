import db from "../db.js"

export function getSetting(clave, defaultValue = null) {
  const row = db.prepare("SELECT valor FROM settings WHERE clave = ?").get(String(clave))
  return row ? row.valor : defaultValue
}

export function setSetting(clave, valor) {
  db.prepare("INSERT INTO settings (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor").run(
    String(clave),
    String(valor)
  )
  return getSetting(clave)
}

export function getAllSettings() {
  const rows = db.prepare("SELECT * FROM settings").all()
  const obj = {}
  for (const r of rows) {
    obj[r.clave] = r.valor
  }
  return obj
}
