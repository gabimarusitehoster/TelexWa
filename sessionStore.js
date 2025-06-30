
const fs = require('fs');
const path = require('path');

const storePath = path.join(__dirname, 'connectedUsers.json');
let connectedUsers = {};

function load() {
    if (fs.existsSync(storePath)) {
        connectedUsers = JSON.parse(fs.readFileSync(storePath));
    }
}

function save() {
    fs.writeFileSync(storePath, JSON.stringify(connectedUsers, null, 2));
}

function add(chatId, phoneNumber) {
    if (!connectedUsers[chatId]) connectedUsers[chatId] = [];
    if (!connectedUsers[chatId].some(u => u.phoneNumber === phoneNumber)) {
        connectedUsers[chatId].push({ phoneNumber, connectedAt: Date.now() });
        save();
    }
}

function remove(chatId, phoneNumber) {
    if (connectedUsers[chatId]) {
        connectedUsers[chatId] = connectedUsers[chatId].filter(u => u.phoneNumber !== phoneNumber);
        save();
    }
}

function list(chatId) {
    return connectedUsers[chatId] || [];
}

function all() {
    return connectedUsers;
}

load();

module.exports = { add, remove, list, all, load };