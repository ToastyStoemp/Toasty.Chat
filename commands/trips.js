var tripList = require("../data/trips.json");

var tripget = function(bot, sender, args, data, client)
{
	if (args[0] == '')
	{
		bot.sendClient(bot.man.tripget, client);
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
		bot.sendClient(bot.man.tripadd, client);
		return
	}

	tripList[bot.commands['tripget'](bot, data.nick, args, data, client)] = args[1];
	bot.sendClient(args[0] + " has been added to the triplist.", client);
};

var tripremove = function(bot, sender, args, data, client)
{
	if (args[0] == "") {
		bot.sendClient(bot.man.tripremove, client);
		return
	}
	var realtrip = bot.commands['tripget'](bot, data.nick, args, data, client);
	delete tripList[realtrip];
	bot.sendAll(args[0] + " has been removed from the triplist!", client);
};
function e(fu, man) 
{
	return {action: fu, man: man};
}
module.exports = {
	tripget: e(tripget, "Syntax is !tripget <nick>; sends the trip of <nick>."),
	tripadd: e(tripadd, "Syntax is !tripadd <nick> <trip>; registers <nick> in the triplist with <trip>."),
	tripremove: e(tripremove, "Syntax is !tripremove <nick>; removes a registered <nick> from the triplist.")
};
