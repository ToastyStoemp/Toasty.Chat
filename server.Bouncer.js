/* jshint asi: true */
/* jshint esnext: true */


var ws = require('ws');
var ChatClientBase = require('./server.ChatClientBase.js');
var util = require("util");


function BouncerClient(socket) {
    ChatClientBase.call(this);
    this.socket = socket;
}
util.inherits(BouncerClient, ChatClientBase);
BouncerClient.prototype.getId = function () {
    return this.socket;
};
BouncerClient.prototype.getIpAddress = function () {
    var ip = this.socket.upgradeReq.connection.remoteAddress;
    if (ip == "127.0.0.1" || ip == "::1") // only use forward ip when seeing local ips
        ip = this.socket.upgradeReq.headers['x-forwarded-for'] || ip; // fallback to local ip if not set
    return ip;
};
BouncerClient.prototype.close = function () {
    this.socket.close();
};
BouncerClient.prototype.send = function (causingClient, data) {
    data.time = Date.now(); // Add timestamp to command
    try {
        if (this.socket.readyState == ws.OPEN) {
            this.socket.send(JSON.stringify(data));
        }
    } catch (e) {
        // Ignore exceptions thrown by client.send()
    }
};


function Bouncer() {
    this.relays = {};
}
module.exports = function () {
    return new Bouncer();
};
Bouncer.prototype.initialize = function (config) {
    this.config = config;
};
Bouncer.prototype.run = function () {
    var server = new ws.Server({host: this.config.host, port: this.config.socketPort});
    console.log("Started bouncer on " + this.config.host + ":" + this.config.socketPort);
    var that = this;
    server.on('error', function (error) {
        console.error("Error in Bouncer:");
        console.error(error);
    });
    server.on('connection', function (socket) {
        var newClient = new BouncerClient(socket);
        socket.on('message', function (data) {
            var args = JSON.parse(data);
            console.log("Socket", args);
            switch (args.cmd) {
                case "join":
                    this.nick = args.nick;
                    this.pass = args.pass;
                    this.channel = args.channel.trim();
                    var relay = null;
                    if (that.relays.hasOwnProperty(this.nick) && that.relays[this.nick].hasOwnProperty(this.pass) && that.relays[this.nick][this.pass].hasOwnProperty(this.channel)) {
                        relay = that.relays[this.nick][this.pass][this.channel];
                        for (var idx in relay.memory) {
                            if (relay.memory.hasOwnProperty(idx)) {
                                this.send(relay.memory[idx].data);
                            }
                        }
                        relay.memory = [];
                        this.send(JSON.stringify({"cmd": "onlineSet", "nicks": relay.nicks, "trips": relay.trips}));
                    } else {
                        relay = new ws(that.config.wss);
                        relay.sockets = {};
                        that.relays[this.nick] = {};
                        that.relays[this.nick][this.pass] = {};
                        that.relays[this.nick][this.pass][this.channel] = relay;
                        relay.on("open", function () {
                            this.nick = socket.nick;
                            this.pass = socket.pass;
                            this.channel = socket.channel;
                            this.send(data);
                        });
                        relay.on("message", function (data) {
                            var args = JSON.parse(data);
                            console.log("Relay", args);
                            switch (args.cmd) {
                                case "warn":
                                    if (args.errCode === "E005" || args.errCode === "E003") {
                                        socket.nick = null;
                                    }
                                    break;
                                case "onlineSet":
                                    for (var socketId in this.sockets) {
                                        if (this.sockets.hasOwnProperty(socketId)) {
                                            this.sockets[socketId].send(data);
                                        }
                                    }
                                    this.memory = [];
                                    this.nicks = args.nicks;
                                    this.trips = args.trips;
                                    return;
                                    break;
                                case "onlineAdd":
                                    this.nicks.push(args.nick);
                                    this.trips.push(args.trip);
                                    break;
                                case "onlineRemove":
                                    var idx = this.nicks.indexOf(args.nick);
                                    this.nicks.splice(idx, 1);
                                    this.trips.splice(idx, 1);
                                    break;
                                case "ping":
                                    for (var socketId in this.sockets) {
                                        if (this.sockets.hasOwnProperty(socketId)) {
                                            socket.send(JSON.stringify({cmd: "pong"}));
                                        }
                                    }
                                    break;
                            }
                            if (this.hasOwnProperty("sockets") && this.sockets !== null && !this.sockets.isEmpty()) {
                                for (var socketId in this.sockets) {
                                    if (this.sockets.hasOwnProperty(socketId)) {
                                        var isOpened = false;
                                        while (!isOpened) {
                                            try {
                                                this.sockets[socketId].send(data);
                                                isOpened = true;
                                            } catch (e) {
                                                console.error(e);
                                            }
                                        }
                                    }
                                }
                            } else {
                                if (this.memory.length > that.config.memorySize) {
                                    var idx = 0;
                                    if (that.config.mentionHold) {
                                        for (; idx < this.memory.length && this.memory[idx].mention; idx++);
                                    }
                                    this.memory.splice(idx, 1);
                                }
                                var reg = new RegExp("@" + socket.nick + "(\\s|$)");
                                var mention = reg.test(data);
                                this.memory.push({"data": data, "mention": mention});
                            }
                        });
                        relay.on("close", function () {
                            console.log("Relay close");
                            try {
                                delete that.relays[this.nick][this.pass][this.channel];
                                if (that.relays[this.nick][this.pass].isEmpty()) {
                                    delete that.relays[this.nick][this.pass];
                                    if (that.relays[this.nick].isEmpty()) {
                                        delete that.relays[this.nick];
                                    }
                                }

                            } catch (e) {

                            }
                        });
                    }
                    this.socketId = new Date().getTime();
                    relay.sockets[this.socketId] = this;
                    return;
                    break;
                case "chat":
                    try {
                        var cmdReg = new RegExp("^" + that.config.commandChar + "([^\\s]+)(\\s|$)");
                        var potentialCmd = args.text.match(cmdReg)[1];
                        switch (potentialCmd) {
                            case "quit":
                                for (var socketId in that.relays[this.nick][this.pass][this.channel].sockets) {
                                    if (that.relays[this.nick][this.pass][this.channel].sockets.hasOwnProperty(socketId)) {
                                        socket.close();
                                    }
                                }
                                that.relays[this.nick][this.pass][this.channel].close();
                                delete that.relays[this.nick][this.pass][this.channel];
                                if (that.relays[this.nick][this.pass].isEmpty()) {
                                    delete that.relays[this.nick][this.pass];
                                    if (that.relays[this.nick].isEmpty()) {
                                        delete that.relays[this.nick];
                                    }
                                }
                                return;
                                break;
                        }
                    }
                    catch (e) {
                        // Nothing to see here, move along
                    }
                    break;
                case "verify":
                    this.send(JSON.stringify({"cmd": "verify", "valid": true}));
                    return;
                    break;
            }
            that.relays[this.nick][this.pass][this.channel].send(data);
        });
        socket.on('close', function () {
            console.log("Socket close");
            try {
                delete that.relays[this.nick][this.pass][this.channel].sockets[this.socketId];
                newClient.close();
            } catch (e) {

            }
        });
    });
};

Object.prototype.isEmpty = function () {
    return Object.keys(this).length === 0 && this.constructor === Object;
};