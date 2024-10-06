// socket.js
import { Server } from "socket.io";
import db from './db.js'; // Importar la conexión a la base de datos

const connectedUsers = new Set(); // Almacenar usuarios conectados
const userSocketMap = new Map(); // Mapa para almacenar la relación usuario-socket

export const socketHandler = (server) => {
  const io = new Server(server, {
    connectionStateRecovery: {},
  });

  io.on("connection", (socket) => {
    console.log("Usuario conectado");

    socket.on('setDestinatario', (destinatario_id) => {
        // Establecer el destinatario actual
        socket.handshake.auth.destinatario_id = destinatario_id;
    
        // Recuperar mensajes ahora que tenemos el destinatario
        const remitente_id = socket.handshake.auth.remitente_id;
        console.log('Recuperando mensajes para remitente_id:', remitente_id, 'y destinatario_id:', destinatario_id);
    
        db.query(
            `SELECT m.*, 
                    u1.username AS remitente_username, 
                    u2.username AS destinatario_username 
             FROM mensajes m 
             JOIN usuarios u1 ON m.remitente_id = u1.id 
             JOIN usuarios u2 ON m.destinatario_id = u2.id 
             WHERE (m.remitente_id = ? AND m.destinatario_id = ?) 
                OR (m.remitente_id = ? AND m.destinatario_id = ?) 
             ORDER BY m.enviado_en ASC`,
            [remitente_id, destinatario_id, destinatario_id, remitente_id],
            (err, results) => {
                if (err) {
                    console.error('Error al obtener los mensajes', err);
                    return;
                }
    
                results.forEach((row) => {
                    console.log(`Mensaje: ${row.contenido}, Remitente: ${row.remitente_username}, Destinatario: ${row.destinatario_username}`);
                    // Emitir cada mensaje al cliente
                    socket.emit('chat message', {
                        content: row.contenido,
                        id: row.id.toString(),
                        userId: row.remitente_id,
                        remitenteUser: row.remitente_username, // Nombre del remitente
                    });
                });
            }
        );
    });    

    // Manejar el registro de usuarios
    socket.on("registerUser", (username, remitente_id) => {
      // Añadir remitente_id aquí
      connectedUsers.add(username); // Agregar el usuario a la lista
      userSocketMap.set(socket.id, { username, remitente_id }); // Asociar el socket con el nombre de usuario y remitente_id
      console.log(`Usuario registrado: ${username}, ID: ${remitente_id}`);

      // Emitir la lista actualizada a todos los clientes, excluyendo al usuario actual
      userSocketMap.forEach((user, id) => {
        const userList = Array.from(userSocketMap.values()).filter(
          (u) => u.username !== user.username
        );
        io.to(id).emit("updateUserList", userList);
      });
    });

    // Manejar la desconexión
    socket.on("disconnect", () => {
        const userInfo = userSocketMap.get(socket.id); // Obtener la información del usuario del mapa
        if (userInfo) {
          const username = userInfo.username; // Extraer el nombre de usuario
          connectedUsers.delete(username); // Eliminar el usuario de la lista
          userSocketMap.delete(socket.id); // Eliminar la asociación del socket con el usuario
          console.log(`Usuario desconectado: ${username}`); // Imprimir el nombre de usuario
      
          // Emitir la lista actualizada a todos los clientes, excluyendo al usuario actual
          userSocketMap.forEach((user, id) => {
            const userList = Array.from(userSocketMap.values()).filter(
              (u) => u.username !== user.username
            );
            io.to(id).emit("updateUserList", userList);
          });
        }
      });
      

    // Manejar los mensajes
    socket.on("sendMessage", (message, destinatario_id) => {
        const userInfo = userSocketMap.get(socket.id); // Obtener la información del usuario del mapa
        if (userInfo) {
            const { username, remitente_id } = userInfo; // Extraer el nombre de usuario y remitente_id
            console.log(`Mensaje de ${username} para ${destinatario_id}: ${message}`);

            // Insertar el mensaje en la base de datos
            const insertQuery = 'INSERT INTO mensajes (remitente_id, destinatario_id, contenido, enviado_en) VALUES (?, ?, ?, NOW())';
            db.query(insertQuery, [remitente_id, destinatario_id, message], (error, results) => {
                if (error) {
                    console.error('Error al insertar el mensaje:', error);
                    return;
                }
                console.log('Mensaje guardado con ID:', results.insertId);
            });

            // Emitir el mensaje al destinatario
            let destinatarioSocketId = null;
            userSocketMap.forEach((user, id) => {
                if (user.remitente_id === destinatario_id) {
                    destinatarioSocketId = id;
                }
            });

            if (destinatarioSocketId) {
                io.to(destinatarioSocketId).emit("receiveMessage", { username, message, isOutgoing: false, senderId: remitente_id });
            } else {
                console.log(`Destinatario con ID ${destinatario_id} no encontrado`);
            }

            // Emitir el mensaje al remitente
            io.to(socket.id).emit("receiveMessage", { username, message, isOutgoing: true, senderId: remitente_id });
        }
    });
  });
};
