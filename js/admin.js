// Panel del administrador - Dulcería El Norteño
// Consulta pedidos, ventas y mensajes a través de la API protegida con clave

const ESTADOS = ["pendiente", "pagado", "entregado", "cancelado"];
const CLASE_ESTADO = {
    pendiente: "text-bg-warning",
    pagado: "text-bg-success",
    entregado: "text-bg-primary",
    cancelado: "text-bg-secondary"
};

let pedidos = [];

document.addEventListener("DOMContentLoaded", () => {
    document.querySelector("#formLogin").addEventListener("submit", iniciarSesion);
    document.querySelector("#btnSalir").addEventListener("click", cerrarSesion);
    document.querySelector("#btnActualizar").addEventListener("click", cargarPanel);
    document.querySelector("#filtroEstado").addEventListener("change", renderizarPedidos);

    if (leerClave()) cargarPanel();
});

/* ---------- Sesión ---------- */

function leerClave() {
    try {
        return sessionStorage.getItem("claveAdmin") || "";
    } catch {
        return "";
    }
}

function guardarClave(clave) {
    try {
        if (clave) sessionStorage.setItem("claveAdmin", clave);
        else sessionStorage.removeItem("claveAdmin");
    } catch {
        // Si el navegador bloquea el almacenamiento, la sesión dura mientras la página siga abierta
    }
}

async function iniciarSesion(e) {
    e.preventDefault();
    const input = document.querySelector("#claveAdmin");
    const aviso = document.querySelector("#mensajeLogin");
    aviso.className = "mt-3";
    aviso.textContent = "";

    if (input.value === "") {
        aviso.className = "mt-3 alert alert-danger";
        aviso.textContent = "Escribe la clave de acceso.";
        input.focus();
        return;
    }

    try {
        const respuesta = await fetch("/api/admin/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clave: input.value })
        });

        if (!respuesta.ok) {
            aviso.className = "mt-3 alert alert-danger";
            aviso.textContent = respuesta.status === 401 ? "Clave incorrecta." : "No se pudo iniciar sesión.";
            return;
        }

        guardarClave(input.value);
        claveEnMemoria = input.value;
        input.value = "";
        cargarPanel();
    } catch {
        aviso.className = "mt-3 alert alert-danger";
        aviso.textContent = "No se pudo conectar con el servidor.";
    }
}

let claveEnMemoria = "";

function claveActual() {
    return leerClave() || claveEnMemoria;
}

function cerrarSesion() {
    guardarClave("");
    claveEnMemoria = "";
    pedidos = [];
    document.querySelector("#vistaPanel").classList.add("d-none");
    document.querySelector("#btnSalir").classList.add("d-none");
    document.querySelector("#vistaLogin").classList.remove("d-none");
}

/* ---------- Llamadas a la API ---------- */

async function pedirAdmin(url, opciones = {}) {
    const respuesta = await fetch(url, {
        ...opciones,
        headers: {
            "Content-Type": "application/json",
            "X-Admin-Key": claveActual()
        }
    });

    if (respuesta.status === 401) {
        cerrarSesion();
        const aviso = document.querySelector("#mensajeLogin");
        aviso.className = "mt-3 alert alert-danger";
        aviso.textContent = "Tu sesión expiró o la clave no es válida.";
        throw new Error("No autorizado");
    }

    const cuerpo = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) throw new Error(cuerpo.error || "Error del servidor");
    return cuerpo;
}

async function cargarPanel() {
    const aviso = document.querySelector("#mensajePanel");
    aviso.className = "";
    aviso.textContent = "";

    try {
        const [datos, mensajes] = await Promise.all([
            pedirAdmin("/api/admin/pedidos"),
            pedirAdmin("/api/admin/mensajes")
        ]);

        pedidos = datos.pedidos;
        document.querySelector("#vistaLogin").classList.add("d-none");
        document.querySelector("#vistaPanel").classList.remove("d-none");
        document.querySelector("#btnSalir").classList.remove("d-none");

        mostrarResumen(datos.resumen);
        renderizarPedidos();
        renderizarTop();
        renderizarMensajes(mensajes);
    } catch (error) {
        if (error.message !== "No autorizado") {
            aviso.className = "alert alert-danger";
            aviso.textContent = `No se pudo cargar el panel: ${error.message}`;
        }
    }
}

async function cambiarEstado(id, estado, selector) {
    const aviso = document.querySelector("#mensajePanel");
    try {
        await pedirAdmin(`/api/admin/pedidos/${id}/estado`, {
            method: "POST",
            body: JSON.stringify({ estado: estado })
        });
        await cargarPanel();
    } catch (error) {
        selector.disabled = false;
        aviso.className = "alert alert-danger";
        aviso.textContent = `No se pudo cambiar el estado: ${error.message}`;
    }
}

/* ---------- Pintado ---------- */

function soles(monto) {
    return `S/ ${Number(monto).toFixed(2)}`;
}

function mostrarResumen(resumen) {
    document.querySelector("#cifraVentas").textContent = soles(resumen.ventas);
    document.querySelector("#cifraPorCobrar").textContent = soles(resumen.porCobrar);
    document.querySelector("#cifraPedidos").textContent = resumen.totalPedidos;
    document.querySelector("#cifraPendientes").textContent = resumen.pedidosPendientes;
}

function celda(texto, clase) {
    const td = document.createElement("td");
    td.textContent = texto;
    if (clase) td.className = clase;
    return td;
}

function renderizarPedidos() {
    const cuerpo = document.querySelector("#tablaPedidos");
    const sinPedidos = document.querySelector("#sinPedidos");
    const filtro = document.querySelector("#filtroEstado").value;
    cuerpo.textContent = "";

    const visibles = pedidos.filter((p) => filtro === "todos" || p.estado === filtro);
    sinPedidos.classList.toggle("d-none", visibles.length > 0);

    visibles.forEach((pedido) => {
        const fila = document.createElement("tr");

        const detalle = pedido.items.map((item) => `${item.cantidad}x ${item.nombre}`).join(", ");
        const contacto = pedido.cliente.telefono
            ? `${pedido.cliente.nombre} · ${pedido.cliente.correo} · ${pedido.cliente.telefono}`
            : `${pedido.cliente.nombre} · ${pedido.cliente.correo}`;

        fila.append(
            celda(pedido.codigo, "fw-bold"),
            celda(new Date(pedido.fecha).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" })),
            celda(contacto),
            celda(detalle),
            celda(pedido.metodoPagoNombre),
            celda(soles(pedido.total), "text-end")
        );

        const tdEstado = document.createElement("td");
        const insignia = document.createElement("span");
        insignia.className = `badge ${CLASE_ESTADO[pedido.estado]} me-2`;
        insignia.textContent = pedido.estado;

        const selector = document.createElement("select");
        selector.className = "form-select form-select-sm d-inline-block w-auto";
        selector.setAttribute("aria-label", `Cambiar estado del pedido ${pedido.codigo}`);
        ESTADOS.forEach((estado) => {
            const opcion = document.createElement("option");
            opcion.value = estado;
            opcion.textContent = estado;
            opcion.selected = estado === pedido.estado;
            selector.append(opcion);
        });
        selector.addEventListener("change", () => {
            selector.disabled = true;
            cambiarEstado(pedido.id, selector.value, selector);
        });

        tdEstado.append(insignia, selector);
        fila.append(tdEstado);
        cuerpo.append(fila);
    });
}

function renderizarTop() {
    const lista = document.querySelector("#listaTop");
    const sinTop = document.querySelector("#sinTop");
    lista.textContent = "";

    const cantidades = new Map();
    pedidos
        .filter((p) => p.estado !== "cancelado")
        .forEach((p) => {
            p.items.forEach((item) => {
                cantidades.set(item.nombre, (cantidades.get(item.nombre) || 0) + item.cantidad);
            });
        });

    const orden = [...cantidades.entries()].sort((a, b) => b[1] - a[1]);
    sinTop.classList.toggle("d-none", orden.length > 0);

    orden.forEach(([nombre, cantidad]) => {
        const li = document.createElement("li");
        li.className = "list-group-item d-flex justify-content-between";
        const n = document.createElement("span");
        n.textContent = nombre;
        const c = document.createElement("strong");
        c.textContent = `${cantidad} u.`;
        li.append(n, c);
        lista.append(li);
    });
}

function renderizarMensajes(mensajes) {
    const lista = document.querySelector("#listaMensajes");
    const sinMensajes = document.querySelector("#sinMensajes");
    lista.textContent = "";
    sinMensajes.classList.toggle("d-none", mensajes.length > 0);

    mensajes.forEach((mensaje) => {
        const li = document.createElement("li");
        li.className = "list-group-item";

        const encabezado = document.createElement("div");
        encabezado.className = "d-flex justify-content-between flex-wrap";
        const quien = document.createElement("strong");
        quien.textContent = `${mensaje.nombre} · ${mensaje.correo}`;
        const cuando = document.createElement("small");
        cuando.className = "text-muted";
        cuando.textContent = new Date(mensaje.fecha).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });
        encabezado.append(quien, cuando);

        const texto = document.createElement("p");
        texto.className = "mb-0";
        texto.textContent = mensaje.mensaje;

        li.append(encabezado, texto);
        lista.append(li);
    });
}
