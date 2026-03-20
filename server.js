const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

let activeUsers = {};

// Favicon 404 fix
app.get('/favicon.ico', (req, res) => res.status(204).end());

app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

io.on('connection', (socket) => {
    console.log('🟢 New user connected:', socket.id);
    
    socket.on('update-location', (data) => {
        activeUsers[socket.id] = {
            userId: data.userId,
            lat: data.lat,
            lng: data.lng,
            socketId: socket.id,
            lastUpdate: new Date()
        };
        
        console.log(`📍 User ${data.userId}: ${data.lat}, ${data.lng}`);
        socket.broadcast.emit('user-moved', activeUsers[socket.id]);
        socket.emit('all-users', Object.values(activeUsers));
    });
    
    socket.on('disconnect', () => {
        console.log('🔴 User disconnected:', socket.id);
        if(activeUsers[socket.id]) {
            io.emit('user-left', activeUsers[socket.id].userId);
            delete activeUsers[socket.id];
        }
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`\n🚀 Server: http://localhost:${PORT}`);
    console.log('=================================\n');
});