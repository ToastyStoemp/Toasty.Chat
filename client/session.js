//wss://hack.chat/chat-ws

var inviteRegex = / invited you to \?[a-z0-9]{8}$/;

function Session(server, channel, username, password, selector) {
    var that = this;
    this.server = server;
    this.channel = channel;
    this.selector = selector;
    if (password !== undefined)
        username += "#" + password;
    this.username = username;

    this.lastPoster = "";
    this.onlineUsers = [];
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
            that.pushMessage(args);
        },
        action: function(args) {
            args.text = args.nick + args.text.substr(3);
            args.nick = '*';
            pushMessage(args);
        },
        info: function(args) {
            args.nick = '*';
            pushMessage(args);
        },
        shout: function(args) {
            args.nick = "<Server>";
            pushMessage(args);
            if (disconnectCodes.indexOf(args.errCode) != -1)
                this.ws.close();
        },
        warn: function(args) {
            args.nick = '!';
            pushMessage(args);
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
            pushMessage({
                nick: '*',
                text: "Users online: " + nicks.join(", ")
            });
        },
        onlineAdd: function(args) {
            var nick = args.nick;
            var trip = args.trip;
            userAdd(nick, trip);
            if ($('#joined-left').is(":checked")) {
                pushMessage({
                    nick: '*',
                    text: nick + " joined"
                });
            }
        },
        onlineRemove: function(args) {
            var nick = args.nick;
            if ($('#joined-left').is(":checked")) {
                pushMessage({
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

Session.prototype.pushMessage = function(args, usePre) {
    var messageEl = document.createElement('div');
    messageEl.classList.add('message');
    if (args.admin && args.nick != '*') {
        messageEl.classList.add('admin');
    } else if (args.nick == this.username) {
        messageEl.classList.add('me');
    } else if (args.nick == '!') {
        messageEl.classList.add('warn');
    } else if (args.nick == '*') {
        if (args.cmd == 'action') {
            this.lastPoster = '';
            messageEl.classList.add('action');
        } else {
            messageEl.classList.add('info');
        }
    } else if (args.nick == '<Server>') {
        messageEl.classList.add('shout');
    }

    if (args.elementId) { // for referencing special message
        var oldElement = document.getElementById(args.elementId);
        if (oldElement) oldElement.removeAttribute('id');
        messageEl.id = args.elementId;
        if (oldElement && args.replaceIfSameAsLast && oldElement ==
            lastMessageElement)
            oldElement.parentNode.removeChild(oldElement);
    }

    // Nickname
    var nickSpanEl = document.createElement('span');
    //if (args.trip && !args.admin)
    //nickSpanEl.style.color = onlineUsers[args.nick];
    nickSpanEl.classList.add('nick');
    messageEl.appendChild(nickSpanEl);

    if (args.trip && args.nick != this.lastPoster) {
        var tripEl = document.createElement('span');
        tripEl.textContent = args.trip + " ";
        tripEl.classList.add('trip');
        nickSpanEl.appendChild(tripEl);
    }

    if (args.nick) {
        if (args.llama && args.nick != this.lastPoster) {
            var llamaLinkEl = document.createElement('img');
            llamaLinkEl.src = "https://toastystoemp.com/m/1bb24b.png";
            llamaLinkEl.style.marginRight = "4px";
            llamaLinkEl.title = "Random Llama".toLocaleString();
            nickSpanEl.appendChild(llamaLinkEl);
        }

        var nickLinkEl = document.createElement('a');
        if (args.whisperTo && this.lastPoster.substr(0, 3) != "to ") {
            nickLinkEl.textContent = "to " + args.target;
            nickLinkEl.onclick = function() {
                insertAtCursor(".w @" + args.target + " ");
                this.inputEl.focus();
            }
        } else if (args.nick != this.lastPoster && !args.whisperTo) {
            nickLinkEl.textContent = args.nick;
            nickLinkEl.onclick = function() {
                if (args.whisper)
                    insertAtCursor(".w @" + args.nick + " ");
                else
                    insertAtCursor("@" + args.nick + " ");
                this.inputEl.focus();
            }
        }
        var date = new Date(args.time || Date.now());
        nickLinkEl.title = date.toLocaleString();
        nickSpanEl.appendChild(nickLinkEl);

        if (args.donator) {
            var donatorLinkEl = document.createElement('img');
            donatorLinkEl.src =
                "https://toastystoemp.com/public/donator-icon.png";
            donatorLinkEl.style.marginLeft = "8px";
            donatorLinkEl.title = "Donator".toLocaleString();
            nickSpanEl.appendChild(donatorLinkEl);
        }
    }

    // Text
    var textEl;
    if (usePre !== false) {
        textEl = document.createElement('pre');
        textEl.textContent = args.text;
    } else {
        textEl = document.createElement('div');
        textEl.innerHTML = args.text;
    }
    textEl.classList.add('text');

    links = [];
    //textEl.innerHTML = textEl.innerHTML.replace(/(\?|https?:\/\/|ts3server:\/\/)\S+?(?=[,.!?:)]?\s|$)/g, parseLinks);
    //textEl.innerHTML = textEl.innerHTML.replace(/```(.|\s)*```/g, parseCode)

    //textEl.innerHTML = markdown.toHTML(textEl.innerHTML);

    messageEl.appendChild(textEl);

    //Nick highligting
    if (!(args.nick == '!' || args.nick == '<Server>')) {
        for (var nick in this.onlineUsers) {
            var nickReg = new RegExp("(\\s|^)(@?" + nick + "\\b)", "i");
            if (nickReg.test(args.text)) {
                var matches = args.text.match(nickReg);
                var user = document.createElement('span');
                user.textContent = "@" + nick;
                user.style.color = onlineUsers[nick];
                try {
                    textEl.innerHTML = textEl.innerHTML.replace(matches[2], user.outerHTML);
                } catch (err) {
                    console.log(err.message);
                }
            }
        }
    }

    //Mentioning + whispering
    if (this.username && args.nick != '*' && !args.whisper) {
        if ((new RegExp("(\\s|^)(@?" + this.username + "\\b)|(\\s|^)(@\\*)\\s", "i"))
            .test(args.text)) {
            messageEl.classList.add('mention');
            if ($('#notifications').is(":checked") && !document.hasFocus())
                notifyMe(args.nick + " mentioned you", args.text, false);
        }
    } else if (args.whisper) {
        if (args.whisperAt)
            lastWhisper = args.nick;
        messageEl.classList.add('whisper');
        if ($('#notifications').is(":checked") && !document.hasFocus())
            notifyMe(args.nick + " mentioned you", args.text, false);
    }

    if (links.length != 0) {
        messageEl.appendChild(parseMedia());
    }

    // Scroll to bottom
    //var atBottom = isAtBottom();
    var selection = 'messages' + this.selector;
    document.getElementById(selection).append(messageEl);
    lastMessageElement = messageEl;
    //if (atBottom)
    //window.scrollTo(0, document.body.scrollHeight);

    this.lastPoster = args.whisper ? "to " + args.target : args.nick;
    //if (args.nick != '*')
    //unread += 1;
    //updateTitle();
}