/* jshint asi: true */
/* jshint esnext: true */


version = "0.1a";


var fs = require('fs');
var ws = require('ws');
var net = require('net');
var ChatClientBase = require('./server.ChatClientBase.js');
var util = require("util");


function ToastyClient(ircClient, channelName) {
	ChatClientBase.call(this);
	this.channelName = channelName;
	this.ircClient = ircClient;

	var data = {cmd:'join', channel: channelName, nick: ircClient.nick, pass: ''};
	if (ircClient.password)
		data.pass = ircClient.password;

	this.ircClient.chatServerBase.onMessage(this, data);
}
util.inherits(ToastyClient, ChatClientBase);
ToastyClient.prototype.getId = function() {
	return this.ircClient;
}
ToastyClient.prototype.getIpAddress = function() {
	return this.ircClient.getRemoteAddress();
}
ToastyClient.prototype.close = function() {
	this.ircClient.chatServerBase.onClose(this);
//	this.ircClient.close();
}
ToastyClient.prototype._generateIdentifier = function(nick) {
	return nick+'!~'+nick+'@'+this.ircClient.config.serverHostname;
}
ToastyClient.prototype._getSystemUser = function() {
	return '&system';
}
ToastyClient.prototype.send = function(causingClient, data) {
	var self = this;
	data.time = Date.now(); // Add timestamp to command
	switch (data.cmd) {
		case 'onlineAdd':
			this.ircClient.write(':'+data.nick+' JOIN :#'+this.channelName);
			break;
		case 'onlineRemove':
			this.ircClient.write(':'+data.nick+' PART :#'+this.channelName);
			break;
		case 'onlineSet':
			data.nicks.forEach(function(nick) {
				if (nick !== self.ircClient.nick)
					self.ircClient.write(':'+nick+' JOIN :#'+self.channelName);
			});
			break;
		case 'shout':
			data.text.split('\n').forEach(function(line) {
				this.ircClient.write(':'+this._generateIdentifier(this._getSystemUser())+' PRIVMSG #'+this.channelName+' :'+line.replace('\r', ''));
			}, this);
			break;
		case 'chat':
			if (causingClient !== this) { // show only messages from different (specialized) clients
				data.text.split('\n').forEach(function(line) {
					this.ircClient.write(':'+this._generateIdentifier(data.nick)+' PRIVMSG #'+this.channelName+' :'+line.replace('\r', ''));
				}, this);
			}
			break;
		case 'warn':
			data.text.split('\n').forEach(function(line) {
				this.ircClient.write(':'+this._generateIdentifier(this._getSystemUser())+' PRIVMSG #'+this.channelName+' :'+line.replace('\r', ''));
			}, this);
			break;
		case 'info':
			data.text.split('\n').forEach(function(line) {
				this.ircClient.write(':'+this._generateIdentifier(this._getSystemUser())+' PRIVMSG #'+this.channelName+' :'+line.replace('\r', ''));
			}, this);
			break;
	}
	
	
	// @TODO: check for errors and disconnect/reconnect
}


function IrcServer() {
}
IrcServer.STATE = {
	initial: 0,
	ready: 1
};
module.exports = function() {
	return new IrcServer();
};
IrcServer.prototype.initialize = function(config) {
	this.config = config;
}
IrcServer.prototype.prepareRequest = function(line) {
	var args = line.split(" ");
	for (var i = 0; i < args.length; ++i) {
		if (args[i][0] == ':') {
			args[i] = args[i].substr(1);

			var rest = args.splice(i, args.length-i).join(" ");
			args.push(rest);
			break;
		}
	}
	return args;
}
IrcServer.prototype.run = function(chatServerBase) {
	var self = this;

	net.createServer(function(c) {
		var newIrcClient = new IrcClient(chatServerBase, c, self.config);

		c.on('data', function(data) {
			try {
				data = String(data); // always string data
				lines = data.split('\n');
				while (lines.length > 0) {
					var line = lines.shift().replace('\r', '');
					if (line.length === 0) continue;
					var args = self.prepareRequest(line);
					self.handleCommand(newIrcClient, args);
				}
			} catch(e) {
				console.error(e.stack); // @TODO: i normally don't yolo this hard
			}
		});
		c.on('end', function() {
			newIrcClient.close();
		});
		c.on('error', function() {
			newIrcClient.close();
		});
	}).listen(this.config.port, this.config.ip);
	console.log("Started irc server on " + this.config.ip + ":" + this.config.port);
}
IrcServer.prototype.handleCommand = function(client, args) {
	var command = args[0];
	switch(command) {
		case 'CAP':
			switch (args[1]) {
			case 'LS':
				client.answer('CAP * LS :multi-prefix');
				break;
			case 'REQ':
				client.requests.push(args.slice(2));
				if (client.requests.length > 20)
					server.killClient(client, KILLREASON.kill);
				break;
			case 'END':
				if (client.state != IrcServer.STATE.ready)
					break;
				client.requests.forEach(function(req) {
					switch (req[0]) {
					case ':multi-prefix':
						client.answer('CAP '+client.nick+' ACK '+req[0]);
					}
				});
				break;
			default:
				console.log('Unknown cap: '+args[1]);
			}
			return;
		case 'PASS':
			client.password = args[1];
			return;
		case 'NICK':
			if (client.state != IrcServer.STATE.initial) return;

			client.nick = args[1];
			client.state = IrcServer.STATE.ready;
			return;
		case 'USER':
			client.user = args[1];
			client.sendWelcome();
			return;
		case 'JOIN':
			if (client.state != IrcServer.STATE.ready) return;

			var channelString = args[1] || "";
			if (channelString.length === 0) return;
			var channelList = channelString.split(",");
			var keys = args[2];
			var keyList = (keys && keys.length > 0) ? keys.split(",") : [];
			channelList.forEach(function(channelName, i) {
				client.addChannel(channelName.substr(1));
			});
			return;
		case 'PART':
			if (client.state != IrcServer.STATE.ready) return;

			var channelString = args[1] || "";
			if (channelString.length === 0) return;
			var channelList = channelString.split(",");
			channelList.forEach(function(channelName) {
				client.removeChannel(channelName.substr(1));
			});
			return;
		case 'PING':
			client.answer('PONG '+this.config.servHostname+' :'+args[1]);
			return;
		case 'INVITE':
			if (client.state != IrcServer.STATE.ready) return;

			var channelName = args[1].substr(1);
			var message = args[2];

			var toastyClient = client.channels[channelName];
			if (toastyClient === void 0) return;

			client.chatServerBase.onMessage(toastyClient, {cmd: 'invite', nick: message});
			return;
		case 'PRIVMSG':
			if (client.state != IrcServer.STATE.ready) return;

			var channelName = args[1].substr(1);
			var message = args[2];

			var toastyClient = client.channels[channelName];
			if (toastyClient === void 0) return;

			client.chatServerBase.onMessage(toastyClient, {cmd: 'chat', channel: channelName, text: message});
			return;
		case 'QUIT':
			client.close();
			return;
	}
};


function IrcClient(chatServerBase, socket, config) {
	this.chatServerBase = chatServerBase;
	this.socket = socket;
	this.config = config;
	this.host = this.getRemoteAddress();
	this.requests = [];
	this.socketClosed = false;
	this.state = IrcServer.STATE.initial;
	this.channels = {};
	this.channelCount = 0;
	this.nick = null;
	this.guid = null;
}
IrcClient.prototype.close = function() {
	this.socketClosed = true;
	if (this.socket)
		this.socket.destroy();
	for (var i in this.channels)
		this.channels[i].close(); // cleanup channels
	this.channels = {};
	this.channelCount = 0;
}
IrcClient.prototype.write = function(data) {
	if (this.socketClosed) return;
	return this.socket.write(data+'\r\n');
}
IrcClient.prototype.getRemoteAddress = function() {
	return this.socket.remoteAddress;
}
IrcClient.prototype.getServerHostname = function() {
	return this.config.serverHostname;
}
IrcClient.prototype.getServerIdentifier = function(bExtended) {
	return this.nick+(bExtended?'!~'+this.user:'')+'@'+this.getServerHostname();
}
IrcClient.prototype.getIdentifier = function() {
	return this.nick+'!~'+this.user+'@'+this.getRemoteAddress();
}
IrcClient.prototype.setNickName = function(nick) {
	this.nick = nick;
}
IrcClient.prototype.sendWelcome = function() {
	this.answer('001 '+this.nick+' :Welcome to the fancy IRC server '+this.nick);
	this.answer('002 '+this.nick+' :Your host is '+this.config.serverHostname+' running version '+version);
	this.answer('003 '+this.nick+' :This server was created '+this.timeCreated);
	this.answer('004 '+this.nick+' '+this.config.serverHostname+' '+version);
}
IrcClient.prototype.addChannel = function(channelName) {
	// @TODO: check for valid channel name

	this.answerFrom('JOIN :#'+channelName, this.getIdentifier()); // notify irc client of success
	this.answer('353 '+this.nick+' = #'+channelName+' :@'+this.nick);
	this.answer('366 '+this.nick+' #'+channelName+' :End of NAMES list');
	if (this.channels[channelName] !== void 0) return; // already joined

	this.channels[channelName] = new ToastyClient(this, channelName);
	this.channelCount += 1;
}
IrcClient.prototype.removeChannel = function(channelName) {
	this.answerFrom('PART :#'+channelName, this.getIdentifier());
	if (this.channels[channelName] === void 0) return; // not joined yet

	this.channels[channelName].close();
	delete this.channels[channelName];
	this.channelCount -= 1;
}
IrcClient.prototype.answerSimple = function(str) {
	return this.write(str);
}
IrcClient.prototype.answerFrom = function(str, from) {
	return this.write(':'+from+' '+str);
}
IrcClient.prototype.answer = function(str) {
	this.answerFrom(str, this.getServerHostname());
}

