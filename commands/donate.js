var data = require("../client/data.js");

var donate = function(bot, sender, args, data, client)
{
	var text = "Feel free to make a donation to this BTC-wallet:\n1L4wsdovW42KYNfQ1UE7jyZJPk4XiJJTHS\n\nList of previous donators:\n"
	for (var i in data.donatorNames) {
		text += "*" + data.donatorNames[i] + "\n";
	}
	bot.sendAll(text, client);
};

module.exports = {donate: donate};
