require.paths.unshift('.');

var http = require('http')
  , url = require('url')
  , fs = require('fs')
  , io = require('socket.io')
  , connect = require('connect')
  , Cookies = require('cookies')
  , assetManager = require('connect-assetmanager')
  , sys = require(process.binding('natives').util ? 'util' : 'sys')
  , Game = require('game')
  , server;

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
  if (/^\/game/.exec(req.url)) {
    req.url = '/game.html';
  }
  next();
}

function sessionHandler(req, res, next) {
  var cookies = new Cookies(req, res);
  if (!cookies.get('sess')) {
    cookies.set('sess', randString(10), {httpOnly: false});
  }
  next();
}

function disableCache(req, res, next) {
  if (req.url !== '/game.html') return;
   res.setHeader('Cache-Control', 'public, max-age=0');
}

server = connect.createServer(
    connect.logger()
  , assetManager(assetManagerGroups)
  , niceifyURL
  , sessionHandler
  , connect.static(__dirname + '/client', { maxAge: 86400000 })
  , disableCache
);

server.listen(80);

var io = io.listen(server)
  , games = {}
  , clients = {};

io.on('connection', function(client){
  var game
    , dcTimeout;
  client.on('message', function(message){
    console.log(message);
    if (message.action === 'init') {
      if (message.game && message.game in games) {
        game = clients[client.sessionId] = games[message.game];
        game.registerClient(client, message.sess);
      } else {
        var hash;
        do { hash = randString(6); } while (hash in games);
        game = games[hash] = clients[client.sessionId] = new Game(hash, client, message.sess);
        client.send({action: 'setHash', hash: hash});
        return;
      }
    }
    if (game !== null) game.message(client, message);
  });

  client.on('disconnect', function(){
    if (!(client.sessionId in clients))
      return;

    var hash = game.hash;
    game.unregisterClient(client, function gameOver() {
      console.log('gameover called');
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