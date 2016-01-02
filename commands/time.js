var weather = require("weather-js");

var time = function(bot, sender, args, data, client)
{
	var arg = args.join(" ");

	var printOutput = function(diff, location)
	{
		var current = new Date();
		var offset = current.getTimezoneOffset() * 60 * 1000;

		var there = new Date(current.getTime() + offset + diff);

		bot.sendClient(there.toLocaleTimeString() + " - " + location, client);
	}

	if(typeof bot.config.timezones[args[0]] != 'undefined')
	{
		var zone = bot.config.timezones[args[0]];
		var diff = zone[1] * 60 * 60 * 1000;
		printOutput(diff, zone[0]);
	}
	else
	{
		weather.find({search: arg}, function(err, result)
		{
			if(err)
			{
				bot.sendClient("Error retrieving timezone. Usage !time <location> or !time <timezone>", client);
				return;
			}

			var diff = parseInt(result[0].location.timezone) * 60 * 60 * 1000;
			var name = result[0].location.name;
			printOutput(diff, name);
		});
	}
}

module.exports = { time: time };
