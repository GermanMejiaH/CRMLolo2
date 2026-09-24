import fs from "fs"
import path from "path"
import config from "../config.js"

const logsDir = path.join(config.storageRoot || config.storageDir || path.join(process.cwd(), "storage"), "logs")

try {
  fs.mkdirSync(logsDir, { recursive: true })
} catch {}

const activityLogPath = path.join(logsDir, "activity.log")
const errorLogPath = path.join(logsDir, "error.log")

function formatTimestamp() {
  return new Date().toISOString()
}

export function logActivity(action, details = {}) {
  const time = formatTimestamp()
  const payload = typeof details === "object" ? JSON.stringify(details) : String(details)
  const line = `[${time}] [ACTIVITY] [${action}] ${payload}\n`

  try {
    fs.appendFileSync(activityLogPath, line, "utf8")
  } catch (err) {
    console.error("Error al escribir en activity.log:", err.message)
  }
}

export function logError(action, error) {
  const time = formatTimestamp()
  const errMsg = error?.stack || error?.message || String(error)
  const line = `[${time}] [ERROR] [${action}] ${errMsg}\n`

  try {
    fs.appendFileSync(errorLogPath, line, "utf8")
  } catch (err) {
    console.error("Error al escribir en error.log:", err.message)
  }
}
