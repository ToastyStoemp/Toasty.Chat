var donatorList = require("../data/donators.json");

var donate = function(bot, sender, args, data, client)
{
	var text = "Feel free to make a donation to this BTC-wallet:\n1L4wsdovW42KYNfQ1UE7jyZJPk4XiJJTHS\n\nList of previous donators:\n"
	for (var i in donatorList) {
		text += "*" + donatorList[i] + "\n";
	}
	bot.sendAll(text, client);
};

var donateadd = function(bot, sender, args, data, client)
{
	if (args[0] == "") {
		bot.sendClient("Usage: !adddonator [nick]", client);
		return
	}
	for (var i in donatorList)
		if (donatorList[i] == args[0]) {
			bot.sendClient("Already on the list", client);
			return;
		}

	donatorList[bot.commands['tripget'](bot, data.nick, args, data, client)] = args[0];
	bot.sendAll(args[0] + " has been added to the list of donators! Thank you for your donation", client);
};

var donateremove = function(bot, sender, args, data, client)
{
	if (args[0] == "") {
		bot.sendClient("Usage: !removedonator [nick]", client);
		return
	}
	for (var i in donatorList)
		if (donatorList[i] == args[0]) {
			delete donatorList[bot.commands['tripget'](bot, data.nick, args, data, client)];
			bot.sendAll(args[0] + " has been removed from the list of donators!", client);
			return;
		}

	bot.sendClient("User not found", client);
};

module.exports = {
	donate: donate,
	donateadd: donateadd,
	donateremove: donateremove
};
