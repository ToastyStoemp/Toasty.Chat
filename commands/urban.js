var request = require("request");

exports.urban = function(bot, sender, args, data, client)
{
    if(args.join(" ").trim() == "")
    {
      bot.sendClient("Usage: !urban <term>", client);
      return;
    }

    var term = encodeURIComponent(args.join(" "));

    request("http://api.urbandictionary.com/v0/define?term=" + term, function(err, res, body)
    {
      if(err)
    	{
          bot.sendClient("@" + sender + " " + err.toString(), client);
          return;
      }

      var data = JSON.parse(body);
      if(!data.list || data.list.length < 1)
      {
          bot.sendClient("@" + sender + " no results found", client);
          return;
      }

      var defintion = data.list[0].definition.substr(0, 500);
      bot.sendAll("@" + sender + " " + defintion + " - " + data.list[0].permalink, client);
    });
};
