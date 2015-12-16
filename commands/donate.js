var data = require("../client/data");

var donate = function(bot, sender, args)
{
	try
	{
		var text = "Feel free to make a donation to this BTC-wallet:\n1L4wsdovW42KYNfQ1UE7jyZJPk4XiJJTHS\n\nList of previous donators:\n"
		for (var i in data.donatorNames) {
			text += "*" + data.donatorNames[i] + "\n";
		}
		bot.send(text);
	}
	catch(e)
	{
		bot.send(e.toString());
	}
};

module.exports = {donate: donate};
