require.paths.unshift('.');

var http = require('http')
  , url = require('url')
  , fs = require('fs')
  , io = require('socket.io')
  , connect = require('connect')
  , assetManager = require('connect-assetmanager')
  , sys = require(process.binding('natives').util ? 'util' : 'sys')
  , Game = require('game')
  , server
  , games = {}
  , latestPublicGame;

var assetManagerGroups = {
  js: {
      route: /\/static\/client\.js/
    , path: __dirname + '/client/'
    , dataType: 'javascript'
    , files: [
      , 'http://code.jquery.com/jquery-latest.js'
      , /jquery.*/
      , 'util.js'
      , 'client.js'
      ]
  },
  css: {
      route: /\/static\/style\.css/
    , path: __dirname + '/client/'
    , dataType: 'css'
    , files: ['style.css']
  }
}

function niceifyURL(req, res, next){
  if (/^www\./.exec(req.headers.host)) {
    var host = req.headers.host.substring(req.headers.host.indexOf('.') + 1)
      , url  = 'http://' + host + req.url
    res.writeHead(302, {
      'Location': url
    });
    res.end();
    return;
  }

  if (/^\/game\/public\//.exec(req.url)) {
    res.writeHead(302, {
      'Location': '/game/#!/' + getLatestPublicGame().hash
    });
    res.end();
    return;
  }

  if (/^\/game\//.exec(req.url)) {
    req.url = '/game.html';
  }

  next();
}

server = connect.createServer(
    connect.logger()
  , assetManager(assetManagerGroups)
  , niceifyURL
  , connect.static(__dirname + '/client', { maxAge: 86400000 })
);

server.listen(80);

var io = io.listen(server);

function getUnusedHash() {
  do { var hash = randString(6); } while (hash in games);
  return hash;
}
function getGame(hash) {
  if (hash && hash in games) return games[hash];
  hash = getUnusedHash();
  return (games[hash] = new Game(hash));
}

function getLatestPublicGame() {
  if (!latestPublicGame || latestPublicGame.started) {
    var hash = getUnusedHash();
    return (latestPublicGame = games[hash] = new Game(hash, 3));
  }
  return latestPublicGame;
}

io.on('connection', function(client){
  var game;
  client.on('message', function(message){
    console.log(message);
    if (message.action === 'init') {
      game = getGame(message.game);
      game.registerClient(client, message.sess);
      client.send({action: 'setHash', hash: game.hash});
    }
    if (game !== null) game.message(client, message);
  });

  client.on('disconnect', function(){
    var hash = game.hash;
    game.unregisterClient(client, function gameOver() {
      console.log('gameover called');
      delete games[hash];
    });
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