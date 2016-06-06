var TeamSpeakClient = require("node-teamspeak"),
	util = require("util"),
	config = require("../data/ts.json");

var tsCommand = function(bot, sender, args, data, client)
{

  var onlineUsers = [];
  var reqChannel = args[0].toLowerCase();

  var cl = new TeamSpeakClient(config.serverIP);
  cl.send("login", {client_login_name: config.client_login_name, client_login_password: config.client_login_password}, function(err, response, rawResponse){
  	cl.send("use", {sid: 1}, function(err, response, rawResponse){
  		cl.send("channellist", function(err, response, rawResponse){
        if (response) {
          for(channel in response){
            if (response[channel].channel_name.toLowerCase().indexOf(reqChannel) != -1) {
              var wantedChannel = response[channel].cid;
							var name = response[channel].channel_name;
              cl.send("clientlist", function(err, response, rawResponse){
                for(user in response){
                  if(response[user].cid == wantedChannel){
                    onlineUsers.push(response[user].client_nickname);
                  }
                }
                bot.sendAll("Online users in " + name + ": " + onlineUsers, client);
								cl.send("quit", function(err, response, rawResponse){});
              });
            }
          }
        }
  		});
  	});
  });
}

module.exports = {ts: tsCommand};
