// Lógica JavaScript y manipulación del DOM - Dulcería El Norteño
// Enlazado directamente con index.html

let pedido = [];

document.addEventListener("DOMContentLoaded", () => {
    configurarEventosPedido();
    configurarFormularioContacto();
});

// Módulo "Mi pedido": agregar, quitar y calcular total
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
    if (!listaPedido || !totalPedido) return;

    listaPedido.innerHTML = "";
    let total = 0;

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

// Validación del formulario de contacto y consentimiento de privacidad (Ley N° 29733)
function configurarFormularioContacto() {
    const form = document.querySelector("#formContacto");
    const feedback = document.querySelector("#mensajeFormulario");
    if (!form || !feedback) return;

    form.addEventListener("submit", (e) => {
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

        feedback.className = "mt-3 alert alert-success";
        feedback.textContent = `¡Gracias, ${nombre}! Tu mensaje para Dulcería El Norteño fue validado y enviado correctamente.`;
        form.reset();
    });
}

function mostrarErrorCampo(elemento, contenedorFeedback, textoError) {
    elemento.classList.add("is-invalid");
    elemento.focus();
    contenedorFeedback.className = "mt-3 alert alert-danger";
    contenedorFeedback.textContent = textoError;
}