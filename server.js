require.paths.unshift('.');

var http = require('http')
  , url = require('url')
  , fs = require('fs')
  , io = require('socket.io')
  , connect = require('connect')
  , sys = require(process.binding('natives').util ? 'util' : 'sys')
  , Game = require('game')
  , server;

server = connect.createServer(
    connect.logger()
  , connect.static(__dirname, { maxAge: 604800000 })
);

server.listen(80);

var io = io.listen(server, {
      flashPolicyServer: false
    , transports: ['flashsocket', 'htmlfile', 'xhr-multipart', 'xhr-polling', 'jsonp-polling']
  })
  , games = {}
  , clients = {};

io.on('connection', function(client){
  var game;
  client.on('message', function(message){
    console.log(message);
    if (message.action === 'init') {
      if (message.game && message.game in games) {
        game = clients[client.sessionId] = games[message.game];
        game.registerClient(client);
      } else {
        var hash;
        do { hash = randString(6); } while (hash in games);
        game = games[hash] = clients[client.sessionId] = new Game(hash, client);
        client.send({action: 'setHash', hash: hash});
      }
    }
    game.message(client, message);
  });

  client.on('disconnect', function(){
    if (!(client.sessionId in clients))
      return;

    var hash = game.hash;
    game.unregisterClient(client, function gameOver() {
      delete games[hash];
    });

    delete clients[client.sessionId];
    game = null;
  });
});


var CHARSET = ['2','3','4','6','7','9','A','C','D','E','F','G','H','J','K','L','M','N','P','Q','R',
              'T','V','W','X','Y','Z'];

function randString(size) {
  var ret = "";
  while (size-- > 0) {
    ret += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }
  return ret;
}