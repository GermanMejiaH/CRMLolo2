import PDFDocument from "pdfkit"

function formatCOP(num) {
  const n = Math.round(Number(num) || 0)
  return `$ ${n.toLocaleString("es-CO")}`
}

export function buildMonthlyClosureDocument(doc, data) {
  const { periodo, ventasTotales, utilidadTotal, produccion, topClientes = [], topProductos = [], companyInfo = {} } = data

  const company = {
    name: companyInfo.name || "CRM LOLO",
    tagline: companyInfo.tagline || "Soluciones Industriales & Módulos",
    document: companyInfo.document || "NIT 901.234.567-8"
  }

  const margin = 40
  const pageWidth = doc.page.width
  let y = margin

  // 1. Header
  doc.fillColor("#0EA5E9").fontSize(22).font("Helvetica-Bold").text(company.name, margin, y)
  doc.fillColor("#64748B").fontSize(9).font("Helvetica").text(company.tagline, margin, y + 26)
  doc.fillColor("#94A3B8").fontSize(8).text(company.document, margin, y + 38)

  const headerRightX = pageWidth - margin - 200
  doc.fillColor("#0F172A").fontSize(14).font("Helvetica-Bold").text("CIERRE MENSUAL", headerRightX, y, { width: 200, align: "right" })
  doc.fillColor("#64748B").fontSize(10).font("Helvetica").text(`Período: ${periodo}`, headerRightX, y + 18, { width: 200, align: "right" })

  y += 54
  doc.strokeColor("#CBD5E1").lineWidth(1).moveTo(margin, y).lineTo(pageWidth - margin, y).stroke()
  y += 20

  // 2. Resumen Ejecutivo (KPI Box)
  doc.fillColor("#0F172A").fontSize(14).font("Helvetica-Bold").text("Resumen Financiero y Operativo", margin, y)
  y += 20

  const boxWidth = (pageWidth - margin * 2 - 20) / 3
  const boxHeight = 60

  // Box 1: Ventas
  doc.roundedRect(margin, y, boxWidth, boxHeight, 6).fillAndStroke("#F0F9FF", "#BAE6FD")
  doc.fillColor("#0369A1").fontSize(9).font("Helvetica-Bold").text("VENTAS TOTALES", margin + 10, y + 10)
  doc.fillColor("#0C4A6E").fontSize(16).font("Helvetica-Bold").text(formatCOP(ventasTotales), margin + 10, y + 28)

  // Box 2: Utilidad
  doc.roundedRect(margin + boxWidth + 10, y, boxWidth, boxHeight, 6).fillAndStroke("#F0FDF4", "#BBF7D0")
  doc.fillColor("#15803D").fontSize(9).font("Helvetica-Bold").text("UTILIDAD BRUTA", margin + boxWidth + 20, y + 10)
  doc.fillColor("#14532D").fontSize(16).font("Helvetica-Bold").text(formatCOP(utilidadTotal), margin + boxWidth + 20, y + 28)

  // Box 3: Producción
  doc.roundedRect(margin + (boxWidth + 10) * 2, y, boxWidth, boxHeight, 6).fillAndStroke("#FEF3C7", "#FDE68A")
  doc.fillColor("#B45309").fontSize(9).font("Helvetica-Bold").text("PRODUCCIÓN (UNIDADES)", margin + (boxWidth + 10) * 2 + 10, y + 10)
  doc.fillColor("#78350F").fontSize(16).font("Helvetica-Bold").text(`${produccion?.unidades || 0} uds`, margin + (boxWidth + 10) * 2 + 10, y + 28)

  y += boxHeight + 30

  // 3. Top Clientes del Mes
  doc.fillColor("#0F172A").fontSize(12).font("Helvetica-Bold").text("Top Clientes Destacados", margin, y)
  y += 15

  doc.rect(margin, y, pageWidth - margin * 2, 20).fill("#F1F5F9")
  doc.fillColor("#475569").fontSize(9).font("Helvetica-Bold").text("Cliente", margin + 10, y + 5)
  doc.text("Total Comprado", pageWidth - margin - 120, y + 5, { width: 110, align: "right" })
  y += 20

  for (const c of topClientes) {
    doc.fillColor("#334155").fontSize(9).font("Helvetica").text(c.clienteNombre || `Cliente #${c.clienteId}`, margin + 10, y + 4)
    doc.text(formatCOP(c.totalVentas), pageWidth - margin - 120, y + 4, { width: 110, align: "right" })
    y += 18
    doc.strokeColor("#F1F5F9").lineWidth(0.5).moveTo(margin, y).lineTo(pageWidth - margin, y).stroke()
  }

  y += 25

  // 4. Top Productos del Mes
  doc.fillColor("#0F172A").fontSize(12).font("Helvetica-Bold").text("Productos Más Vendidos", margin, y)
  y += 15

  doc.rect(margin, y, pageWidth - margin * 2, 20).fill("#F1F5F9")
  doc.fillColor("#475569").fontSize(9).font("Helvetica-Bold").text("Producto", margin + 10, y + 5)
  doc.text("Unidades", pageWidth - margin - 220, y + 5, { width: 100, align: "right" })
  doc.text("Ventas Totales", pageWidth - margin - 120, y + 5, { width: 110, align: "right" })
  y += 20

  for (const p of topProductos) {
    doc.fillColor("#334155").fontSize(9).font("Helvetica").text(p.productoNombre || `Producto #${p.productoId}`, margin + 10, y + 4)
    doc.text(`${p.unidadesVendidas || 0} uds`, pageWidth - margin - 220, y + 4, { width: 100, align: "right" })
    doc.text(formatCOP(p.totalVentas), pageWidth - margin - 120, y + 4, { width: 110, align: "right" })
    y += 18
    doc.strokeColor("#F1F5F9").lineWidth(0.5).moveTo(margin, y).lineTo(pageWidth - margin, y).stroke()
  }

  // Footer
  doc.fillColor("#94A3B8").fontSize(8).font("Helvetica").text("Documento generado automáticamente por CRM LOLO - Inteligencia de Negocio", margin, doc.page.height - 30, { align: "center" })
}
