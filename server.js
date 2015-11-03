/* jshint asi: true */
/* jshint esnext: true */

var fs = require('fs')
var ws = require('ws')
var crypto = require('crypto')

var bot = new (require('./bot.js'))();

var config = {}
function loadConfig(filename) {
	try {
		var data = fs.readFileSync(filename, 'utf8')
		config = JSON.parse(data)
		console.log("Loaded config '" + filename + "'")
	}
	catch (e) {
		console.warn(e)
	}
}

var configFilename = 'config.json'
loadConfig(configFilename)
fs.watchFile(configFilename, {persistent: false}, function() {
	loadConfig(configFilename)
})


var server = new ws.Server({host: config.host, port: config.port})
console.log("Started server on " + config.host + ":" + config.port)

server.on('connection', function(socket) {
	socket.on('message', function(data) {
		try {
			// Don't penalize yet, but check whether IP is rate-limited
			if (POLICE.frisk(getAddress(socket), 0)) {
				send({cmd: 'warn', errCode: 'E001', text: "Your IP is being rate-limited or blocked."}, socket)
				return
			}
			// Penalize here, but don't do anything about it
			POLICE.frisk(getAddress(socket), 1)

			// ignore ridiculously large packets
			if (data.length > 65536) {
				return
			}
			var args = JSON.parse(data)
			var cmd = args.cmd
			var command = COMMANDS[cmd]
			if (command && args) {
				command.call(socket, args)
			}
		}
		catch (e) {
			console.warn(e.stack)
		}
	})

	socket.on('close', function() {
		try {
			if (socket.channel) {
				for (var client of server.clients) {
					if (client.nick == socket.nick) {
						client.connectionCounter--;
					}
				}
				socket.connectionCounter--;
				if (socket.connectionCounter == 0) {
					broadcast({cmd: 'onlineRemove', nick: socket.nick}, socket.channel)
				}
			}
		}
		catch (e) {
			console.warn(e.stack)
		}
	})
})

function send(data, client) {
	// Add timestamp to command
	data.time = Date.now()
	try {
		if (client.readyState == ws.OPEN) {
			client.send(JSON.stringify(data))
		}
	}
	catch (e) {
		// Ignore exceptions thrown by client.send()
	}
}

/** Sends data to all clients
channel: if not null, restricts broadcast to clients in the channel
*/
function broadcast(data, channel) {
	for (var client of server.clients) {
		if (channel ? client.channel === channel : client.channel) {
			send(data, client)
		}
	}
}

function nicknameValid(nick) {
	// Allow letters, numbers, and underscores
	return /^[a-zA-Z0-9_]{1,24}$/.test(nick)
}

function getAddress(client) {
	if (config.x_forwarded_for) {
		// The remoteAddress is 127.0.0.1 since if all connections
		// originate from a proxy (e.g. nginx).
		// You must write the x-forwarded-for header to determine the
		// client's real IP address.
		return client.upgradeReq.headers['x-forwarded-for']
	}
	else {
		return client.upgradeReq.connection.remoteAddress
	}
}

function hash(password) {
	var sha = crypto.createHash('sha256')
	sha.update(password + config.salt)
	return sha.digest('base64').substr(0, 10)
}

function isAdmin(client) {
	return client.nick == config.admin
}

function isMod(client) {
	if (isAdmin(client)) return true
	if (config.mods) {
		if (client.trip && config.mods.indexOf(client.trip) > -1) {
			return true
		}
	}
	return false
}


// `this` bound to client
var COMMANDS = {
	ping: function() {
		send({cmd: 'pong'}, this)
	},

	join: function(args) {
		var channel = String(args.channel)
		var nick = String(args.nick)
		var trip = hash(String(args.pass));


		// if (POLICE.frisk(getAddress(this), 2) && !this.) {
		// 	send({cmd: 'warn', errCode: 'E002', text: "You are joining channels too fast. Wait a moment and try again."}, this)
		// 	return
		// }

		if (this.nick) {
			// Already joined
			return
		}

		// Process channel name
		channel = channel.trim()
		if (!channel) {
			// Must join a non-blank channel
			return
		}

		// Process nickname
		if (!nicknameValid(nick)) {
			send({cmd: 'warn', errCode: 'E003', text: "Nickname must consist of up to 24 letters, numbers, and underscores"}, this)
			return
		}

		if (nick.toLowerCase() == config.admin.toLowerCase()) {
			if (args.pass != config.password) {
				send({cmd: 'warn', errCode: 'E004', text: "Cannot impersonate the admin"}, this)
				return
			}
		}

		var address = getAddress(this)
		var informClients = true;
		for (var client of server.clients) {
			if (client.channel === channel) {
				if (client.nick.toLowerCase() === nick.toLowerCase()) {
					if (client.trip !== trip) {
						send({cmd: 'warn', errCode: 'E005', text: "Nickname taken"}, this)
						return
					}
					client.connectionCounter++;
					this.connectionCounter = client.connectionCounter;
					informClients = false;
				}
			}
		}

		// Announce the new user and set connection counter to 1
		if (informClients) {
			this.connectionCounter = 1;
			broadcast({cmd: 'onlineAdd', nick: nick, trip: trip}, channel)
		}

		// Formally join channel
		this.channel = channel
		this.nick = nick
		this.trip = trip

		// Set the online users for new user
		var nicks = []
		var trips = []
		for (var client of server.clients) {
			if (client.channel === channel) {
				if (nicks.indexOf(client.nick) == -1) {
					nicks.push(client.nick)
					trips.push(client.trip)
				}
			}
		}
		send({cmd: 'onlineSet', nicks: nicks, trips: trips}, this)
	},

	chat: function(args) {
		var text = String(args.text)
		args.channel = this.channel;

		if (!this.channel) {
			return
		}
		// strip newlines from beginning and end
		text = text.replace(/^\s*\n|^\s+$|\n\s*$/g, '')
		// replace 3+ newlines with just 2 newlines
		text = text.replace(/\n{3,}/g, "\n\n")
		if (!text) {
			return
		}

		if (POLICE.isStfud(getAddress(this))) {
			send({cmd: 'warn', errCode: 'E006', text: "You are muted.\nPress the up arrow key to restore your last message."}, this)
			return
		}

		var score = text.length / 83 / 4
		if (POLICE.frisk(getAddress(this), score) && !this.admin) {
			send({cmd: 'warn', errCode: 'E006', text: "You are sending too much text. Wait a moment and try again.\nPress the up arrow key to restore your last message."}, this)
			return
		}


		var data = {cmd: 'chat', nick: this.nick, trip: this.trip, text: text}
		if (isAdmin(this)) {
			data.admin = true
		}

		broadcast(data, this.channel)

		var that = this;
		bot.send = function(text)
		{
			var botData = {
		      cmd: 'chat',
		      text: text,
		      nick: 'Bot'
		  	};
			broadcast(botData, that.channel);
		}
		bot.parseCmd(data);
	},

	invite: function(args) {
		var nick = String(args.nick)
		if (!this.channel) {
			return
		}

		if (POLICE.frisk(getAddress(this), 2)) {
			send({cmd: 'warn', errCode: 'E007', text: "You are sending invites too fast. Wait a moment before trying again."}, this)
			return
		}

		var friend
		for (var client of server.clients) {
			// Find friend's client
			if (client.channel == this.channel && client.nick == nick) {
				friend = client
				break
			}
		}
		if (!friend) {
			send({cmd: 'warn', errCode: 'E008', text: "Could not find user in channel"}, this)
			return
		}
		if (friend == this) {
			// Ignore silently
			return
		}
		var channel = Math.random().toString(36).substr(2, 8)
		send({cmd: 'info', infoCode: 'I001', channel: channel, text: "You invited " + friend.nick + " to ?" + channel}, this)
		send({cmd: 'info', infoCode: 'I002', channel: channel, text: this.nick + " invited you to ?" + channel}, friend)
	},

	stats: function(args) {
		var ips = {}
		var channels = {}
		for (var client of server.clients) {
			if (client.channel) {
				channels[client.channel] = true
				ips[getAddress(client)] = true
			}
		}
		send({cmd: 'info', infoCode: 'I003', text: Object.keys(ips).length + " unique IPs in " + Object.keys(channels).length + " channels"}, this)
	},

	// Moderator-only commands below this point

	kick: function(args) {
		if (!isMod(this)) {
			return
		}

		var nick = String(args.nick)
		if (!this.channel) {
			return
		}

		var badClient = server.clients.filter(function(client) {
			return client.channel == this.channel && client.nick == nick
		}, this)[0]

		if (!badClient) {
			send({cmd: 'warn', errCode: 'E009', text: "Could not find " + nick}, this)
			return
		}

		if (isMod(badClient)) {
			send({cmd: 'warn', errCode: 'E010', text: "Cannot kick moderator"}, this)
			return
		}

		POLICE.dump(getAddress(badClient))
		console.log(this.nick + " [" + this.trip + "] kicked " + nick + " in " + this.channel)
		broadcast({cmd: 'info', infoCode: 'I004', nick: nick, text: "Kicked " + nick}, this.channel)
	},

	ban: function(args) {
		if (!isMod(this)) {
			return
		}

		var nick = String(args.nick)
		if (!this.channel) {
			return
		}

		var badClient = server.clients.filter(function(client) {
			return client.channel == this.channel && client.nick == nick
		}, this)[0]

		if (!badClient) {
			send({cmd: 'warn', errCode: 'E009', text: "Could not find " + nick}, this)
			return
		}

		if (isMod(badClient)) {
			send({cmd: 'warn', errCode: 'E010', text: "Cannot ban moderator"}, this)
			return
		}

		POLICE.arrest(getAddress(badClient, args.time))
		console.log(this.nick + " [" + this.trip + "] banned " + nick + " in " + this.channel)
		broadcast({cmd: 'info', infoCode: 'I004', nick: nick, text: "Banned " + nick}, this.channel)
	},

	mute: function(args) {
		if (!isMod(this)) {
			return
		}

		var nick = String(args.nick)
		if (!this.channel) {
			return
		}

		var badClient = server.clients.filter(function(client) {
			return client.channel == this.channel && client.nick == nick
		}, this)[0]

		if (!badClient) {
			send({cmd: 'warn', errCode: 'E009', text: "Could not find " + nick}, this)
			return
		}

		if (isMod(badClient)) {
			send({cmd: 'warn', errCode: 'E010', text: "Cannot mute moderator"}, this)
			return
		}

		POLICE.stfu(getAddress(badClient, args.time))
		console.log(this.nick + " [" + this.trip + "] muted " + nick + " in " + this.channel)
		broadcast({cmd: 'info', infoCode: 'I004', nick: nick, text: "Muted " + nick}, this.channel)
	},

	// Admin-only commands below this point

	listUsers: function() {
		if (!isAdmin(this)) {
			return
		}
		var channels = {}
		for (var client of server.clients) {
			if (client.channel) {
				if (!channels[client.channel]) {
					channels[client.channel] = []
				}
				channels[client.channel].push(client.nick)
			}
		}

		var lines = []
		for (var channel of channels) {
			lines.push("?" + channel + " " + channels[channel].join(", "))
		}
		var text = server.clients.length + " users online:\n\n"
		text += lines.join("\n")
		send({cmd: 'info', text: text}, this)
	},

	broadcast: function(args) {
		if (!isAdmin(this)) {
			return
		}
		var text = String(args.text)
		broadcast({cmd: 'shout', infoCode: 'S001', text: "Server broadcast: " + text})
	},
}


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
		}
		catch (e) {
			return
		}
		for (var id of ids) {
			if (id && id[0] != '#') {
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
