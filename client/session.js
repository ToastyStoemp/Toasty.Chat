//wss://hack.chat/chat-ws

var inviteRegex = / invited you to \?[a-z0-9]{8}$/;

function Session(server, channel, username, password, element) {
    var that = this;
    this.server = server;
    this.channel = channel;
    this.element = element;
    if (password !== undefined)
        username += "#" + password;
    this.username = username;

    this.ignoredUsers = [];

    this.ws = new WebSocket(server);
    this.ws.onopen = function() {
        that.sendRaw({
            cmd: "join",
            channel: channel,
            nick: username
        });
        setInterval(function() {
            that.ping();
        }, 50000);
    };
    this.ws.onmessage = function(message) {
        try {
            lastPong = new Date();
            var args = JSON.parse(message.data);
            var cmd = args.cmd;
            var command = that.COMMANDS[cmd];
            if (command !== void 0)
                command.call(null, args);
            else
                console.log('Unknown command: ' + String(cmd));
        } catch (e) {
            return console.log(e);
        }
    };
    this.ws.onclose = function() {
        console.log('Connection closed');
    };
    this.COMMANDS = {
        pong: function(args) {
            // nothing to do
        },
        chat: function(args) {
            if (that.ignoredUsers.indexOf(args.nick) >= 0)
                return;
            pushMessage(that.element, args);
        },
        action: function(args) {
            args.text = args.nick + args.text.substr(3);
            args.nick = '*';
            pushMessage(this.element, args);
        },
        info: function(args) {
            args.nick = '*';
            pushMessage(this.element, args);
        },
        shout: function(args) {
            args.nick = "<Server>";
            pushMessage(this.element, args);
            if (disconnectCodes.indexOf(args.errCode) != -1)
                this.ws.close();
        },
        warn: function(args) {
            args.nick = '!';
            pushMessage(this.element, args);
            if (disconnectCodes.indexOf(args.errCode) != -1)
                this.ws.close();
        },
        onlineSet: function(args) {
            var nicks = args.nicks;
            var trips = args.trips;
            usersClear();
            for (var i = 0; i < nicks.length; i++) {
                userAdd(nicks[i], trips[i]);
            }
            pushMessage(this.element, {
                nick: '*',
                text: "Users online: " + nicks.join(", ")
            });
        },
        onlineAdd: function(args) {
            var nick = args.nick;
            var trip = args.trip;
            userAdd(nick, trip);
            if ($('#joined-left').is(":checked")) {
                pushMessage(this.element, {
                    nick: '*',
                    text: nick + " joined"
                });
            }
        },
        onlineRemove: function(args) {
            var nick = args.nick;
            if ($('#joined-left').is(":checked")) {
                pushMessage(this.element, {
                    nick: '*',
                    text: nick + " left"
                });
            }
            userRemove(nick);
        },
        dataSet: function(args) {
            if (args.bSet)
                bSelector = true;
            if (args.mSet)
                mSelector = true;
        },
        close: function() {
            ws.close();
        }
    }
}
Session.prototype.sendRaw = function(json) {
    try {
        if (this.ws.readyState == 1) {
            this.ws.send(JSON.stringify(json));
        } else {
            console.log("error", "Not connected.");
        }
    } catch (e) {
        console.log(e);
    }
};
Session.prototype.sendMessage = function(msg) {
    this.sendRaw({
        cmd: "chat",
        text: msg
    });
};
Session.prototype.invite = function(user) {
    this.sendRaw({
        cmd: "invite",
        nick: user
    });
};
Session.prototype.ping = function() {
    this.sendRaw({
        cmd: "ping"
    });
};
Session.prototype.leave = function() {
    this.ws.close();
};