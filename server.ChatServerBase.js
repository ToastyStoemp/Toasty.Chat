/* jshint asi: true */
/* jshint esnext: true */

var crypto = require('crypto');
var tor = require('tor-exits');
var triplist = require("./data/trips.json");

// Keeps multiple connections for a client
function MetaClient() {
    this.clients = [];
}
MetaClient.prototype.push = function(client) {
    this.clients.push(client);
};
MetaClient.prototype.remove = function(client) {
    this.clients.splice(this.clients.indexOf(client), 1);
};
MetaClient.prototype.send = function() {
    var args = arguments;
    this.clients.forEach(function(c) {
        c.send.apply(c, args);
    });
};
MetaClient.prototype.setClientConfigurationData = function(channel, nick, trip) {
    this.channel = channel;
    this.nick = nick;
    this.trip = trip;
};


function ChatServerBase() {
    this._connectedClients = { '': 0 }; // map: channel -> (lowerCaseNick -> ChatClientBase)
    this.bot = new(require('./bot.js'))(this);
    this.bot.restrictCommandToChannels('ascii', ['ascii']);
}
module.exports = function() {
    return new ChatServerBase();
};
ChatServerBase.prototype.initialize = function(config, version, AutoMod) {
    var that = this;
    that.AutoMod = AutoMod;
    that.config = config;
    that.version = version;
    that.nodes = [];
    tor.fetch(function(err, data) {
        if (err) return console.error(err);
        that.nodes = tor.parse(data);
    });
};
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
    return { '': 0 }; // return empty list
};
ChatServerBase.prototype.getClientOfChannel = function(nick, channel) {
    var clientsOfChannel = this._connectedClients[channel];
    if (clientsOfChannel !== void 0)
        for (var i in clientsOfChannel)
            if (clientsOfChannel[i].nick == nick)
                return clientsOfChannel[i];
    return;
};
ChatServerBase.prototype.addClientToChannel = function(channel, client, nick, trip) {
    var clientsOfChannel = this._connectedClients[channel];
    if (clientsOfChannel === void 0) {
        this._connectedClients[''] += 1; // increase channel count
        clientsOfChannel = this._connectedClients[channel] = { '': 0 }; // '' keeps the count of users
    }

    var existingMetaClient = clientsOfChannel[nick.toLowerCase()];
    if (existingMetaClient !== void 0) {
        if (existingMetaClient.trip !== trip)
            return false; // not allowed to log in
    } else {
        clientsOfChannel[''] += 1;
        existingMetaClient = clientsOfChannel[nick.toLowerCase()] = new MetaClient();
        existingMetaClient.setClientConfigurationData(channel, nick, trip); // everything is ok, set data
        this.broadcast(client, { cmd: 'onlineAdd', nick: nick, trip: trip }, channel);
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
            this.broadcast(client, { cmd: 'onlineRemove', nick: client.nick }, client.channel);
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
        if (this.AutoMod.frisk(client.getIpAddress(), 0)) { // probe for rate limit
            client.send(client, { cmd: 'warn', errCode: 'E001', text: "Your IP is being rate-limited or blocked." });
            return;
        }

        this.AutoMod.frisk(client.getIpAddress(), 1); // Penalize here, but don't do anything about it

        if (data.length > 65536) return; // ignore large packets

        var args;
        if ((typeof data) === 'string' || data instanceof String)
            args = JSON.parse(data);
        else
            args = data;

        var cmd = args.cmd;
        this.handleCommand(cmd, client, args);
    } catch (e) {
        console.warn(e.stack)
    }
};
ChatServerBase.prototype.broadcast = function(causingClient, data, channel) {
    var clientsOfChannel = this.getClientsOfChannel(channel);
    for (var i in clientsOfChannel) {
        if (i !== '')
            clientsOfChannel[i].send(causingClient, data);
    }
};
ChatServerBase.prototype.broadcastAll = function(causingClient, data) {
    var channelNames = this.getChannelNames();
    for (var i in channelNames) {
        var clientsOfChannel = this.getClientsOfChannel(channelNames[i]);
        for (var k in clientsOfChannel) {
            if (k !== '')
                clientsOfChannel[k].send(causingClient, data);
        }
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

ChatServerBase.prototype.generatePassword = function(nick) {
    var gPass = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (var i = 0; i < 21 + nick.length; i++)
        gPass += possible.charAt(Math.floor(Math.random() * possible.length));
    return gPass + "NEW";
};
ChatServerBase.prototype.handleCommand = function(command, client, args) {
    var self = this;

    // Commands usable by all users
    switch (command) {
        case 'ping':
            client.send(null, { cmd: 'pong' });
            return;
        case 'verify':
            if (self.nodes) {
                if (self.nodes.indexOf(client.getIpAddress()) == -1)
                    client.send(null, { cmd: 'verify', valid: (args.version == this.version) });
                else {
                    console.log("Tor client detected")
                    client.send(null, { cmd: 'warn', text: "Connection could not be established" });
                }
            } else {
                client.send(null, { cmd: 'warn', errCode: '666', text: "Something went wrong trying again." });
            }
            return;
        case 'join':
            var channel = String(args.channel).trim();
            var nick = String(args.nick).trim();
            var lowerCaseNick = nick.toLowerCase();

            // dont allow invalid or empty passwords
            if ((typeof args.pass) !== 'string' || args.pass === '')
                args.pass = this.generatePassword(nick);
            var trip = this.hashPassword(args.pass);

            // if (this.AutoMod.frisk(client.getIpAddress(), 2) && !this.) {
            // 	send(client, {cmd: 'warn', errCode: 'E002', text: "You are joining channels too fast. Wait a moment and try again."}, this)
            // 	return
            // }


            if (client.nick) return; // Already joined
            if (channel === "") return; // Must join a non-blank channel


            // Process nickname
            if (!this.validateNickName(nick)) {
                client.send(null, {
                    cmd: 'warn',
                    errCode: 'E003',
                    text: "Nickname must consist of up to 24 letters, numbers, and underscores"
                });
                return;
            }

            if (lowerCaseNick === this.config.admin.toLowerCase()) {
                if (args.pass !== this.config.password) {
                    client.send(null, { cmd: 'warn', errCode: 'E004', text: "Cannot impersonate the admin" });
                    return;
                }
            }

            if (!this.addClientToChannel(channel, client, nick, trip)) {
                client.send(null, { cmd: 'warn', errCode: 'E005', text: "Nickname taken" });
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

            client.send(null, { cmd: 'onlineSet', nicks: nicks, trips: trips });

            return;
        case 'chat':
            var text = String(args.text);
            args.channel = String(client.channel);

            if (!client.channel) return;

            // strip newlines from beginning and end
            text = text.replace(/^\s*\n|^\s+$|\n\s*$/g, '');
            // replace 3+ newlines with just 2 newlines
            text = text.replace(/\n{3,}/g, "\n\n");
            if (!text) return;

            if (this.AutoMod.isStfud(client.getIpAddress())) {
                return;
            }

            var score = text.length / 83 / 4;
            if (this.AutoMod.frisk(client.getIpAddress(), score) && !client.admin) {
                client.send(null, {
                    cmd: 'warn',
                    errCode: 'E006',
                    text: "You are sending too much text. Wait a moment and try again.\nPress the up arrow key to restore your last message."
                });
                return;
            }

            var data = {
                cmd: 'chat',
                nick: client.nick,
                trip: client.trip,
                text: text,
                admin: this.AutoMod.isAdmin(client),
                donator: this.AutoMod.isDonator(client),
                llama: (Math.floor(Math.random() * 20) == 0 || client.nick.toLowerCase() == "llama")
            };
            if (typeof triplist[data.trip] != 'undefined')
                data.trip = triplist[data.trip];
            else
                data.trip = data.trip.substr(0, 6);

            // check for '/me' actions
            if (text[0] == '/' && text.substr(0, 4) == '/me ')
                data.cmd = 'action';

            if (text[0] != '.') {
                this.broadcast(client, data, client.channel);
            }

            if (text[0] == '!' || text[0] == '.') {
                try {
                    this.bot.parseCmd(data, client);
                } catch (e) {
                    if (text[0] == '.') {
                        this.broadcast(client, data, client.channel);
                    }

                    data.text = e.toString();
                    this.broadcast(client, data, client.channel);
                }
            }

            return;
        case 'invite':
            var nickToInvite = String(args.nick);
            if (!client.channel) return;

            if (this.AutoMod.frisk(client.getIpAddress(), 2)) {
                client.send(null, {
                    cmd: 'warn',
                    errCode: 'E007',
                    text: "You are sending invites too fast. Wait a moment before trying again."
                });
                return;
            }

            var friend = this.getClientsOfChannel(client.channel)[nickToInvite.toLowerCase()];
            if (!friend) {
                client.send(null, { cmd: 'warn', errCode: 'E008', text: "Could not find user in channel" });
                return
            }
            if (friend.nicks === client.nick) return; // Ignore silently

            var channel = Math.random().toString(36).substr(2, 8);
            client.send(null, {
                cmd: 'info',
                infoCode: 'I001',
                channel: channel,
                text: "You invited " + friend.nick + " to ?" + channel
            });
            friend.send(null, {
                cmd: 'info',
                infoCode: 'I002',
                channel: channel,
                text: client.nick + " invited you to ?" + channel
            });

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

            client.send(null, {
                cmd: 'info',
                infoCode: 'I003',
                text: numberOfIps + " unique IPs in " + channelNames.length + " channels"
            });

            return;
    }

    // Commands usable by all mods
    if (this.AutoMod.isMod(client)) {
        switch (command) {
            case 'kick':
                var nick = String(args);
                if (!client.channel) return;

                var badClient = this.getClientsOfChannel(client.channel)[nick.toLowerCase()];
                if (!badClient) {
                    client.send(null, { cmd: 'warn', errCode: 'E009', text: "Could not find " + nick });
                    return;
                }
                if (this.AutoMod.isMod(badClient)) {
                    client.send(null, { cmd: 'warn', errCode: 'E010', text: "Cannot kick moderator" });
                    return;
                }
                console.log(client.nick + " [" + client.trip + "] kicked " + nick + " in " + client.channel);
                this.broadcast(client, {
                    cmd: 'info',
                    infoCode: 'I004',
                    nick: nick,
                    text: "Kicked " + nick
                }, client.channel);

                //Kick the client
                badClient.clients.forEach(function(c) {
                    c.send(null, { cmd: 'close' });
                    self.AutoMod.dump(c.getIpAddress(), args.time);
                });
                return;
            case 'ban':
                var nick = String(args);
                if (!client.channel) return;

                var badClient = this.getClientsOfChannel(client.channel)[nick.toLowerCase()];
                if (!badClient) {
                    client.send(null, { cmd: 'warn', errCode: 'E009', text: "Could not find " + nick });
                    return;
                }
                if (this.AutoMod.isMod(badClient)) {
                    client.send(null, { cmd: 'warn', errCode: 'E010', text: "Cannot ban moderator" });
                    return;
                }
                console.log(client.nick + " [" + client.trip + "] banned " + nick + " in " + client.channel);
                this.broadcast(client, {
                    cmd: 'info',
                    infoCode: 'I004',
                    nick: nick,
                    text: "Banned " + nick
                }, client.channel);

                //Ban the client
                badClient.clients.forEach(function(c) {
                    c.send(null, { cmd: 'dataSet', bSet: true });
                    c.send(null, { cmd: 'close' });
                    self.AutoMod.arrest(c.getIpAddress(), args.time);
                });
                return;
            case 'mute':
                var nick = String(args);
                if (!client.channel) return;

                var badClient = this.getClientsOfChannel(client.channel)[nick.toLowerCase()];
                if (!badClient) {
                    client.send(null, { cmd: 'warn', errCode: 'E009', text: "Could not find " + nick });
                    return;
                }
                if (this.AutoMod.isMod(badClient)) {
                    client.send(null, { cmd: 'warn', errCode: 'E010', text: "Cannot mute moderator" });
                    return;
                }

                badClient.clients.forEach(function(c) {
                    c.send(null, { cmd: 'dataSet', mSet: true });
                    self.AutoMod.stfu(c.getIpAddress(), args.time);
                });
                console.log(client.nick + " [" + client.trip + "] muted  " + nick + " in " + client.channel);
        }
    }

    // Commands usable by all admins
    if (this.AutoMod.isAdmin(client)) {
        switch (command) {
            case 'play':
                var url = args.url.trim();
                this.broadcast(client, { cmd: 'play', nick: client.nick, trip: client.trip, url: url }, client.channel);
                return;
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
                client.send(null, { cmd: 'info', text: text });

                return;
            case 'broadcast':
                var text = args.join(' ');
                this.broadcastAll(client, { cmd: 'shout', infoCode: 'S001', text: "Server broadcast: " + text });
                return;
        }
    }
};