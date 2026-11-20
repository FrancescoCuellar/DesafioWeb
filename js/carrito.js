// Lógica JavaScript y manipulación del DOM - Dulcería El Norteño
// Enlazado directamente con index.html

let productos = [];
let pedido = [];

const infoMetodoPago = {
    yape: "Pagarás con Yape. Al confirmar te mostraremos los datos (ejemplo ficticio).",
    plin: "Pagarás con Plin. Al confirmar te mostraremos los datos (ejemplo ficticio).",
    transferencia: "Pagarás por transferencia bancaria. Al confirmar recibirás la cuenta (ejemplo ficticio).",
    efectivo: "Pagarás en efectivo al recoger tu pedido en la tienda."
};

document.addEventListener("DOMContentLoaded", () => {
    configurarEventosPedido();
    configurarDetalleProducto();
    configurarFormularioPedido();
    configurarFormularioContacto();
    cargarCatalogo();
    renderizarPedido();
});

/* ---------- Comunicación con el servidor ---------- */

async function enviarJSON(url, datos) {
    try {
        const respuesta = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(datos)
        });
        const cuerpo = await respuesta.json().catch(() => ({}));
        return { ok: respuesta.ok, estado: respuesta.status, datos: cuerpo };
    } catch {
        return { ok: false, estado: 0, datos: { error: "No se pudo conectar con el servidor. Inténtalo de nuevo." } };
    }
}

/* ---------- Catálogo desde la API (HU01) ---------- */

async function cargarCatalogo() {
    const contenedor = document.querySelector("#catalogoProductos");
    if (!contenedor) return;

    try {
        const respuesta = await fetch("/api/productos");
        if (!respuesta.ok) throw new Error("Respuesta no válida");
        productos = await respuesta.json();
        renderizarCatalogo(contenedor);
    } catch {
        contenedor.textContent = "";
        const aviso = document.createElement("p");
        aviso.className = "text-center text-danger";
        aviso.setAttribute("role", "alert");
        aviso.textContent = "No pudimos cargar el catálogo. Recarga la página para intentarlo otra vez.";
        contenedor.append(aviso);
    }
}

function renderizarCatalogo(contenedor) {
    contenedor.textContent = "";

    if (productos.length === 0) {
        const vacio = document.createElement("p");
        vacio.className = "text-center";
        vacio.textContent = "Pronto tendremos nuevos dulces.";
        contenedor.append(vacio);
        return;
    }

    productos.forEach((producto) => {
        const columna = document.createElement("div");
        columna.className = "col-12 col-sm-6 col-lg-4";

        const tarjeta = document.createElement("div");
        tarjeta.className = "card producto-card h-100";

        const imagen = document.createElement("img");
        imagen.className = "card-img-top";
        imagen.src = producto.imagen || "img/nosotros.svg";
        imagen.alt = producto.nombre;
        imagen.loading = "lazy";

        const cuerpo = document.createElement("div");
        cuerpo.className = "card-body text-center";

        const titulo = document.createElement("h5");
        titulo.className = "card-title";
        titulo.textContent = producto.nombre;

        const descripcion = document.createElement("p");
        descripcion.textContent = producto.descripcion;

        const precio = document.createElement("h4");
        precio.className = "precio";
        precio.textContent = formatearSoles(producto.precio);

        const btnDetalle = document.createElement("button");
        btnDetalle.type = "button";
        btnDetalle.className = "btn btn-outline-dark mb-2 me-1";
        btnDetalle.dataset.id = producto.id;
        btnDetalle.dataset.bsToggle = "modal";
        btnDetalle.dataset.bsTarget = "#modalDetalle";
        btnDetalle.textContent = "Ver detalle";

        const btnAgregar = document.createElement("button");
        btnAgregar.type = "button";
        btnAgregar.className = "btn btn-dorado btn-agregar mb-2";
        btnAgregar.dataset.id = producto.id;
        btnAgregar.dataset.nombre = producto.nombre;
        btnAgregar.dataset.precio = producto.precio;
        btnAgregar.textContent = "Agregar al pedido";

        cuerpo.append(titulo, descripcion, precio, btnDetalle, btnAgregar);
        tarjeta.append(imagen, cuerpo);
        columna.append(tarjeta);
        contenedor.append(columna);
    });
}

function configurarDetalleProducto() {
    const modal = document.querySelector("#modalDetalle");
    if (!modal) return;

    // Un solo modal que se rellena con el producto elegido
    modal.addEventListener("show.bs.modal", (evento) => {
        const boton = evento.relatedTarget;
        const producto = boton && productos.find((p) => p.id === Number(boton.dataset.id));
        if (!producto) return;

        modal.querySelector("#detalleTitulo").textContent = producto.nombre;
        const imagen = modal.querySelector("#detalleImagen");
        imagen.src = producto.imagen || "img/nosotros.svg";
        imagen.alt = producto.nombre;
        modal.querySelector("#detalleDescripcion").textContent = producto.detalle || producto.descripcion;
        modal.querySelector("#detallePrecio").textContent = formatearSoles(producto.precio);

        const agregar = modal.querySelector("#detalleAgregar");
        agregar.dataset.id = producto.id;
        agregar.dataset.nombre = producto.nombre;
        agregar.dataset.precio = producto.precio;
    });
}

function formatearSoles(monto) {
    return `S/ ${Number(monto).toFixed(2)}`;
}

/* ---------- Módulo "Mi pedido": agregar, quitar y calcular total (HU02) ---------- */

function configurarEventosPedido() {
    document.addEventListener("click", (e) => {
        const btnAgregar = e.target.closest(".btn-agregar");
        if (btnAgregar) {
            const id = Number(btnAgregar.dataset.id);
            const nombre = btnAgregar.dataset.nombre;
            const precio = Number(btnAgregar.dataset.precio);
            agregarProducto(id, nombre, precio);
        }

        const btnQuitar = e.target.closest(".btn-quitar");
        if (btnQuitar) {
            const index = Number(btnQuitar.dataset.index);
            quitarProducto(index);
        }
    });
}

function agregarProducto(id, nombre, precio) {
    const existente = pedido.find((item) => item.id === id);

    if (existente) {
        existente.cantidad += 1;
        existente.subtotal = existente.cantidad * existente.precio;
    } else {
        pedido.push({
            id: id,
            nombre: nombre,
            precio: precio,
            cantidad: 1,
            subtotal: precio
        });
    }

    renderizarPedido();
}

function quitarProducto(index) {
    if (index >= 0 && index < pedido.length) {
        pedido.splice(index, 1);
        renderizarPedido();
    }
}

function renderizarPedido() {
    const listaPedido = document.querySelector("#listaPedido");
    const totalPedido = document.querySelector("#totalPedido");
    const btnConfirmar = document.querySelector("#btnConfirmarPedido");
    if (!listaPedido || !totalPedido) return;

    listaPedido.innerHTML = "";
    let total = 0;

    if (btnConfirmar) btnConfirmar.disabled = pedido.length === 0;

    if (pedido.length === 0) {
        const pVacio = document.createElement("p");
        pVacio.className = "text-muted mb-0";
        pVacio.textContent = "Todavía no has agregado productos.";
        listaPedido.append(pVacio);
        totalPedido.textContent = "S/ 0.00";
        return;
    }

    const ul = document.createElement("ul");
    ul.className = "list-group mb-2";

    pedido.forEach((item, index) => {
        total += item.subtotal;

        const li = document.createElement("li");
        li.className = "list-group-item d-flex justify-content-between align-items-center";

        const info = document.createElement("span");
        info.textContent = `${item.cantidad}x ${item.nombre} — S/ ${item.subtotal.toFixed(2)}`;

        const btnQuitar = document.createElement("button");
        btnQuitar.type = "button";
        btnQuitar.className = "btn btn-sm btn-outline-danger btn-quitar";
        btnQuitar.dataset.index = index;
        btnQuitar.setAttribute("aria-label", `Quitar ${item.nombre} del pedido`);
        btnQuitar.textContent = "Quitar";

        li.append(info, btnQuitar);
        ul.append(li);
    });

    listaPedido.append(ul);
    totalPedido.textContent = `S/ ${total.toFixed(2)}`;
}

/* ---------- Confirmar pedido con método de pago simulado (HU03) ---------- */

function configurarFormularioPedido() {
    const form = document.querySelector("#formPedido");
    const feedback = document.querySelector("#mensajePedido");
    if (!form || !feedback) return;

    const infoPago = document.querySelector("#infoPago");
    form.querySelectorAll('input[name="metodoPago"]').forEach((radio) => {
        radio.addEventListener("change", () => {
            infoPago.textContent = infoMetodoPago[radio.value] || "";
        });
    });

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const inputNombre = document.querySelector("#pedidoNombre");
        const inputCorreo = document.querySelector("#pedidoCorreo");
        const inputTelefono = document.querySelector("#pedidoTelefono");
        const radios = form.querySelectorAll('input[name="metodoPago"]');
        const checkPrivacidad = document.querySelector("#pedidoPrivacidad");

        [inputNombre, inputCorreo, inputTelefono, checkPrivacidad, ...radios].forEach((el) => {
            el.classList.remove("is-invalid");
        });
        feedback.textContent = "";
        feedback.className = "mt-3";

        if (pedido.length === 0) {
            feedback.className = "mt-3 alert alert-danger";
            feedback.textContent = "Agrega al menos un dulce a tu pedido antes de confirmar.";
            return;
        }

        const nombre = inputNombre.value.trim();
        const correo = inputCorreo.value.trim();
        const telefono = inputTelefono.value.trim();
        const metodoElegido = form.querySelector('input[name="metodoPago"]:checked');

        if (nombre.length < 3) {
            mostrarErrorCampo(inputNombre, feedback, "Por favor, ingresa tu nombre completo (mínimo 3 caracteres).");
            return;
        }

        const regexCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!regexCorreo.test(correo)) {
            mostrarErrorCampo(inputCorreo, feedback, "Por favor, ingresa un correo electrónico válido.");
            return;
        }

        if (telefono !== "" && !/^[0-9+\s-]{6,20}$/.test(telefono)) {
            mostrarErrorCampo(inputTelefono, feedback, "El teléfono solo puede tener números, espacios, + o -.");
            return;
        }

        if (!metodoElegido) {
            mostrarErrorCampo(radios[0], feedback, "Elige un método de pago.");
            return;
        }

        if (!checkPrivacidad.checked) {
            mostrarErrorCampo(
                checkPrivacidad,
                feedback,
                "Debes aceptar la política de privacidad antes de confirmar tu pedido (Ley N° 29733)."
            );
            return;
        }

        const boton = document.querySelector("#btnConfirmarPedido");
        boton.disabled = true;

        const respuesta = await enviarJSON("/api/pedidos", {
            nombre: nombre,
            correo: correo,
            telefono: telefono,
            metodoPago: metodoElegido.value,
            privacidad: true,
            items: pedido.map((item) => ({ id: item.id, cantidad: item.cantidad }))
        });

        if (!respuesta.ok) {
            feedback.className = "mt-3 alert alert-danger";
            feedback.textContent = respuesta.datos.error || "No se pudo registrar el pedido.";
            boton.disabled = false;
            return;
        }

        const registrado = respuesta.datos;
        feedback.className = "mt-3 alert alert-success";
        feedback.textContent =
            `¡Gracias, ${nombre}! Tu pedido ${registrado.codigo} fue registrado por ` +
            `${formatearSoles(registrado.total)}. Método de pago: ${registrado.metodoPagoNombre}. ` +
            "El pago es simulado: no se realizó ningún cobro.";

        pedido = [];
        form.reset();
        infoPago.textContent = "";
        renderizarPedido();
    });
}

/* ---------- Formulario de contacto y consentimiento de privacidad (Ley N° 29733) ---------- */

function configurarFormularioContacto() {
    const form = document.querySelector("#formContacto");
    const feedback = document.querySelector("#mensajeFormulario");
    if (!form || !feedback) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const inputNombre = document.querySelector("#nombre");
        const inputCorreo = document.querySelector("#correo");
        const inputMensaje = document.querySelector("#mensaje");
        const checkPrivacidad = document.querySelector("#privacidad");

        [inputNombre, inputCorreo, inputMensaje, checkPrivacidad].forEach((el) => {
            if (el) el.classList.remove("is-invalid");
        });
        feedback.textContent = "";
        feedback.className = "mt-3";

        const nombre = inputNombre.value.trim();
        const correo = inputCorreo.value.trim();
        const mensaje = inputMensaje.value.trim();
        const aceptoPrivacidad = checkPrivacidad.checked;

        if (nombre.length < 3) {
            mostrarErrorCampo(inputNombre, feedback, "Por favor, ingresa tu nombre completo (mínimo 3 caracteres).");
            return;
        }

        const regexCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!regexCorreo.test(correo)) {
            mostrarErrorCampo(inputCorreo, feedback, "Por favor, ingresa un correo electrónico válido.");
            return;
        }

        if (mensaje.length < 10) {
            mostrarErrorCampo(inputMensaje, feedback, "Escribe una consulta más detallada (mínimo 10 caracteres).");
            return;
        }

        // Exige marcar la casilla de privacidad sin premarcar
        if (!aceptoPrivacidad) {
            mostrarErrorCampo(
                checkPrivacidad,
                feedback,
                "Debes aceptar la política de privacidad antes de enviar tu consulta (Ley N° 29733)."
            );
            return;
        }

        const respuesta = await enviarJSON("/api/contacto", {
            nombre: nombre,
            correo: correo,
            mensaje: mensaje,
            privacidad: true
        });

        if (!respuesta.ok) {
            feedback.className = "mt-3 alert alert-danger";
            feedback.textContent = respuesta.datos.error || "No se pudo enviar tu mensaje.";
            return;
        }

        feedback.className = "mt-3 alert alert-success";
        feedback.textContent = `¡Gracias, ${nombre}! Tu mensaje para Dulcería El Norteño fue recibido correctamente.`;
        form.reset();
    });
}

function mostrarErrorCampo(elemento, contenedorFeedback, textoError) {
    elemento.classList.add("is-invalid");
    elemento.focus();
    contenedorFeedback.className = "mt-3 alert alert-danger";
    contenedorFeedback.textContent = textoError;
}
