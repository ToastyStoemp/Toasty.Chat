var weather = require("weather-js");

var weatherCommand = function(bot, sender, args, data, client)
{
	var degreeType = "C";
	var location;

	if(args[args.length - 1] == "C" || args[args.length - 1] == "F")
	{
		degreeType = args[args.length - 1];
		location = args.slice(0, args.length - 1).join(" ");
	}
	else
	{
		location = args.join(" ");
	}

	weather.find({search: location, degreeType: degreeType}, function(err, result)
	{
		if(err)
		{
			bot.sendClient("Error retrieving weather. Usage: !weather <location ...> [C|F]", client);
			return;
		}

		result = result[0];
		var degree = "°" + result.location.degreetype;

		var message = "Showing weather for " + result.location.name + "\n" +
			"Current: " + result.current.temperature + degree + " - " + result.current.skytext + "\n";

		for(var i = 0; i < 3 && i < result.forecast.length; i++)
		{
			var data = result.forecast[i];
			message += data.day + ": " + data.low + degree + " to " + data.high + degree + " - " + data.skytextday + "\n";
		}
		bot.sendClient(message, client);
	});
};

module.exports = {weather: weatherCommand};
