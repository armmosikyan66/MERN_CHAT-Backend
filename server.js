const express = require('express');
const app = express();
const userRoutes = require('./routes/userRoutes');
const User = require("./models/User");
const Message = require("./models/Message");

const rooms = ['general', 'tech', 'finance', 'crypto'];
const cors = require('cors');

app.use(express.urlencoded({extended: true}));
app.use(express.json({extended: true}));
app.use(cors());

app.use('/users', userRoutes);
require('./connection');

const PORT = process.env.PORT || 5001;

const server = require('http').createServer(app);

const io = require('socket.io')(server, {
    cors: {
        origin: 'http://localhost:3000',
        methods: ['GET', 'POST']
    }
});

app.get('/rooms', (req, res) => {
    res.json(rooms)
})

async function getLastMessagesFromRoom(room) {
    try {
        let roomMessages = await Message.aggregate([
            {$match: {to: room}},
            {$group: {_id: '$date', messagesByDate: {$push: '$$ROOT'}}}
        ]);

        return roomMessages;
    } catch (e) {
        console.log(e);
    }
}

function sortRoomMessagesByDate(messages) {
    return messages.sort(function (a, b) {
        let date1 = a._id.split('/');
        let date2 = b._id.split('/');

        date1 = date1[2] + date1[0] + date1[1];
        date2 = date2[2] + date2[0] + date2[1];

        return date1 < date2 ? -1 : 1
    });
}

// socket connection

io.on('connection', (socket) => {

    socket.on('new-user', async () => {
        const members = await User.find();
        io.emit('new-user', members);
    })

    socket.on('join-room', async (newRoom, previousRoom) => {
        try {
            socket.join(newRoom);
            socket.leave(previousRoom);
            let roomMessages = await getLastMessagesFromRoom(newRoom);

            roomMessages = sortRoomMessagesByDate(roomMessages);
            socket.emit('room-messages', roomMessages);
        } catch (e) {
            console.log(e);
        }
    })

    socket.on('message-room', async (room, content, sender, time, date) => {
        try {
            const newMessage = await Message.create({content, from: sender, time, date, to: room});
            let roomMessages = await getLastMessagesFromRoom(room);
            roomMessages = sortRoomMessagesByDate(roomMessages);
            // sending message to room
            io.to(room).emit('room-messages', roomMessages);

            socket.broadcast.emit('notifications', room);
        } catch (e) {
            console.log(e)
        }
    })

    app.delete('/logout', async (req, res) => {
        try {
            const {_id, newMessages} = req.body;
            const user = await User.findById(_id);
            const members = await User.find();

            user.status = "offline";
            user.newMessages = newMessages;

            await user.save();
            socket.broadcast.emit('new-user', members);

            res.status(200).send()
        } catch (e) {
            console.log(e);
            res.status(400).send();
        }
    })
})
server.listen(PORT, () => {
    console.log(`Server Running on Port: http://localhost:${PORT}`);
})