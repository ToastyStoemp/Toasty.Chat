/* jshint asi: true */
/* jshint esnext: true */


var ws = require('ws')
var ChatClientBase = require('./server.ChatClientBase.js');
var util = require("util");


function WebSocketClient(socket) {
	ChatClientBase.call(this);
	this.socket = socket;
}
util.inherits(WebSocketClient, ChatClientBase);
WebSocketClient.prototype.getId = function() {
	return this.socket;
}
WebSocketClient.prototype.getIpAddress = function() {
	var ip = this.socket.upgradeReq.connection.remoteAddress;
	if (ip == "127.0.0.1" || ip == "::1") // only use forward ip when seeing local ips
		ip = this.socket.upgradeReq.headers['x-forwarded-for'] || ip; // fallback to local ip if not set
	return ip;
}
WebSocketClient.prototype.close = function() {
	this.socket.close();
}
WebSocketClient.prototype.send = function(causingClient, data) {
	data.time = Date.now(); // Add timestamp to command
	try {
		if (this.socket.readyState == ws.OPEN) {
			this.socket.send(JSON.stringify(data));
		}
	} catch (e) {
		// Ignore exceptions thrown by client.send()
	}
}


function WebSocketServer() {
}
module.exports = function() {
	return new WebSocketServer();
};
WebSocketServer.prototype.initialize = function(config) {
	this.config = config;
}
WebSocketServer.prototype.run = function(chatServerBase) {
	this.server = new ws.Server({host: this.config.host, port: this.config.port})
	console.log("Started server on " + this.config.host + ":" + this.config.port)

	this.server.on('connection', function(socket) {
		var newClient = new WebSocketClient(socket);

		socket.on('message', function(data) {
			chatServerBase.onMessage(newClient, data);
		});
		socket.on('close', function() {
			newClient.close();
			chatServerBase.onClose(newClient);
		});
	});
}
