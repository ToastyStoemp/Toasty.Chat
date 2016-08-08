var config;
try {
  config = JSON.parse(fs.readFileSync("../data/ts.json"));
} catch(e) {
  config = null;
}

var TeamSpeakClient, util;
if (config !== null) {
  TeamSpeakClient = require("node-teamspeak");
  util = require("util");
}

var tsCommand = function(bot, sender, args, data, client)
{
  if (config === null) return;

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
										if (response[user].client_nickname.indexOf(config.client_login_name) == -1) {
											onlineUsers.push(response[user].client_nickname);
										}
                  }
                }
                bot.sendAll("Online users in " + name + ": " + onlineUsers.join(", "), client);
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
