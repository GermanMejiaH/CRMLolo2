import PDFDocument from "pdfkit"

/**
 * Normaliza y formatea un número como Pesos Colombianos (COP)
 */
function formatCOP(num) {
  const n = Math.round(Number(num) || 0)
  return `$ ${n.toLocaleString("es-CO")}`
}

/**
 * Genera el documento PDF de la Proforma con maquetación corporativa profesional
 * @param {PDFDocument} doc - Instancia de PDFDocument
 * @param {Object} data - Datos del pedido, cliente, producto e información corporativa
 */
export function buildProformaDocument(doc, data) {
  const { pedido, client, product, companyInfo = {}, ts = Date.now() } = data

  const company = {
    name: companyInfo.name || "CRM LOLO",
    tagline: companyInfo.tagline || "Soluciones Industriales & Módulos",
    document: companyInfo.document || "NIT 901.234.567-8",
    address: companyInfo.address || "Calle 45 #23-12, Medellín, Colombia",
    phone: companyInfo.phone || "+57 (300) 123-4567",
    email: companyInfo.email || "contacto@crmlolo.com",
    website: companyInfo.website || "www.crmlolo.com"
  }

  const issueDate = new Date(ts)
  const expiryDate = new Date(ts + 30 * 24 * 60 * 60 * 1000)

  const margin = 40
  const pageWidth = doc.page.width // 612pt
  const contentWidth = pageWidth - margin * 2 // 532pt

  let y = margin

  // ==========================================
  // 1. CABECERA CORPORATIVA (HEADER)
  // ==========================================

  // Logotipo / Título Empresa (Izquierda)
  doc.fillColor("#0EA5E9").fontSize(22).font("Helvetica-Bold").text(company.name, margin, y)

  doc
    .fillColor("#64748B")
    .fontSize(9)
    .font("Helvetica")
    .text(company.tagline, margin, y + 26)

  doc
    .fillColor("#94A3B8")
    .fontSize(8)
    .text(company.document, margin, y + 38)

  // Datos de Contacto de la Empresa (Derecha)
  const headerRightX = pageWidth - margin - 220
  doc
    .fillColor("#334155")
    .fontSize(8)
    .font("Helvetica")
    .text(company.address, headerRightX, y, { width: 220, align: "right" })
    .text(`Tel: ${company.phone}`, headerRightX, y + 12, { width: 220, align: "right" })
    .text(`Email: ${company.email}`, headerRightX, y + 24, { width: 220, align: "right" })
    .text(`Web: ${company.website}`, headerRightX, y + 36, { width: 220, align: "right" })

  y += 54

  // Línea Divisora Superior
  doc
    .strokeColor("#CBD5E1")
    .lineWidth(1)
    .moveTo(margin, y)
    .lineTo(pageWidth - margin, y)
    .stroke()

  y += 15

  // ==========================================
  // 2. TÍTULO Y CUADRO DE METADATOS
  // ==========================================

  // Título Documento
  doc.fillColor("#0F172A").fontSize(20).font("Helvetica-Bold").text("PROFORMA DE VENTA", margin, y)
  doc
    .fillColor("#64748B")
    .fontSize(9)
    .font("Helvetica")
    .text("Cotización Comercial No Vinculante", margin, y + 24)

  // Tarjeta de Metadatos (Derecha)
  const metaBoxWidth = 200
  const metaBoxX = pageWidth - margin - metaBoxWidth
  const metaBoxY = y

  doc.roundedRect(metaBoxX, metaBoxY, metaBoxWidth, 54, 4).fillAndStroke("#F8FAFC", "#E2E8F0")

  const pad = 8
  doc.fillColor("#475569").fontSize(8).font("Helvetica")

  doc.font("Helvetica-Bold").text("N° Proforma:", metaBoxX + pad, metaBoxY + pad)
  doc
    .font("Helvetica")
    .text(`PRF-${String(pedido.id).padStart(4, "0")}`, metaBoxX + 85, metaBoxY + pad, { align: "right", width: 105 })

  doc.font("Helvetica-Bold").text("Fecha Emisión:", metaBoxX + pad, metaBoxY + pad + 12)
  doc
    .font("Helvetica")
    .text(issueDate.toLocaleDateString("es-CO"), metaBoxX + 85, metaBoxY + pad + 12, { align: "right", width: 105 })

  doc.font("Helvetica-Bold").text("Vencimiento:", metaBoxX + pad, metaBoxY + pad + 24)
  doc
    .font("Helvetica")
    .text(expiryDate.toLocaleDateString("es-CO"), metaBoxX + 85, metaBoxY + pad + 24, { align: "right", width: 105 })

  doc.font("Helvetica-Bold").text("Estado:", metaBoxX + pad, metaBoxY + pad + 36)
  doc
    .font("Helvetica-Bold")
    .fillColor(pedido.estado === "Completado" ? "#16A34A" : "#D97706")
    .text(pedido.estado || "Pendiente", metaBoxX + 85, metaBoxY + pad + 36, { align: "right", width: 105 })

  y += 65

  // ==========================================
  // 3. TARJETA FACTURADO A (CLIENTE)
  // ==========================================

  const clientBoxY = y
  const clientBoxHeight = 65

  doc.roundedRect(margin, clientBoxY, contentWidth, clientBoxHeight, 4).fillAndStroke("#F8FAFC", "#E2E8F0")

  doc
    .fillColor("#0EA5E9")
    .fontSize(8)
    .font("Helvetica-Bold")
    .text("FACTURADO A / CLIENTE", margin + 12, clientBoxY + 8)

  const clientName = client?.nombre || "Cliente No Registrado"
  doc
    .fillColor("#0F172A")
    .fontSize(11)
    .font("Helvetica-Bold")
    .text(clientName, margin + 12, clientBoxY + 20)

  doc.fillColor("#475569").fontSize(8.5).font("Helvetica")

  const leftColX = margin + 12
  const rightColX = margin + contentWidth / 2 + 10

  doc.text(`Contacto: ${client?.contacto || "N/A"}`, leftColX, clientBoxY + 36)
  doc.text(`Teléfono: ${client?.telefono || "N/A"}`, leftColX, clientBoxY + 48)

  doc.text(`Email: ${client?.email || "N/A"}`, rightColX, clientBoxY + 36)
  doc.text(`Dirección: ${client?.direccion || "N/A"}`, rightColX, clientBoxY + 48)

  y += clientBoxHeight + 20

  // ==========================================
  // 4. TABLA DE PRODUCTOS / ITEMS
  // ==========================================

  const tableHeaderY = y
  const tableHeaderHeight = 22

  // Fondo Cabecera de Tabla
  doc.rect(margin, tableHeaderY, contentWidth, tableHeaderHeight).fill("#1E293B")

  // Columnas: x offset y anchos
  const colDescX = margin + 10
  const colDescW = 240

  const colQtyX = margin + 260
  const colQtyW = 60

  const colUnitPriceX = margin + 330
  const colUnitPriceW = 90

  const colTotalX = margin + 430
  const colTotalW = 90

  doc.fillColor("#FFFFFF").fontSize(8.5).font("Helvetica-Bold")
  doc.text("DESCRIPCIÓN / PRODUCTO", colDescX, tableHeaderY + 6, { width: colDescW })
  doc.text("CANTIDAD", colQtyX, tableHeaderY + 6, { width: colQtyW, align: "center" })
  doc.text("PRECIO UNIT.", colUnitPriceX, tableHeaderY + 6, { width: colUnitPriceW, align: "right" })
  doc.text("TOTAL", colTotalX, tableHeaderY + 6, { width: colTotalW, align: "right" })

  y += tableHeaderHeight

  // Fila de Item
  const itemRowY = y
  const itemRowHeight = 32

  // Fondo alternado ligero
  doc.rect(margin, itemRowY, contentWidth, itemRowHeight).fill("#FFFFFF")

  const prodName = product?.nombre || `Producto #${pedido.productoId}`
  const prodDesc = product?.descripcion ? product.descripcion : "Módulo o servicio estándar"

  doc
    .fillColor("#0F172A")
    .fontSize(9.5)
    .font("Helvetica-Bold")
    .text(prodName, colDescX, itemRowY + 6, { width: colDescW })
  doc
    .fillColor("#64748B")
    .fontSize(8)
    .font("Helvetica")
    .text(prodDesc, colDescX, itemRowY + 18, { width: colDescW })

  doc
    .fillColor("#334155")
    .fontSize(9)
    .font("Helvetica")
    .text(String(pedido.cantidad || 1), colQtyX, itemRowY + 10, { width: colQtyW, align: "center" })
  doc.text(formatCOP(pedido.precioUnitario), colUnitPriceX, itemRowY + 10, { width: colUnitPriceW, align: "right" })
  doc
    .fillColor("#0F172A")
    .font("Helvetica-Bold")
    .text(formatCOP(pedido.total), colTotalX, itemRowY + 10, { width: colTotalW, align: "right" })

  y += itemRowHeight

  // Borde inferior de la tabla
  doc
    .strokeColor("#E2E8F0")
    .lineWidth(1)
    .moveTo(margin, y)
    .lineTo(pageWidth - margin, y)
    .stroke()

  y += 20

  // ==========================================
  // 5. BLOQUE DE TOTALES Y CONDICIONES
  // ==========================================

  const summaryY = y

  // Izquierda: Condiciones y Pago
  doc
    .fillColor("#0F172A")
    .fontSize(9)
    .font("Helvetica-Bold")
    .text("INFORMACIÓN DE PAGO Y CONDICIONES", margin, summaryY)

  doc.fillColor("#475569").fontSize(8).font("Helvetica")
  doc.text(`• Método de Pago: ${pedido.metodoPago || "Efectivo / Transferencia"}`, margin, summaryY + 14)
  doc.text("• Validez de la Oferta: 30 días calendario a partir de la emisión.", margin, summaryY + 26)
  doc.text("• Entregas y despachos sujetos a disponibilidad de stock.", margin, summaryY + 38)
  doc.text("• Esta proforma es una cotización comercial sin valor de factura fiscal.", margin, summaryY + 50)

  // Derecha: Cuadro de Totales
  const totalsWidth = 200
  const totalsX = pageWidth - margin - totalsWidth
  let totalsY = summaryY

  doc.fillColor("#475569").fontSize(9).font("Helvetica")

  doc.text("Subtotal:", totalsX, totalsY)
  doc.text(formatCOP(pedido.total), totalsX, totalsY, { align: "right", width: totalsWidth })

  totalsY += 16
  doc.text("IVA / Impuestos (0% Exento):", totalsX, totalsY)
  doc.text("$ 0", totalsX, totalsY, { align: "right", width: totalsWidth })

  totalsY += 16
  doc.text("Descuentos / Ajustes:", totalsX, totalsY)
  doc.text("$ 0", totalsX, totalsY, { align: "right", width: totalsWidth })

  totalsY += 20

  // Línea divisora de Totales
  doc
    .strokeColor("#0F172A")
    .lineWidth(1.5)
    .moveTo(totalsX, totalsY - 4)
    .lineTo(pageWidth - margin, totalsY - 4)
    .stroke()

  doc.fillColor("#0F172A").fontSize(12).font("Helvetica-Bold")
  doc.text("TOTAL PROFORMA:", totalsX, totalsY)
  doc.text(formatCOP(pedido.total), totalsX, totalsY, { align: "right", width: totalsWidth })

  // ==========================================
  // 6. PIE DE PÁGINA (FOOTER)
  // ==========================================

  const footerY = doc.page.height - margin - 20

  doc
    .strokeColor("#E2E8F0")
    .lineWidth(1)
    .moveTo(margin, footerY - 8)
    .lineTo(pageWidth - margin, footerY - 8)
    .stroke()

  doc
    .fillColor("#94A3B8")
    .fontSize(8)
    .font("Helvetica")
    .text(`${company.name} — ${company.tagline} | Documento generado automáticamente`, margin, footerY, {
      align: "center",
      width: contentWidth
    })
}
