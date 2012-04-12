var http = require('http')
  , fs = require('fs')
  , io = require('socket.io')
  , connect = require('connect')
  , gzip = require('gzippo')
  , nowww = require('connect-no-www')
  , ams = require('ams')
  , Game = require('./game')
  , server
  , games = {}
  , latestPublicGame
  , clientDir = __dirname + '/client'
  , publicDir = __dirname + '/public'
  , depsDir = __dirname + '/deps';

buildStaticFiles();

function niceifyURL(req, res, next){
  if (/^\/game\/public/.exec(req.url)) {
    res.writeHead(302, {
      'Location': '/game/#!/' + getLatestPublicGame().hash
    });
    return res.end();
  }
  if (/^\/game$/.exec(req.url)) {
    res.writeHead(301, { 'Location': '/game/' });
    return res.end();
  }
  if (/^\/game\//.exec(req.url)) {
    req.url = '/game.html';
  } else if (/^\/about/.exec(req.url)) {
    req.url = '/about.html';
  } else if (/^\/help/.exec(req.url)) {
    req.url = '/help.html';
  } else if (/^\/?$/.exec(req.url)) {
    req.url = '/index.html';
  }
  return next();
}

server = connect.createServer(
    connect.logger(':status :remote-addr :url in :response-timems')
  , nowww()
  , niceifyURL
  , gzip.staticGzip(publicDir, {
        matchType: /text|javascript/
      , maxAge: process.env.NODE_ENV === 'production' ? 86400000 : 0
    })
  , gzip.staticGzip(publicDir + '/perm', {
        matchType: /image|font/
      , maxAge: process.env.NODE_ENV === 'production' ? 604800000 : 0
    })
);

server.listen(process.env.NODE_ENV === 'production' ? 80 : 8000);

io = io.listen(server);
io.configure('production', function() {
  io.enable('browser client minification');  // send minified client
  io.enable('browser client etag');          // apply etag caching logic based on version number
  io.enable('browser client gzip');          // gzip the file
});

function getUnusedHash() {
  do { var hash = randString(4); } while (hash in games);
  return hash;
}
function getGame(hash) {
  if (hash && hash in games) return games[hash];
  hash = getUnusedHash();
  return (games[hash] = new Game(io, hash));
}

function getLatestPublicGame() {
  if (!latestPublicGame ||
    latestPublicGame.started ||
    !(latestPublicGame.hash in games))
  {
    var hash = getUnusedHash();
    latestPublicGame = games[hash] = new Game(io, hash, 3);
  }
  return latestPublicGame;
}

io.sockets.on('connection', function(socket){
  var game = null;
  socket.on('init', function(message){
    console.log('connecting socket ' + socket.id);
    game = getGame(message.game);
    game.registerClient(socket, message.sess);
    (game.handleClientMessage('init', socket)).call(game, message);
    if (message.game !== game.hash) socket.emit('setHash', game.hash);
  });

  socket.on('disconnect', function() {
    if (!game) return;
    var hash = game.hash;
    game.unregisterClient(socket, function gameOver() {
      console.log('gameover called');
      delete games[hash];
    });
    game = null;
  });
});

var CHARSET = ['A','C','D','E','F','G','H','J','K','L','M','N','P','Q','R','T','V','W','X','Y','Z'];

function randString(size) {
  var ret = "";
  while (size-- > 0) {
    ret += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }
  return ret;
}

function buildStaticFiles() {
  var options = {
    jstransport: false,
    cssabspath: false,
    csshost: false,
    cssdataimg: false,
    htmlabspath: false,
    htmlhost: false,
    texttransport: false
  };
  ams.build
    .create(publicDir)
    .add(depsDir + '/JSON-js/json2.js')
    .add(clientDir + '/util.js')
    .add(depsDir + '/jquery-bbq/jquery.ba-bbq.js')
    .add(depsDir + '/jquery.transform.js/jquery.transform.light.js')
    .add(clientDir + '/client.js')
    .combine({js: 'client.js'})
    .process(options)
    .write(publicDir)
  .end();
  ams.build
    .create(publicDir)
    .add(clientDir + '/index.html')
    .add(clientDir + '/game.html')
    .add(clientDir + '/about.html')
    .add(clientDir + '/help.html')
    .add(clientDir + '/style.css')
    .add(depsDir + '/headjs/src/load.js')
    .process(options)
    .write(publicDir)
  .end()
}
