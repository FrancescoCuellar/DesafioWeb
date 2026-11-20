const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = __dirname;
const dataDir = path.join(root, "data");
const port = Number(process.env.PORT) || 3000;
// Clave del panel de administrador. Se puede cambiar con la variable de entorno ADMIN_KEY.
const adminKey = process.env.ADMIN_KEY || "norteno2026";
const MAX_CUERPO = 100 * 1024;

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};

const metodosPago = {
  yape: "Yape",
  plin: "Plin",
  transferencia: "Transferencia bancaria",
  efectivo: "Efectivo al recoger"
};
const estadosPedido = ["pendiente", "pagado", "entregado", "cancelado"];

// Archivos y carpetas que nunca se entregan como archivos estáticos
const rutasPrivadas = new Set(["data", "node_modules", "server.js", "package.json", "package-lock.json"]);

const regexCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const regexTelefono = /^[0-9+\s-]{6,20}$/;

/* ---------- Utilidades de datos ---------- */

function leerJSON(nombre, porDefecto) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dataDir, nombre), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return porDefecto;
    throw error;
  }
}

function guardarJSON(nombre, datos) {
  fs.mkdirSync(dataDir, { recursive: true });
  const destino = path.join(dataDir, nombre);
  const temporal = `${destino}.tmp`;
  fs.writeFileSync(temporal, JSON.stringify(datos, null, 2));
  fs.renameSync(temporal, destino);
}

function redondear(numero) {
  return Math.round(numero * 100) / 100;
}

function siguienteId(lista) {
  return lista.reduce((mayor, item) => Math.max(mayor, item.id), 0) + 1;
}

/* ---------- Utilidades HTTP ---------- */

function enviarJSON(response, status, cuerpo, extra = {}) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store",
    ...extra
  });
  response.end(JSON.stringify(cuerpo));
}

function enviarError(response, status, mensaje, extra) {
  enviarJSON(response, status, { error: mensaje }, extra);
}

function leerCuerpo(request) {
  return new Promise((resolve, reject) => {
    let tamano = 0;
    let excedido = false;
    const partes = [];

    request.on("data", (trozo) => {
      tamano += trozo.length;
      if (tamano > MAX_CUERPO) {
        excedido = true;
        return;
      }
      partes.push(trozo);
    });

    request.on("end", () => {
      if (excedido) {
        reject({ status: 413, mensaje: "La solicitud es demasiado grande." });
        return;
      }
      try {
        const datos = JSON.parse(Buffer.concat(partes).toString("utf8") || "null");
        if (datos === null || typeof datos !== "object" || Array.isArray(datos)) throw new Error("formato");
        resolve(datos);
      } catch {
        reject({ status: 400, mensaje: "El cuerpo de la solicitud debe ser un JSON válido." });
      }
    });

    request.on("error", () => reject({ status: 400, mensaje: "No se pudo leer la solicitud." }));
  });
}

function esAdmin(request) {
  const enviada = request.headers["x-admin-key"];
  if (typeof enviada !== "string") return false;
  const a = crypto.createHash("sha256").update(enviada).digest();
  const b = crypto.createHash("sha256").update(adminKey).digest();
  return crypto.timingSafeEqual(a, b);
}

/* ---------- Validaciones ---------- */

function texto(valor, minimo, maximo) {
  if (typeof valor !== "string") return null;
  const limpio = valor.trim();
  return limpio.length >= minimo && limpio.length <= maximo ? limpio : null;
}

function validarContacto(datos) {
  const nombre = texto(datos.nombre, 3, 80);
  if (!nombre) return { error: "El nombre debe tener entre 3 y 80 caracteres." };

  const correo = texto(datos.correo, 5, 120);
  if (!correo || !regexCorreo.test(correo)) return { error: "El correo electrónico no es válido." };

  const mensaje = texto(datos.mensaje, 10, 1000);
  if (!mensaje) return { error: "El mensaje debe tener entre 10 y 1000 caracteres." };

  if (datos.privacidad !== true) {
    return { error: "Debes aceptar la política de privacidad (Ley N° 29733)." };
  }
  return { valor: { nombre, correo, mensaje } };
}

function validarPedido(datos, productos) {
  const nombre = texto(datos.nombre, 3, 80);
  if (!nombre) return { error: "El nombre debe tener entre 3 y 80 caracteres." };

  const correo = texto(datos.correo, 5, 120);
  if (!correo || !regexCorreo.test(correo)) return { error: "El correo electrónico no es válido." };

  let telefono = "";
  if (datos.telefono !== undefined && datos.telefono !== null && String(datos.telefono).trim() !== "") {
    telefono = texto(String(datos.telefono), 6, 20);
    if (!telefono || !regexTelefono.test(telefono)) return { error: "El teléfono no es válido." };
  }

  if (typeof datos.metodoPago !== "string" || !Object.hasOwn(metodosPago, datos.metodoPago)) {
    return { error: "Elige un método de pago válido." };
  }

  if (datos.privacidad !== true) {
    return { error: "Debes aceptar la política de privacidad (Ley N° 29733)." };
  }

  if (!Array.isArray(datos.items) || datos.items.length === 0 || datos.items.length > 20) {
    return { error: "El pedido debe tener entre 1 y 20 productos." };
  }

  const cantidades = new Map();
  for (const item of datos.items) {
    const id = item && item.id;
    const cantidad = item && item.cantidad;
    if (!Number.isInteger(id) || !Number.isInteger(cantidad) || cantidad < 1 || cantidad > 99) {
      return { error: "Cada producto debe tener un id y una cantidad entre 1 y 99." };
    }
    cantidades.set(id, Math.min(99, (cantidades.get(id) || 0) + cantidad));
  }

  const items = [];
  for (const [id, cantidad] of cantidades) {
    const producto = productos.find((p) => p.id === id);
    if (!producto) return { error: `El producto ${id} no existe.` };
    items.push({
      id: producto.id,
      nombre: producto.nombre,
      precio: producto.precio,
      cantidad,
      subtotal: redondear(producto.precio * cantidad)
    });
  }

  const total = redondear(items.reduce((suma, item) => suma + item.subtotal, 0));
  return { valor: { nombre, correo, telefono, items, total, metodoPago: datos.metodoPago } };
}

/* ---------- API ---------- */

function resumenVentas(pedidos) {
  const cobrados = pedidos.filter((p) => p.estado === "pagado" || p.estado === "entregado");
  const pendientes = pedidos.filter((p) => p.estado === "pendiente");
  return {
    totalPedidos: pedidos.length,
    pedidosPendientes: pendientes.length,
    ventas: redondear(cobrados.reduce((suma, p) => suma + p.total, 0)),
    porCobrar: redondear(pendientes.reduce((suma, p) => suma + p.total, 0))
  };
}

async function manejarAPI(request, response, pathname) {
  const metodo = request.method;
  const leyendo = metodo === "GET" || metodo === "HEAD";

  if (pathname === "/api/productos") {
    if (!leyendo) return enviarError(response, 405, "Método no permitido", { Allow: "GET, HEAD" });
    return enviarJSON(response, 200, leerJSON("productos.json", []));
  }

  const coincideProducto = pathname.match(/^\/api\/productos\/(\d+)$/);
  if (coincideProducto) {
    if (!leyendo) return enviarError(response, 405, "Método no permitido", { Allow: "GET, HEAD" });
    const producto = leerJSON("productos.json", []).find((p) => p.id === Number(coincideProducto[1]));
    if (!producto) return enviarError(response, 404, "Producto no encontrado");
    return enviarJSON(response, 200, producto);
  }

  if (pathname === "/api/pedidos") {
    if (metodo !== "POST") return enviarError(response, 405, "Método no permitido", { Allow: "POST" });
    const resultado = validarPedido(await leerCuerpo(request), leerJSON("productos.json", []));
    if (resultado.error) return enviarError(response, 400, resultado.error);

    const pedidos = leerJSON("pedidos.json", []);
    const id = siguienteId(pedidos);
    const pedido = {
      id,
      codigo: `PED-${String(id).padStart(4, "0")}`,
      fecha: new Date().toISOString(),
      cliente: {
        nombre: resultado.valor.nombre,
        correo: resultado.valor.correo,
        telefono: resultado.valor.telefono
      },
      items: resultado.valor.items,
      total: resultado.valor.total,
      metodoPago: resultado.valor.metodoPago,
      metodoPagoNombre: metodosPago[resultado.valor.metodoPago],
      estado: "pendiente"
    };
    pedidos.push(pedido);
    guardarJSON("pedidos.json", pedidos);
    return enviarJSON(response, 201, pedido);
  }

  if (pathname === "/api/contacto") {
    if (metodo !== "POST") return enviarError(response, 405, "Método no permitido", { Allow: "POST" });
    const resultado = validarContacto(await leerCuerpo(request));
    if (resultado.error) return enviarError(response, 400, resultado.error);

    const mensajes = leerJSON("mensajes.json", []);
    const mensaje = { id: siguienteId(mensajes), fecha: new Date().toISOString(), ...resultado.valor };
    mensajes.push(mensaje);
    guardarJSON("mensajes.json", mensajes);
    return enviarJSON(response, 201, { id: mensaje.id, recibido: true });
  }

  /* ----- Rutas del administrador ----- */

  if (pathname === "/api/admin/login") {
    if (metodo !== "POST") return enviarError(response, 405, "Método no permitido", { Allow: "POST" });
    const datos = await leerCuerpo(request);
    const valida = typeof datos.clave === "string" && esAdmin({ headers: { "x-admin-key": datos.clave } });
    if (!valida) return enviarError(response, 401, "Clave incorrecta");
    return enviarJSON(response, 200, { ok: true });
  }

  if (pathname.startsWith("/api/admin/")) {
    if (!esAdmin(request)) return enviarError(response, 401, "No autorizado");

    if (pathname === "/api/admin/pedidos") {
      if (!leyendo) return enviarError(response, 405, "Método no permitido", { Allow: "GET, HEAD" });
      const pedidos = leerJSON("pedidos.json", []);
      return enviarJSON(response, 200, {
        resumen: resumenVentas(pedidos),
        pedidos: [...pedidos].reverse()
      });
    }

    if (pathname === "/api/admin/mensajes") {
      if (!leyendo) return enviarError(response, 405, "Método no permitido", { Allow: "GET, HEAD" });
      return enviarJSON(response, 200, [...leerJSON("mensajes.json", [])].reverse());
    }

    const coincideEstado = pathname.match(/^\/api\/admin\/pedidos\/(\d+)\/estado$/);
    if (coincideEstado) {
      if (metodo !== "POST") return enviarError(response, 405, "Método no permitido", { Allow: "POST" });
      const datos = await leerCuerpo(request);
      if (typeof datos.estado !== "string" || !estadosPedido.includes(datos.estado)) {
        return enviarError(response, 400, `El estado debe ser: ${estadosPedido.join(", ")}.`);
      }
      const pedidos = leerJSON("pedidos.json", []);
      const pedido = pedidos.find((p) => p.id === Number(coincideEstado[1]));
      if (!pedido) return enviarError(response, 404, "Pedido no encontrado");
      pedido.estado = datos.estado;
      guardarJSON("pedidos.json", pedidos);
      return enviarJSON(response, 200, pedido);
    }
  }

  return enviarError(response, 404, "Ruta de la API no encontrada");
}

/* ---------- Archivos estáticos ---------- */

function sendFile(response, filePath) {
  fs.readFile(filePath, (error, contents) => {
    if (error) {
      const noExiste = error.code === "ENOENT" || error.code === "EISDIR";
      response.writeHead(noExiste ? 404 : 500, {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff"
      });
      response.end(noExiste ? "No encontrado" : "Error interno del servidor");
      return;
    }

    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff"
    });
    response.end(contents);
  });
}

const server = http.createServer(async (request, response) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  } catch {
    response.writeHead(400);
    response.end("Solicitud inválida");
    return;
  }

  try {
    if (pathname.startsWith("/api/")) {
      await manejarAPI(request, response, pathname);
      return;
    }
  } catch (error) {
    if (error && error.status) {
      enviarError(response, error.status, error.mensaje);
    } else {
      console.error(error);
      enviarError(response, 500, "Error interno del servidor");
    }
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end("Método no permitido");
    return;
  }

  const relativePath = pathname === "/" ? "index.html" : pathname === "/admin" ? "admin.html" : pathname.replace(/^\/+/, "");
  const filePath = path.resolve(root, relativePath);
  if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Acceso denegado");
    return;
  }

  // Los datos, el código del servidor y los archivos ocultos no se publican
  const partes = path.relative(root, filePath).split(path.sep);
  if (rutasPrivadas.has(partes[0]) || partes.some((parte) => parte.startsWith("."))) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("No encontrado");
    return;
  }

  sendFile(response, filePath);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Dulcería El Norteño disponible en http://localhost:${port}`);
  console.log(`Panel de administrador: http://localhost:${port}/admin`);
});
