var fs = require('fs');

function loadConfig(filename) {
	var config = null;

	try {
		config = JSON.parse(fs.readFileSync(filename, 'utf8'));
		console.log("Loaded config '" + filename + "'");
	} catch (e) {
		console.warn(e);
	}

	return config;
}

function main() {
	var configFileName = "config.json";
	var config = loadConfig(configFileName);

	var chatServerBase = require("./server.ChatServerBase.js")();
	chatServerBase.initialize(config.base);

	if (config.webSocketServer.enabled) {
		var webSocketServer = require("./server.WebSocketServer.js")();
		webSocketServer.initialize(config.webSocketServer);
		webSocketServer.run(chatServerBase);
	}

	if (config.ircServer.enabled) {
		var ircServer = require("./server.IrcServer.js")();
		ircServer.initialize(config.ircServer);
		ircServer.run(chatServerBase);
	}

	fs.watchFile(configFileName, {persistent: false}, function() {
		config = loadConfig(configFileName);
		chatServerBase.initialize(config.base);
		if (config.webSocketServer.enabled) webSocketServer.initialize(config.webSocketServer);
		if (config.ircServer.enabled) ircServer.initialize(config.ircServer);
	});
}

main();

