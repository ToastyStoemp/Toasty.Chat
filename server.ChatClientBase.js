function ChatClientBase() {
}
module.exports = ChatClientBase;
ChatClientBase.prototype.getId = function() {
	throw "ChatClientBase getId STUB";
};
ChatClientBase.prototype.getIpAddress = function() {
	throw "ChatClientBase getId STUB";
};
ChatClientBase.prototype.close = function() {
	throw "ChatClientBase close STUB";
};
ChatClientBase.prototype.send = function() {
	throw "ChatClientBase close STUB";
};
ChatClientBase.prototype.setClientConfigurationData = function(channel, nick, trip) {
	this.channel = channel;
	this.nick = nick;
	this.trip = trip;
};
