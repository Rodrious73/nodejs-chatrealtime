// index.js
import express from 'express';
import logger from 'morgan';
import { createServer } from 'http';
import { socketHandler } from './socket.js'; // Importar lógica de Socket.IO
import db from './db.js'; // Importar la conexión a la base de datos
import dotenv from 'dotenv';

dotenv.config(); // Cargar variables de entorno

const app = express();
const port = 8085;

const server = createServer(app); // Crear el servidor HTTP

// Mantener un registro de los usuarios conectados
let connectedUsers = [];

app.use(logger('dev'));
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos desde el directorio 'public'
app.use('/static', express.static('static'));

// Ruta para la página de inicio
app.get('/', (req, res) => {
    res.sendFile(process.cwd() + '/client/index.html');
});

// Ruta para el inicio de sesión
app.post('/login', (req, res) => {
    const username = req.body.username;

    if (username) {
        const query = 'SELECT id, username FROM usuarios WHERE username = ?';
        
        db.query(query, [username], (error, results) => {
            if (error) {
                console.error('Error en la consulta a la base de datos:', error);
                res.redirect('/'); // Si hay error, redirigimos al inicio
                return;
            }

            if (results.length > 0) {
                const { id: remitente_id } = results[0];

                const updateQuery = 'UPDATE usuarios SET conectado = TRUE WHERE username = ?';

                db.query(updateQuery, [username], (err) => {
                    if (err) {
                        console.error('Error al actualizar el estado de conexión:', err);
                        res.redirect('/');
                        return;
                    }

                    // Añadir usuario a la lista de conectados
                    if (!connectedUsers.includes(username)) {
                        connectedUsers.push(username);
                    }

                    // Redirigir a /chat con el username y remitente_id
                    res.redirect(`/chat?username=${encodeURIComponent(username)}&remitente_id=${remitente_id}`);
                });
            } else {
                const insertQuery = 'INSERT INTO usuarios (username, conectado) VALUES (?, TRUE)';

                db.query(insertQuery, [username], (insertError, insertResults) => {
                    if (insertError) {
                        console.error('Error al insertar el nuevo usuario:', insertError);
                        res.redirect('/'); // Redirigimos al inicio si hay un error
                        return;
                    }

                    const remitente_id = insertResults.insertId; // Obtener el remitente_id generado

                    // Añadir usuario a la lista de conectados
                    connectedUsers.push(username);

                    // Redirigir a /chat con el username y remitente_id
                    res.redirect(`/chat?username=${encodeURIComponent(username)}&remitente_id=${remitente_id}`);
                });
            }
        });
    } else {
        res.redirect('/');
    }
});

// Ruta para la página de chat
app.get('/chat', (req, res) => {
    res.sendFile(process.cwd() + '/client/chat.html');
});

// Inicializar Socket.IO en el servidor
socketHandler(server, connectedUsers); // Pasar la lista de usuarios conectados y la db

// Iniciar el servidor
server.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
