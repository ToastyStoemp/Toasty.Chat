var math = require("mathjs");

var plot = function(bot, sender, args, data, client)
{
	var arg = args.join(" ");

	try
	{
		var func = math.eval(arg);

		if(typeof func != 'function')
			throw "Error: expression must be a function";

		var lines = [];
		for(var i = 4; i >= -4; i--)
		{
			lines[i] = "          |          ";
		}
		lines[5] = "          ^          ";
		lines[0] = "-------------------->";

		for(var i = -10; i <= 10; i++)
		{
			var result = func(i);
			result = Math.round(result);
			if(result > -5 && result < 5)
				lines[result] = lines[result].substr(0, i + 10) + "x" + lines[result].substr(i+11);
		}

		var out = [];
		for(var i = 5; i >= -5; i--)
		{
			out.push(lines[i]);
		}
		bot.sendAll(out.join("\n"), client);
	}
	catch(e)
	{
		bot.sendClient(e.toString(), client);
	}
};

module.exports = { plot: plot };
