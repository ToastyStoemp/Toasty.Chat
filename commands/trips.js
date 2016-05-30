var tripList = require("../data/trips.json");

var tripget = function(bot, sender, args, data, client)
{
	if (args[0] == '')
	{
		bot.sendClient("Usage: '!get trip [nick]'", client);
		return;
	}

	var target = bot.chatServerBase.getClientOfChannel(args[0], client.channel);
	if (target == null) {
		bot.sendClient("User not found.", client);
		return;
	}

	bot.sendClient(target.trip, client);
	return target.trip;
};

var tripadd = function(bot, sender, args, data, client)
{
	if (args[1] == "") {
		bot.sendClient("Usage: !tripadd [nick] [trip]", client);
		return
	}

	tripList[bot.commands['tripget'](bot, data.nick, args, data, client)] = args[1];
	bot.sendClient(args[0] + " has been added to the triplist.", client);
};

var tripremove = function(bot, sender, args, data, client)
{
	if (args[0] == "") {
		bot.sendClient("Usage: !tripremove [nick]", client);
		return
	}
	var realtrip = bot.commands['tripget'](bot, data.nick, args, data, client);
	delete tripList[realtrip];
	bot.sendAll(args[0] + " has been removed from the triplist!", client);
};

module.exports = {
	tripget: tripget,
	tripadd: tripadd,
	tripremove: tripremove
};
