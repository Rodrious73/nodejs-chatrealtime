import { io } from "https://cdn.socket.io/4.3.2/socket.io.esm.min.js";

document.addEventListener('DOMContentLoaded', () => {
    function scrollToBottom() {
        const messagesDiv = document.getElementById("messages");
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    // Obtener el elemento del modal
    var exampleModal = document.getElementById("exampleModal");

    // Añadir un listener para el evento de mostrar el modal
    exampleModal.addEventListener("shown.bs.modal", function () {
        scrollToBottom();
    });

    toastr.options = {
        closeButton: true,
        progressBar: true,
        timeOut: 5000, // tiempo en milisegundos
        extendedTimeOut: 1000, // tiempo en milisegundos al pasar el ratón
        preventDuplicates: true,
    };

    let currentDestinatarioId = null;

    // Crear una instancia de Socket.IO
    const socket = io({
        auth: {
            username: getQueryParam("username"),
            remitente_id: getQueryParam("remitente_id"),
            serverOffset: 0,
        },
    });

    function getQueryParam(param) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(param);
    }

    const username = getQueryParam("username");
    const remitente_id = getQueryParam("remitente_id");

    // Registrar al usuario en el servidor
    socket.emit("registerUser", username, remitente_id);

    socket.on("updateUserList", (users) => {
        console.log("Lista de usuarios actualizada:", users);
        const userList = document.getElementById("userList");
        userList.innerHTML = ""; // Limpiar la lista actual

        users.forEach((user) => {
            // Validar que user no sea nulo y tenga los campos necesarios
            if (!user || !user.username || !user.remitente_id) {
                console.warn("Datos de usuario incompletos:", user);
                return; // O maneja el caso de otra manera
            }

            const card = document.createElement("div");
            card.className = "card";

            const usernameDisplay = user.username || "Usuario Desconocido";
            const remitenteIdDisplay = user.remitente_id || "ID Desconocido";

            card.innerHTML = `
                <div class="card-border-top"></div>
                <div class="img"></div>
                <span>${usernameDisplay}</span>
                <p class="job">En línea</p>
                <button type="button" data-bs-toggle="modal" data-bs-target="#exampleModal" data-username="${usernameDisplay}" data-destinatario-id="${remitenteIdDisplay}">Chatear</button>`;
            userList.appendChild(card);
        });

        // Verificar si el destinatario actual sigue conectado
        if (
            currentDestinatarioId &&
            !users.some((user) => user.remitente_id === currentDestinatarioId)
        ) {
            // Opcional: Cerrar el modal o notificar al usuario
            const modalElement = document.getElementById("exampleModal");
            const modalInstance = bootstrap.Modal.getInstance(modalElement);
            if (modalInstance) {
                modalInstance.hide();
            }
            toastr.warning(
                "El usuario con el que estabas chateando se ha desconectado."
            );
            currentDestinatarioId = null;
        }
    });

    document.addEventListener("click", (event) => {
        if (event.target.matches('button[data-bs-toggle="modal"]')) {
            const username = event.target.getAttribute("data-username");
            currentDestinatarioId = event.target.getAttribute(
                "data-destinatario-id"
            );

            // Limpiar los mensajes del chat antes de cambiar destinatario
            const messagesDiv = document.getElementById("messages");
            messagesDiv.innerHTML = ""; // Limpiar mensajes

            // Emitir el evento para establecer el destinatario en el servidor
            socket.emit("setDestinatario", currentDestinatarioId);

            // Actualizar el contenido del modal con el nombre del usuario
            const modalTitle = document.getElementById("exampleModalLabel");
            modalTitle.textContent = `Chatear con -> ${username}`;
        }else if (event.target.matches('#desconectarse') || event.target.closest('#desconectarse')) {
            console.log("Botón 'desconectarse' clicado");
            window.location.href = '/';
        }
    });

    const form = document.getElementById("form");
    const input = document.getElementById("input");

    form.addEventListener("submit", (e) => {
        e.preventDefault();
        if (input.value && currentDestinatarioId) {
            // Emitir el mensaje junto con el destinatario_id
            const messageContent = input.value;
            // Emitir el mensaje junto con el destinatario_id
            socket.emit("sendMessage", messageContent, currentDestinatarioId);

            // Agregar el mensaje al DOM como saliente
            const messages = document.getElementById("messages");
            const item = `
                <div class="message outgoing">
                    <p><strong>${messageContent}</strong></p>
                    <small>@${username}</small>
                </div>`;
            messages.insertAdjacentHTML("beforeend", item);
            messages.scrollTop = messages.scrollHeight; // Scroll hacia abajo

            input.value = "";
        }
    });

    // Escuchar mensajes recibidos
    socket.on(
        "receiveMessage",
        ({ username, message, isOutgoing, senderId }) => {
            const messages = document.getElementById("messages");

            // Verificar si el mensaje proviene del destinatario actual
            if (currentDestinatarioId === senderId) {
                const item = `<div class="message ${isOutgoing ? "outgoing" : "incoming"}">
                    <p><strong>${message}</strong></p>
                    <small>@${username}</small>
                </div>`;
                messages.insertAdjacentHTML("beforeend", item);

                // Scroll hacia abajo para mostrar el mensaje
                messages.scrollTop = messages.scrollHeight;

                scrollToBottom();
            } else {
                // Imprimir valores para depuración
                console.log(`senderId: ${senderId}, remitente_id: ${remitente_id}`);

                // Mostrar la notificación solo si el mensaje no fue enviado por el remitente actual
                if (senderId !== remitente_id) {
                    showNotification(username, message);
                } else {
                    console.log(
                        "No se muestra la notificación porque el remitente es el mismo que el usuario."
                    );
                }
            }
        }
    );

    function showNotification(username, message) {
        // Muestra una notificación de Toastr
        toastr.info(`${username}: ${message}`, "Nuevo Mensaje");
    }

    socket.on("chat message", (messageData) => {
        const { content, userId, remitenteUser } = messageData;
        const messagesDiv = document.getElementById("messages");
        let itemMensaje;

        if (userId == remitente_id) {
            itemMensaje = `<div class="message outgoing">
                <p><strong>${content}</strong></p>
                <small>@${remitenteUser}</small>
            </div>`;
        } else {
            itemMensaje = `<div class="message incoming">
                <p><strong>${content}</strong></p>
                <small>@${remitenteUser}</small>
            </div>`;
        }

        messagesDiv.insertAdjacentHTML("beforeend", itemMensaje);
        messagesDiv.scrollTop = messagesDiv.scrollHeight; // Asegúrate de que el scroll se ajuste
    });


});