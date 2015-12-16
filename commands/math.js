var math = require("mathjs");

var mathCommand = function(bot, sender, args, data, client)
{
	try
	{
		var arg = args.join(" ");
		var result = math.eval(arg);

		if(typeof result == 'function')
		{
			bot.sendClient("Cannot output function. Try " + arg + "; " + result.name + "(...)", client);
			return;
		}

		bot.sendAll("Result: " + result.toString(), client);
	}
	catch(e)
	{
		bot.sendClient(e.toString(), client);
	}
};

module.exports = {math: mathCommand};
