var request = require("request");

request("https://api.coindesk.com/v1/bpi/currentprice.json", function (err, res, body) {
	if(err) 
		return;
	module.btc = JSON.parse(body);
});

function BtcToUSD(bot, sender, args, data, client) {
  if(!args[0])
    args[0] = 1;
  args[0] = parseFloat(args[0]);
  if(String(args[0]) == "NaN")
    return bot.sendAll("@" + sender + " An error occurred!", client);
  var output = "@" + sender + " " + args[0] + " BTC = " + (args[0] * module.btc.bpi.USD.rate_float) + " USD.";
  return bot.sendAll(output, client);
}

function BtcToEUR(bot, sender, args, data, client) {
  if(!args[0])
    args[0] = 1;
  args[0] = parseFloat(args[0]);
  if(String(args[0]) == "NaN)
    return bot.sendAll("@" + sender + " An error occurred!", client);
  var output = "@" + sender + " " + args[0] + " BTC = " + (args[0] * module.btc.bpi.EUR.rate_float) + " USD.";
  return bot.sendAll(output, client);
}
module.exports = {
	btctousd: BtcToUSD,
	btctoeuro: BtcToEUR,
};
