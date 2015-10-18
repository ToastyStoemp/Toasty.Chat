var unirest = require('unirest');

module.exports.fortune = function(bot, sender, args, data) {
  unirest.get("https://thibaultcha-fortunecow-v1.p.mashape.com/random")
    .header("X-Mashape-Key", "54pyT5Ih3Vmsh7yUVh3vC3Nf2FuAp1MbTcjjsnj0of8Htcq5G2")
    .header("Accept", "text/plain")
    .end(function(result) {
      return bot.send(result.body);
    });
}
