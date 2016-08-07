/* jshint asi: true */
/* jshint esnext: true */


var ws = require('ws')

var WebSocketClient = require("./server.WebSocketClient.js");

function WebSocketServer() {
}
module.exports = function () {
    return new WebSocketServer();
};
WebSocketServer.prototype.initialize = function (config) {
    this.config = config;
};
WebSocketServer.prototype.run = function (chatServerBase) {
    this.server = new ws.Server({host: this.config.host, port: this.config.port});
    console.log("Started server on " + this.config.host + ":" + this.config.port);

    this.server.on('error', function (error) {
        console.error("Error in WebsocketServer:");
        console.error(error);
    });
    this.server.on('connection', function (socket) {
        var newClient = new WebSocketClient(socket);

        socket.on('message', function (data) {
            chatServerBase.onMessage(newClient, data);
        });
        socket.on('close', function () {
            newClient.close();
            chatServerBase.onClose(newClient);
        });
    });
};
