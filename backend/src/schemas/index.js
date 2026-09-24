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
    precioMinimo: z.coerce.number().min(0, "El precio mínimo debe ser mayor o igual a 0").optional().default(0),
    precioMaximo: z.coerce.number().min(0, "El precio máximo debe ser mayor o igual a 0").optional().default(0),
    stockActual: z.coerce.number().min(0, "El stock actual debe ser mayor o igual a 0").optional(),
    stockMinimo: z.coerce.number().min(0, "El stock mínimo debe ser mayor o igual a 0").optional(),
    tipo: z.enum(["producto_terminado", "materia_prima"]).optional().default("producto_terminado"),
    costoUnitario: z.coerce.number().min(0, "El costo unitario debe ser mayor o igual a 0").optional(),
    unidadMedida: z.string().optional().default("unidades")
  })
  .refine(
    (data) => {
      if (data.tipo === "materia_prima") return true
      return (data.precioMinimo || 0) <= (data.precioMaximo || 0)
    },
    {
      message: "El precio mínimo no puede ser mayor que el precio máximo",
      path: ["precioMinimo"]
    }
  )

/**
 * Schema de validación para receta de ensamblado (BOM)
 */
export const bomSchema = z.object({
  items: z
    .array(
      z.object({
        materiaPrimaId: z.coerce.number().int().positive("ID de materia prima inválido"),
        cantidadRequerida: z.coerce.number().positive("La cantidad requerida debe ser mayor a 0")
      })
    )
    .min(1, "Debe especificar al menos una materia prima / insumo en la receta")
})

/**
 * Schema de validación para ejecutar una orden de producción / ensamblado
 */
export const assemblyOrderSchema = z.object({
  productoTerminadoId: z.coerce.number().int().positive("ID de producto terminado inválido"),
  cantidadProducida: z.coerce.number().int().positive("La cantidad a producir debe ser un número entero positivo"),
  notas: z.string().nullable().optional()
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
 * Schema de validación para ítem de orden de compra
 */
export const purchaseItemSchema = z.object({
  productId: z.coerce.number().int().positive("ID de producto/insumo inválido"),
  cantidad: z.coerce.number().positive("La cantidad comprada debe ser mayor a 0"),
  costoUnitario: z.coerce.number().min(0, "El costo unitario no puede ser negativo")
})

/**
 * Schema de validación para creación de órdenes de compra / importaciones
 */
export const purchaseSchema = z.object({
  proveedor: z.string().min(1, "El nombre del proveedor es obligatorio").max(200),
  items: z.array(purchaseItemSchema).min(1, "La orden de compra debe tener al menos un insumo"),
  notas: z.string().nullable().optional()
})

/**
 * Middleware Express reutilizable para validar el cuerpo de la petición (req.body)
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
