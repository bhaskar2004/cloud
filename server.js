const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: ['https://finded.netlify.app', 'http://localhost:3000'],
        methods: ['GET', 'POST', 'OPTIONS'],
        credentials: true,
        allowedHeaders: ['*'],
    },
    allowEIO3: true, // For backward compatibility
});

const client = new OAuth2Client('51565630705-8tp5ar0uouqr70pannk4ptq38fquniir.apps.googleusercontent.com');
const PORT = process.env.PORT || 3000;

// Middleware
app.use(
    helmet({
        crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }, // Fix window.closed issues
    })
);

app.use(cors({
    origin: ['https://finded.netlify.app', 'http://localhost:3000'], // Allowed origins
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
}));

app.use(express.json()); // Parse JSON payload

// Handle preflight requests
app.options('*', cors());

// Basic Route
app.get('/', (req, res) => {
    res.send('Chat server is running');
});

// Google OAuth Login Endpoint
app.post('/api/login', async (req, res) => {
    try {
        const { credential } = req.body;
        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: '51565630705-8tp5ar0uouqr70pannk4ptq38fquniir.apps.googleusercontent.com',
        });

        const payload = ticket.getPayload();
        const userData = {
            userId: payload.sub,
            email: payload.email,
            profile: {
                name: payload.name,
                picture: payload.picture,
                givenName: payload.given_name,
                familyName: payload.family_name,
                locale: payload.locale,
                bio: '',
            },
        };

        res.json(userData);
    } catch (error) {
        console.error('Authentication error:', error);
        res.status(401).json({ message: 'Authentication failed' });
    }
});

// In-memory storage for users
const users = new Map();
const activeUsers = new Map();

// Socket.IO Handlers
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Handle user registration
    socket.on('register', (userData) => {
        const { userId, profile } = userData;
        activeUsers.set(userId, socket.id);
        users.set(userId, {
            ...profile,
            userId,
            lastSeen: new Date(),
            status: 'online',
        });
        console.log(`User registered: ${userId}`);
        io.emit('userList', Array.from(users.values()));
    });

    // Handle private messaging
    socket.on('privateMessage', (data) => {
        console.log('Private message received:', data);
        const recipientSocketId = activeUsers.get(data.recipientId);
        if (recipientSocketId) {
            io.to(recipientSocketId).emit('privateMessage', {
                senderId: data.senderId,
                senderProfile: data.senderProfile,
                message: data.message,
                timestamp: new Date(),
            });
        }
    });

    // Handle typing indication
    socket.on('typing', (data) => {
        const recipientSocketId = activeUsers.get(data.recipientId);
        if (recipientSocketId) {
            io.to(recipientSocketId).emit('userTyping', {
                senderId: data.senderId,
                isTyping: data.isTyping,
            });
        }
    });

    // Handle user disconnection
    socket.on('disconnect', () => {
        let disconnectedUser;
        for (const [userId, socketId] of activeUsers.entries()) {
            if (socketId === socket.id) {
                disconnectedUser = userId;
                break;
            }
        }

        if (disconnectedUser) {
            const user = users.get(disconnectedUser);
            if (user) {
                user.status = 'offline';
                user.lastSeen = new Date();
                io.emit('userStatusUpdate', {
                    userId: disconnectedUser,
                    status: 'offline',
                });
            }
            activeUsers.delete(disconnectedUser);
        }
        console.log('User disconnected:', socket.id);
    });
});

// Start Server
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
