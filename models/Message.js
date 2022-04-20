const {Schema, model} = require('mongoose');

const MessageSchema = new Schema({
    content: String,
    from: Object,
    socketId: String,
    time: String,
    date: String,
    to: String
})

const Message = model("Message", MessageSchema);

module.exports = Message;