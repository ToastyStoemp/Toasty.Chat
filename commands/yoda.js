var soap = require('soap');
var url = "http://www.yodaspeak.co.uk/webservice/yodatalk.php?wsdl";
exports.yoda = function(bot, sender, args, data, client) {
  if (args.length > 0) {
    var form_sentence = args.join(" ");
    soap.createClient(url, function(err, api) {
      api.yodaTalk({
        input: form_sentence
      }, function(err, result) {
        if (result.return.indexOf(form_sentence) == -1) {
          return bot.sendAll("@" + sender + " Yoda would say: " + result.return, client);
        }
      });
    });
  } else {
    return bot.sendClient("@" + sender + " Usage: /yoda <sentence>", client);
  }
};
