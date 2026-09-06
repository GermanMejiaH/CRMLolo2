import { z } from "zod"

/**
 * Schema de validación para creación/edición de clientes
 */
export const clientSchema = z.object({
  nombre: z.string().min(1, "El nombre del cliente es obligatorio").max(200),
  contacto: z.string().nullable().optional(),
  telefono: z.string().nullable().optional(),
  email: z
    .string()
    .trim()
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
      message: "El correo electrónico no es válido"
    })
    .nullable()
    .optional(),
  direccion: z.string().nullable().optional(),
  precioPersonalizado: z.coerce
    .number()
    .min(0, "El precio personalizado debe ser mayor o igual a 0")
    .nullable()
    .optional(),
  notas: z.string().nullable().optional()
})

/**
 * Schema de validación para creación/edición de productos
 */
export const productSchema = z
  .object({
    nombre: z.string().min(1, "El nombre del producto es obligatorio").max(200),
    descripcion: z.string().nullable().optional(),
    precioMinimo: z.coerce.number().min(0, "El precio mínimo debe ser mayor o igual a 0"),
    precioMaximo: z.coerce.number().min(0, "El precio máximo debe ser mayor o igual a 0"),
    stockActual: z.coerce.number().int().min(0, "El stock actual debe ser mayor o igual a 0").optional(),
    stockMinimo: z.coerce.number().int().min(0, "El stock mínimo debe ser mayor o igual a 0").optional()
  })
  .refine((data) => data.precioMinimo <= data.precioMaximo, {
    message: "El precio mínimo no puede ser mayor que el precio máximo",
    path: ["precioMinimo"]
  })

/**
 * Schema de validación para un ítem individual de un pedido
 */
export const orderItemSchema = z.object({
  productoId: z.coerce.number().int().positive("ID de producto inválido"),
  cantidad: z.coerce.number().int().positive("La cantidad debe ser un número entero positivo"),
  precioUnitario: z.coerce.number().min(0, "El precio unitario no puede ser negativo").optional()
})

/**
 * Schema de validación para creación/edición de pedidos (soporta multi-item y formato legacy)
 */
export const orderSchema = z
  .object({
    clienteId: z.coerce.number().int().positive("ID de cliente inválido"),
    metodoPago: z.enum(["Efectivo", "Transferencia", "Tarjeta", "Crédito"]).optional().default("Efectivo"),
    items: z.array(orderItemSchema).min(1, "El pedido debe contener al menos un producto").optional(),

    // Campos de formato legacy de 1 solo producto
    productoId: z.coerce.number().int().positive().optional(),
    cantidad: z.coerce.number().int().positive().optional(),
    precioUnitario: z.coerce.number().min(0).optional()
  })
  .refine(
    (data) => {
      const hasItems = Array.isArray(data.items) && data.items.length > 0
      const hasLegacy = typeof data.productoId === "number" && typeof data.cantidad === "number"
      return hasItems || hasLegacy
    },
    {
      message: "Debe especificar una lista de productos (items) o los campos del producto (productoId, cantidad)",
      path: ["items"]
    }
  )

/**
 * Schema de validación para registro de abono / pago parcial a pedido
 */
export const abonoSchema = z.object({
  monto: z.coerce.number().positive("El monto abonado debe ser mayor a 0"),
  metodoPago: z.string().optional().default("Efectivo"),
  nota: z.string().nullable().optional()
})

/**
 * Middleware Express reutilizable para validar el cuerpo de la petición (req.body)
 * @param {z.ZodSchema} schema - Schema Zod a evaluar
 */
export function validate(schema) {
  return (req, res, next) => {
    try {
      const result = schema.safeParse(req.body)
      if (!result.success) {
        const formattedErrors = (result.error?.issues || result.error?.errors || []).map((err) => ({
          field: Array.isArray(err.path) ? err.path.join(".") : "",
          message: err.message
        }))
        return res.status(400).json({
          error: "validation_error",
          message: "Datos de entrada no válidos",
          details: formattedErrors
        })
      }
      req.body = result.data
      next()
    } catch (err) {
      return res.status(400).json({
        error: "validation_error",
        message: err.message
      })
    }
  }
}
