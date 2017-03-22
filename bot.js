var fs = require("fs");
var path = require("path");
var events = require("events");
var util = require('util');

function Bot(chatServerBase) {
    this.chatServerBase = chatServerBase;
    this.channelRestrictedCommands = {};
    events.EventEmitter.call(this);
    var that = this;
    fs.readdir("./commands", function(err, files) {
        if (err)
            throw err;

        that.perm = require('./data/requiredPerm.json');

        that.commands = {};
        var init = [];

        for (var i = 0; i < files.length; i++) {
            if (path.extname(files[i]) == ".js") {
                try {
                    var cmds = require("./commands/" + files[i]);

                    if (typeof cmds != 'object')
                        throw "Invalid command " + files[i];

                    if (typeof cmds.init == 'function') {
                        cmds.init(that);
                        init.push(cmds.init);
                        delete cmds.init;
                    }

                    for (var key in cmds) {
                        if (typeof cmds[key] != 'function')
                            throw "Invalid command " + files[i];
                        that.commands[key] = cmds[key];
                    }
                } catch (e) {
                    console.log("Error loading command " + files[i]);
                    console.log(e);
                }
            }
        }
    });

    this.restrictCommandToChannels = function(cmd, channelList) {
        this.channelRestrictedCommands[cmd] = channelList;
    };

    this.parseCmd = function(data, client) {
        var msg = data.text;
        var cmd = msg.substr(1).split(" ")[0];
        var args = msg.substr(2 + cmd.length).split(" ");

        var channelRestrictedCommand = this.channelRestrictedCommands[cmd];
        if (channelRestrictedCommand && channelRestrictedCommand.indexOf(client.channel) == -1) {
            that.sendClient("This command can not be executed in this channel", client);
            return;
        }

        if (typeof that.commands[cmd] == 'function' && that.commands.hasOwnProperty(cmd))
            if (that.verify(that, cmd, data, client))
                return that.commands[cmd](that, data.nick, args, data, client);
            else
                that.sendClient("You do not have the right permissions for this command", client);
        else
            that.sendClient("Unknown command, type !help or !h for a list of available commands", client);
        return;
    };

    this.verify = function(that, cmd, data, client) {
        if (that.perm[cmd] > 0) {
            if (data.mod || data.admin)
                return true;
            else
                return false;
        }
        if (that.perm[cmd] > 1) {
            if (data.admin)
                return true;
            else
                return false;
        }
        return true;
    };

    this.sendAll = function(text, client) {
        if (client) {
            var botData = { cmd: 'chat', text: text, nick: 'Bot' };
            this.chatServerBase.broadcast(null, botData, client.channel);
            return true;
        }
        console.log('missing parameter [client] in bot.sendAll()');
        return false;
    };
    this.sendClient = function(text, client) {
        if (client) {
            var botData = { cmd: 'chat', text: text, nick: 'Bot' };
            client.send(null, botData);
            return true;
        }
        console.log('missing parameter [client] in bot.sendClient()');
        return false;
    }
    this.sendWhisper = function(text, client, friend) {
        if (client) {
            var botData = { cmd: 'chat', text: text, nick: client.nick, target: friend.nick, whisper: true, whisperTo: true };
            client.send(null, botData);
            botData = { cmd: 'chat', text: text, nick: client.nick, whisper: true, whisperAt: true };
            friend.send(null, botData);
            return true;
        }
        console.log('missing parameter [client] in bot.sendWhisper()');
        return false;
    }
}
util.inherits(Bot, events.EventEmitter);

module.exports = Bot;