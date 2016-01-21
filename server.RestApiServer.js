/* jshint asi: true */
/* jshint esnext: true */


var ChatClientBase = require('./server.ChatClientBase.js');
var util = require("util");
var express = require("express");
var session = require('express-session');


var tokenChars = 'abcdefghijklmnopqrstuvwxyz0123456789';
function generateToken(clients) {
	var token;
	do {
		token = '';
		for (var i = 0; i < 32; ++i)
			token += tokenChars[Math.floor(Math.random()*tokenChars.length)];
	} while(clients[token] !== void 0);
	return token;
};

function RestClient(chatServerBase, clients, req) {
	this.clients = clients;
	this.chatServerBase = chatServerBase;
	this.updateTimeout(req);
	this.updateIp(req, chatServerBase.config.x_forwarded_for);
	this.token = req.session.id;
	this.clients[this.token] = this;
	this.storage = [];
}
util.inherits(RestClient, ChatClientBase);
RestClient.prototype.login = function(nick, channel) {
	this.nick = nick;
	this.channel = channel;
	/*var msg = {cmd:'join', channel: channel, nick: nick, pass: data.pass};
	chatServerBase.onMessage(this, msg);*/
};
RestClient.prototype.getId = function() {
	return this.ircClient;
};
RestClient.prototype.addToStorage = function(data) {
	this.storage.push(data);
};
RestClient.prototype.applyStorage = function(list) {
	while (this.storage.length > 0)
		list.push(this.storage.shift());
};
RestClient.prototype.updateTimeout = function(req) {
	var self = this;
	if (this.timeout !== void 0)
		clearTimeout(this.timeout);

	// 6 mins timeout, clients should ping at least every 4 mins	
	var nextTimeout = 6*60*1000;

	this.timeout = setTimeout(function() { self.close(); }, nextTimeout);
	req.session.cookie.expires = new Date(Date.now() + nextTimeout);
	req.session.cookie.maxAge = nextTimeout;
};
RestClient.prototype.updateIp = function(req, bForwardingEnabled) {
	if (bForwardingEnabled) {
		this.ip = req.get('x-forwarded-for') || req.ip;
	} else {
		this.ip = req.ip;
	}
};
RestClient.prototype.getIpAddress = function() {
	return this.ip;
};
RestClient.prototype.close = function() {
	clearTimeout(this.timeout);
	this.chatServerBase.onClose(this);
	delete this.clients[this.token];
};
RestClient.prototype.send = function(causingClient, data) {
	this.addToStorage(data);
};

function RestApiServer() {
}
module.exports = function() {
	return new RestApiServer();
};
RestApiServer.prototype.initialize = function(config) {
	this.config = config;
};
RestApiServer.prototype.run = function(chatServerBase) {
	this.chatServerBase = chatServerBase;
	var self = this;

	var app = express();
	var clients = {}; // token to client

	var secret = '';
	for(var i = 0; i < 32; ++i)
		secret += String.fromCharCode(Math.floor(Math.random()*26));

	app.use(session({
		genid: function(req) {
			return generateToken(clients) // use UUIDs for session IDs 
		},
		secret: secret,
		resave: true,
		rolling: true,
		saveUninitialized: true
	}));

	app.get('/', function(req, res) {
		res.send('');
	});
	app.get('/login', function(req, res) {
		var client = clients[req.session.id] = new RestClient(chatServerBase, clients, req);
		client.updateTimeout(req);
		client.updateIp(req, self.config.x_forwarded_for);
		res.send(JSON.stringify({results:[{login:'ok'}]}));
	});
	app.get('/logout', function(req, res) {
		var client = clients[req.session.id];
		if (client === void 0) {
			res.send('');
			return;
		}
		client.updateTimeout(req);
		client.updateIp(req, self.config.x_forwarded_for);

		var outData = {
			results: [
			]
		};
		client.applyStorage(outData.results);
		res.send(JSON.stringify(outData));
		client.close();
	});
	app.get('/ping', function(req, res) { // required at least 5 mins after last poll
		var client = clients[req.session.id];
		if (client === void 0) {
			res.send('');
			return;
		}
		client.updateTimeout(req);
		client.updateIp(req, self.config.x_forwarded_for);

		var outData = {
			results: [
				{cmd:'pong'}
			]
		};
		// dont move store on pings
		res.send(JSON.stringify(outData));
	});
	app.get('/poll', function(req, res) {
		var client = clients[req.session.id];
		if (client === void 0) {
			res.send('');
			return;
		}
		
		client.updateTimeout(req);
		client.updateIp(req, self.config.x_forwarded_for);

		var outData = {
			results: [
			]
		};
		client.applyStorage(outData.results);
		res.send(JSON.stringify(outData));
	});
	app.post('/send', function(req, res) {
		var client = clients[req.session.id];
		if (client === void 0) {
			res.send('');
			return;
		}

		var content = [];
		req.on('data', function (data) {
			content.push(data);
		});
		req.on('end', function() {
			var data = JSON.parse(content.join(''));

			chatServerBase.onMessage(client, data);

			client.updateTimeout(req);
			client.updateIp(req, self.config.x_forwarded_for);

			var outData = {
				results: [
				]
			};
			client.applyStorage(outData.results);
			res.send(JSON.stringify(outData));
		});
	});
	
	app.listen(this.config.port, this.config.ip);
	console.log("Started rest api server on " + this.config.ip + ":" + this.config.port);
};
