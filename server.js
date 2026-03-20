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

// Favicon fix
app.get('/favicon.ico', (req, res) => res.status(204).end());

// IMPORTANT: Static files serve karo
app.use(express.static(path.join(__dirname, 'public')));

// IMPORTANT: Root route - index.html serve karo
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Agar koi aur route ho to bhi index.html bhejo (SPA support)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

io.on('connection', (socket) => {
    console.log('🟢 User connected:', socket.id);
    io.emit('user-count', Object.keys(activeUsers).length);
    
    socket.on('update-location', (data) => {
        activeUsers[socket.id] = {
            userId: data.userId,
            lat: data.lat,
            lng: data.lng,
            socketId: socket.id
        };
        
        socket.broadcast.emit('user-moved', activeUsers[socket.id]);
        socket.emit('all-users', Object.values(activeUsers));
        io.emit('user-count', Object.keys(activeUsers).length);
    });
    
    socket.on('disconnect', () => {
        if(activeUsers[socket.id]) {
            io.emit('user-left', activeUsers[socket.id].userId);
            delete activeUsers[socket.id];
            io.emit('user-count', Object.keys(activeUsers).length);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 Open: http://localhost:${PORT}`);
});