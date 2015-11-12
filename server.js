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

	var webSocketServer = require("./server.WebSocketServer.js")();
	webSocketServer.initialize(config.webSocketServer);
	webSocketServer.run(chatServerBase);

	fs.watchFile(configFileName, {persistent: false}, function() {
		config = loadConfig(configFileName);
		chatServerBase.initialize(config.base);
		webSocketServer.initialize(config.webSocketServer);
	});
}

main();

