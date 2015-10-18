var fs = require("fs");
var path = require("path");
var events = require("events");
var util = require('util');

function Bot() {
  events.EventEmitter.call(this);
  var that = this;
  fs.readdir("./commands", function(err, files) {
    if (err)
      throw err;

    that.commands = {};
    var init = [];

    for (var i = 0; i < files.length; i++) {
      if (path.extname(files[i]) == ".js") {
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
      }
    }
  });

  this.parseCmd = function(data) {
    var msg = data.text;
    if (msg[0] == "!") {
      var cmd = msg.substr(1).split(" ")[0];
      var args = msg.substr(2 + cmd.length).split(" ");

      if (typeof that.commands[cmd] == 'function' && that.commands.hasOwnProperty(cmd))
        return that.commands[cmd](that, data.nick, args, data);
    }
    return;
  }
}
util.inherits(Bot, events.EventEmitter);

module.exports = Bot;
