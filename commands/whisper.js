var whipser = function(bot, sender, args, data, client)
{
  var targetNick = args.splice(0,1);
  targetNick = targetNick.replace("@", "");
  var friend = bot.chatServerBase.getClientOfChannel(targetNick, client.channel) || null;
  if (friend != null) {
    bot.sendClient(sender + " whispers: " + args.join(' '), friend);
  }
};

module.exports = {w: whipser};
