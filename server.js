var fs = require('fs');

function loadFile(filename) {
	var file = null;

	file = fs.readFileSync(filename, 'utf8');
	console.log("Loaded '" + filename + "'");
	return file;
}

function main() {
	var configFileName = "config.json";
	var versionFileName = "./client/data.js"
	var config = JSON.parse(loadFile(configFileName));
	var version = loadFile(versionFileName).match(/"([0-9]+)"/)[1];
	console.log("Running version " + version);

	var chatServerBase = require("./server.ChatServerBase.js")();
	chatServerBase.initialize(config.base, version);

	if (config.webSocketServer && config.webSocketServer.enabled) {
		var webSocketServer = require("./server.WebSocketServer.js")();
		webSocketServer.initialize(config.webSocketServer);
		webSocketServer.run(chatServerBase);
	}
	if (config.ircServer && config.ircServer.enabled) {
		var ircServer = require("./server.IrcServer.js")();
		ircServer.initialize(config.ircServer);
		ircServer.run(chatServerBase);
	}
	if (config.restApiServer && config.restApiServer.enabled) {
		var restApiServer = require("./server.RestApiServer.js")();
		restApiServer.initialize(config.restApiServer);
		restApiServer.run(chatServerBase);
	}

	fs.watchFile(configFileName, {persistent: false}, function() {
		config = JSON.parse(loadFile(configFileName));
                chatServerBase.initialize(config.base, version);
		if (config.webSocketServer.enabled) webSocketServer.initialize(config.webSocketServer);
		if (config.ircServer.enabled) ircServer.initialize(config.ircServer);
	});
	fs.watchFile(versionFileName, {persistent: false}, function() {
                version = loadFile(versionFileName).match(/"([0-9]+)"/)[1];
		console.log("Running version " + version);
                chatServerBase.initialize(config.base, version);
                if (config.webSocketServer && config.webSocketServer.enabled) webSocketServer.initialize(config.webSocketServer);
                if (config.ircServer && config.ircServer.enabled) ircServer.initialize(config.ircServer);
                if (config.restApiServer && config.restApiServer.enabled) ircServer.initialize(config.ircServer);
        });
}

main();

