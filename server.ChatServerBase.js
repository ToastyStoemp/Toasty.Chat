/* jshint asi: true */
/* jshint esnext: true */

var crypto = require('crypto');
var bot = new (require('./bot.js'))();


// Keeps multiple connections for a client
function MetaClient() {
	this.clients = [];
}
MetaClient.prototype.push = function(client) {
	this.clients.push(client);
}
MetaClient.prototype.remove = function(client) {
	this.clients.splice(this.clients.indexOf(client), 1);
}
MetaClient.prototype.send = function() {
	var args = arguments;
	this.clients.forEach(function(c) { c.send.apply(c, args); });
}
MetaClient.prototype.setClientConfigurationData = function(channel, nick, trip) {
	this.channel = channel;
	this.nick = nick;
	this.trip = trip;
};


function ChatServerBase() {
	this._connectedClients = {'':0}; // map: channel -> (lowerCaseNick -> ChatClientBase)
}
module.exports = function() {
	return new ChatServerBase();
};
ChatServerBase.prototype.initialize = function(config) {
	this.config = config;
}
ChatServerBase.prototype.getEventQueue = function() {
	return this.eventQueue;
};
ChatServerBase.prototype.getChannelNames = function() {
	var channelNames = [];
	for (var i in this._connectedClients)
		if (i !== '') channelNames.push(i);
	return channelNames;
};
ChatServerBase.prototype.getClientsOfChannel = function(channel) {
	var clientsOfChannel = this._connectedClients[channel];
	if (clientsOfChannel !== void 0) return clientsOfChannel;
	return {'':0}; // return empty list
};
ChatServerBase.prototype.addClientToChannel = function(channel, client, nick, trip) {
	var clientsOfChannel = this._connectedClients[channel];
	if (clientsOfChannel === void 0) {
		this._connectedClients[''] += 1; // increase channel count
		clientsOfChannel = this._connectedClients[channel] = {'':0}; // '' keeps the count of users
	}

	var existingMetaClient = clientsOfChannel[nick.toLowerCase()];
	if (existingMetaClient !== void 0) {
		if (existingMetaClient.trip !== trip)
			return false; // not allowed to log in
	} else {
		clientsOfChannel[''] += 1;
		existingMetaClient = clientsOfChannel[nick.toLowerCase()] = new MetaClient();
		existingMetaClient.setClientConfigurationData(channel, nick, trip); // everything is ok, set data
		this.broadcast({cmd: 'onlineAdd', nick: nick, trip: trip}, channel);
	}

	client.setClientConfigurationData(channel, nick, trip); // everything is ok, set data

	existingMetaClient.push(client);

	return true;
};
ChatServerBase.prototype.removeClientFromChannel = function(channel, client) {
	var clientsOfChannel = this._connectedClients[channel];
	if (clientsOfChannel === void 0) return; // empty - nothing to do

	var metaClient = clientsOfChannel[client.nick.toLowerCase()];
	if (metaClient !== void 0) {
		metaClient.remove(client);
		if (metaClient.clients.length <= 0) {
			this.broadcast({cmd: 'onlineRemove', nick: client.nick}, client.channel);
			delete clientsOfChannel[client.nick.toLowerCase()];
			clientsOfChannel[''] -= 1; // decrease channel count
			if (clientsOfChannel[''] <= 0) {
				this._connectedClients[''] -= 1; // decrease user count
				delete this._connectedClients[channel];
			}
		}
	}
};
ChatServerBase.prototype.onClose = function(client) {
	this.removeClientFromChannel(client.channel, client);
};
ChatServerBase.prototype.onMessage = function(client, data) {
	try {
		if (POLICE.frisk(client.getIpAddress(), 0)) { // probe for rate limit
			client.send({cmd: 'warn', errCode: 'E001', text: "Your IP is being rate-limited or blocked."});
			return;
		}

		POLICE.frisk(client.getIpAddress(), 1); // Penalize here, but don't do anything about it

		if (data.length > 65536) return; // ignore large packets

		var args;
		if ((typeof data) === 'string' || data instanceof String)
			args = JSON.parse(data);
		else
			args = data;

		var cmd = args.cmd;
		this.handleCommand(cmd, client, args);
	}
	catch (e) {
		console.warn(e.stack)
	}
};
ChatServerBase.prototype.broadcast = function(data, channel) {
	var clientsOfChannel = this.getClientsOfChannel(channel);
	for(var i in clientsOfChannel) {
		if (i !== '')
			clientsOfChannel[i].send(data);
	}
};
ChatServerBase.prototype.validateNickName = function(nick) {
	return /^[a-zA-Z0-9_]{1,24}$/.test(nick); // Allow letters, numbers, and underscores
};
ChatServerBase.prototype.hashPassword = function(password) {
	var sha = crypto.createHash('sha256');
	sha.update(password + this.config.salt);
	return sha.digest('base64').substr(0, 10);
};
ChatServerBase.prototype.isAdmin = function(client) {
	return client.nick.toLowerCase() === this.config.admin.toLowerCase();
};
ChatServerBase.prototype.isMod = function(client) {
	if (!client.trip) return false;
	if (this.isAdmin(client)) return true;
	return this.config.mods && this.config.mods.indexOf(client.trip) >= 0;
};
ChatServerBase.prototype.handleCommand = function(command, client, args) {
	var self = this;

	// Commands usable by all users
	switch (command) {
		case 'ping':
			client.send({cmd: 'pong'});
			return;
		case 'join':
			var channel = String(args.channel).trim()
			var nick = String(args.nick).trim();
			var lowerCaseNick = nick.toLowerCase();
			var trip = this.hashPassword(String(args.pass));


			// if (POLICE.frisk(client.getIpAddress(), 2) && !this.) {
			// 	send({cmd: 'warn', errCode: 'E002', text: "You are joining channels too fast. Wait a moment and try again."}, this)
			// 	return
			// }


			if (client.nick) return; // Already joined
			if (channel === "") return; // Must join a non-blank channel


			// Process nickname
			if (!this.validateNickName(nick)) {
				client.send({cmd: 'warn', errCode: 'E003', text: "Nickname must consist of up to 24 letters, numbers, and underscores"});
				return;
			}

			if (lowerCaseNick === this.config.admin.toLowerCase()) {
				if (args.pass !== this.config.password) {
					client.send({cmd: 'warn', errCode: 'E004', text: "Cannot impersonate the admin"});
					return;
				}
			}

			if (!this.addClientToChannel(channel, client, nick, trip)) {
				client.send({cmd: 'warn', errCode: 'E005', text: "Nickname taken"});
				return;
			}

			// Set the online users for new user
			var nicks = [];
			var trips = [];
			var clientsOfChannel = this.getClientsOfChannel(channel);
			for (var i in clientsOfChannel) {
				someClient = clientsOfChannel[i];
				if (i === '' || someClient == client) continue;
				nicks.push(someClient.nick);
				trips.push(someClient.trip);
			}

			client.send({cmd: 'onlineSet', nicks: nicks, trips: trips});

			return;
		case 'chat':
			var text = String(args.text)
			args.channel = String(client.channel);

			if (!client.channel) return;

			// strip newlines from beginning and end
			text = text.replace(/^\s*\n|^\s+$|\n\s*$/g, '');
			// replace 3+ newlines with just 2 newlines
			text = text.replace(/\n{3,}/g, "\n\n");
			if (!text) return;

			if (POLICE.isStfud(client.getIpAddress())) {
				client.send({cmd: 'warn', errCode: 'E006', text: "You are muted.\nPress the up arrow key to restore your last message."});
				return;
			}

			var score = text.length / 83 / 4;
			if (POLICE.frisk(client.getIpAddress(), score) && !client.admin) {
				client.send({cmd: 'warn', errCode: 'E006', text: "You are sending too much text. Wait a moment and try again.\nPress the up arrow key to restore your last message."});
				return;
			}

			var data = {cmd: 'chat', nick: client.nick, trip: client.trip, text: text};
			if (this.isAdmin(client)) data.admin = true;

			this.broadcast(data, client.channel);
			bot.send = function(text)
			{
				var botData = {
				  cmd: 'chat',
				  text: text,
				  nick: 'Bot'
				};
				self.broadcast(botData, client.channel);
			}
			bot.parseCmd(data);

			return;
		case 'invite':
			var nickToInvite = String(args.nick);
			if (!client.channel) return;

			if (POLICE.frisk(client.getIpAddress(), 2)) {
				client.send({cmd: 'warn', errCode: 'E007', text: "You are sending invites too fast. Wait a moment before trying again."});
				return;
			}

			var friend = this.getClientsOfChannel(client.channel)[nickToInvite.toLowerCase()];
			if (!friend) {
				client.send({cmd: 'warn', errCode: 'E008', text: "Could not find user in channel"});
				return
			}
			if (friend === client) return; // Ignore silently

			var channel = Math.random().toString(36).substr(2, 8);
			client.send({cmd: 'info', infoCode: 'I001', channel: channel, text: "You invited " + friend.nick + " to ?" + channel});
			friend.send({cmd: 'info', infoCode: 'I002', channel: channel, text: client.nick + " invited you to ?" + channel});

			return;
		case 'stats':
			var channelNames = this.getChannelNames();
			var ips = {};
			var numberOfIps = 0;

			channelNames.forEach(function(channel) {
				var clientsOfChannel = self.getClientsOfChannel(channel);
				for (var i in clientsOfChannel) {
					var someClient = clientsOfChannel[i];
					if (ips[someClient.getIpAddress()] !== true) {
						ips[someClient.getIpAddress()] = true;
						numberOfIps += 1;
					}
				}
			});

			client.send({cmd: 'info', infoCode: 'I003', text: numberOfIps + " unique IPs in " + channelNames.length + " channels"});

			return;
	}

	// Commands usable by all mods
	if (this.isMod(client)) {
		switch (command) {
			case 'kick':
				var nick = String(args.nick)
				if (!client.channel) return;
				
				var badClient = this.getClientsOfChannel(client.channel)[nick.toLowerCase()];
				if (!badClient) {
					client.send({cmd: 'warn', errCode: 'E009', text: "Could not find " + nick});
					return;
				}
				if (this.isMod(badClient)) {
					client.send({cmd: 'warn', errCode: 'E010', text: "Cannot kick moderator"});
					return;
				}

				POLICE.dump(badClient.getIpAddress());
				console.log(client.nick + " [" + client.trip + "] kicked " + nick + " in " + client.channel);
				this.broadcast({cmd: 'info', infoCode: 'I004', nick: nick, text: "Kicked " + nick}, client.channel);

				return;
			case 'ban':
				var nick = String(args.nick);
				if (!client.channel) return;

				var badClient = this.getClientsOfChannel(client.channel)[nick.toLowerCase()];
				if (!badClient) {
					client.send({cmd: 'warn', errCode: 'E009', text: "Could not find " + nick});
					return;
				}
				if (this.isMod(badClient)) {
					client.send({cmd: 'warn', errCode: 'E010', text: "Cannot ban moderator"});
					return;
				}

				POLICE.arrest(badClient.getIpAddress(), args.time);
				console.log(client.nick + " [" + client.trip + "] banned " + nick + " in " + client.channel);
				this.broadcast({cmd: 'info', infoCode: 'I004', nick: nick, text: "Banned " + nick}, client.channel);

				return;
			case 'mute':
				var nick = String(args.nick);
				if (!client.channel) return;

				var badClient = this.getClientsOfChannel(client.channel)[nick.toLowerCase()];
				if (!badClient) {
					client.send({cmd: 'warn', errCode: 'E009', text: "Could not find " + nick});
					return;
				}
				if (this.isMod(badClient)) {
					client.send({cmd: 'warn', errCode: 'E010', text: "Cannot mute moderator"});
					return;
				}

				POLICE.stfu(badClient.getIpAddress(), args.time);
				console.log(client.nick + " [" + client.trip + "] muted " + nick + " in " + client.channel);
				this.broadcast({cmd: 'info', infoCode: 'I004', nick: nick, text: "Muted " + nick}, client.channel);
				
				return;
		}
	}

	// Commands usable by all admins
	if (this.isAdmin(client)) {
		switch (command) {
			case 'listUsers':
				var channelNames = this.getChannelNames();
				var clientCount = 0;
				
				var lines = [];
				channelNames.sort();
				channelNames.forEach(function(channel) {
					var clientNicks = [];
					var clientsOfChannel = self.getClientsOfChannel(channel);
					for (var i in clientsOfChannel) {
						if (i === '') continue;
						clientNicks.push(clientsOfChannel[i].nick);
					}
					lines.push("?" + channel + " " + clientNicks.join(", "));
					clientCount += clientNicks.length;
				});

				var text = clientCount + " users online:\n\n";
				text += lines.join("\n");
				client.send({cmd: 'info', text: text});

				return;
			case 'broadcast':
				var text = String(args.text);
				this.broadcast({cmd: 'shout', infoCode: 'S001', text: "Server broadcast: " + text});
				return;
		}
	}
};


// rate limiter
var POLICE = {
	records: {},
	halflife: 30000, // ms
	threshold: 15,

	loadJail: function(filename) {
		var ids
		try {
			var text = fs.readFileSync(filename, 'utf8')
			ids = text.split(/\r?\n/)
		} catch (e) {
			return
		}
		for (var i in ids) {
			if (ids[i] && ids[i][0] != '#') {
				this.arrest(id)
			}
		}
		console.log("Loaded jail '" + filename + "'")
	},

	search: function(id) {
		var record = this.records[id]
		if (!record) {
			record = this.records[id] = {
				time: Date.now(),
				score: 0,
			}
		}
		return record
	},

	frisk: function(id, deltaScore) {
		var record = this.search(id)
		if (record.arrested || record.dumped) {
			return true
		}

		record.score *= Math.pow(2, -(Date.now() - record.time)/POLICE.halflife)
		record.score += deltaScore
		record.time = Date.now()
		if (record.score >= this.threshold) {
			return true
		}
		return false
	},

	arrest: function(id, time) {
		var record = this.search(id)
		if (record) {
			record.arrested = true
			if (time)
				setTimeout(function(){ record.arrested = false }, time * 1000);
		}
	},

	dump: function(id) {
		var record = this.search(id)
		if (record) {
			record.dumped = true;
			setTimeout(function(){ record.dumped = false }, 30 * 1000);
		}
	},

	stfu: function(id, time) {
		time = typeof time !== 'undefined' ? time : 60;
		var record = this.search(id)
		if (record) {
			record.stfud = true;
			setTimeout(function(){ record.stfud = false }, time * 1000);
		}
	},

	isStfud: function(id) {
		var record = this.search(id)
		if (record)
			return record.stfud;
	},
}

POLICE.loadJail('jail.txt')
