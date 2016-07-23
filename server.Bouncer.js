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
        var newClient = new WebSocketClient(socket);
        socket.on('message', function (data) {
            var args = JSON.parse(data);
            switch (args.cmd) {
                case "join":
                    socket.nick = args.nick;
                    socket.pass = args.pass;
                    socket.channel = args.channel.trim();
                    var relay = null;
                    if (that.relays.hasOwnProperty(args.nick) && that.relays[args.nick].hasOwnProperty(args.pass) && that.relays[args.nick][args.pass].hasOwnProperty(args.channel)) {
                        relay = that.relays[args.nick][args.pass][args.channel];
                    } else {
                        relay = new ws({host: that.config.wss});
                        relay.on("open", function () {
                            //TODO: What to do, what to do?
                        });
                        relay.on("message", function (data) {
                            var args = JSON.parse(data);
                            switch (args.cmd) {
                                case "warn":
                                    if (errCode === "E005" || errCode === E003) {
                                        socket.nick = null;
                                    }
                                    break;
                                case "onlineSet":
                                    if (this.hasOwnProperty("memory")) {
                                        for (var idx in this.memory) {
                                            socket.send(this.memory[idx]);
                                        }
                                    } else {
                                        this.memory = [];
                                        that.relays[args.nick] = {};
                                        that.relays[args.nick][args.pass] = {};
                                        that.relays[args.nick][args.pass][args.channel] = this;
                                    }
                                    break;
                            }
                            if (this.socket !== null) {
                                socket.send(data);
                            } else {
                                this.memory.push(data);
                            }
                        });
                    }
                    relay.socket = this;
                    break;
                case "chat":
                    try {
                        var potentialCmd = args.text.split(" ")[0].split(that.config.commandChar)[1];
                        if (potentialCmd === "quit") {
                            delete that.relays[args.nick][args.pass][args.channel];
                            if (that.relays[args.nick][args.pass].isEmpty()) {
                                delete that.relays[args.nick][args.pass];
                                if (that.relays[args.nick].isEmpty()) {
                                    delete that.relays[args.nick];
                                }
                            }
                            this.close();
                            return;
                        }
                    }
                    catch (e) {
                        // Nothing to see here, move along
                    }
                    break;
            }
            relay.send(data);
        });
        socket.on('close', function () {
            socket.relay.socket = null;
            newClient.close();
        });
    });
};

Object.prototype.isEmpty = function () {
    return Object.keys(obj).length === 0 && obj.constructor === Object;
};