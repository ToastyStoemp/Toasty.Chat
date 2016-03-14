var fs = require("fs");

function reload(bot, sender, args, data, client) {
	fs.readdir("./commands", function (err, files) {
		if (err) {
			bot.sendClient("An error occurred! " + err.toString(), client);
			return;
		}
		bot.commands = {};
		var init = [];
		bot.makeCmd(files, bot, init);
		var owns = require("./../data/ownCommands.json");
		for(var i in owns) {
			bot.commands[i] = function (bot, sender, args, data, client)
			{
				var _output = owns[i];

				var replace = function(oldText, newText)
				{
					if(_output.indexOf(oldText) !== -1)
						_output = _output.replace(oldText, newText);
				}

				replace("%url%", bot.url);
				replace("%channel%", bot.channel);
				replace("%self%", bot.nick);
				replace("%sender%", sender);

				for(var i = 0; i < args.length; i++)
				{
					if(args[i].trim() != "")
						replace("%" + i + "%", args[i]);
				}
				if(/%[0-9]+%/g.test(_output))
				{
					bot.sendClient("@" + sender + " not enough arguments!", client);
					return;
				}


				bot.sendAll(_output, client);
			}
		}
	});
}

module.exports = {
	reload: reload
};
