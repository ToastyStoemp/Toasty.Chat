var ascii = require("figlet");

var createAsciiArt = function(bot, sender, args, data, client)
{
	var text = args.join(" ");

	ascii(text, function(err, result)
	{
		if(err)
		{
			bot.sendClient("Error creating ascii art :(", client);
			return;
		}

		bot.sendAll(result, client);
	});
}

module.exports = {ascii: {action: createAsciiArt, man: "Syntax is !ascii <text>; turns <text> into ascii art."}};
