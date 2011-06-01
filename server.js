require.paths.unshift('.');

var http = require('http')
  , fs = require('fs')
  , io = require('socket.io')
  , connect = require('connect')
  , gzip = require('connect-gzip')
  , nowww = require('connect-no-www')
  , ams = require('ams')
  , Game = require('game')
  , server
  , games = {}
  , latestPublicGame
  , clientDir = __dirname + '/client'
  , publicDir = __dirname + '/public'
  , depsDir = __dirname + '/deps';

cleanOldStaticFiles(publicDir);
buildStaticFiles();

function niceifyURL(req, res, next){
  if (/^\/game\/public/.exec(req.url)) {
    res.writeHead(302, {
      'Location': '/game/#!/' + getLatestPublicGame().hash
    });
    return res.end();
  }

  if (/^\/game\//.exec(req.url)) {
    req.url = '/game.html';
    return next();
  }

  if (/^\/game/.exec(req.url)) {
    res.writeHead(301, { 'Location': '/game/' });
    return res.end();
  }
  return next();
}

server = connect.createServer(
    connect.logger(':status :remote-addr :url in :response-timems')
  , nowww()
  , niceifyURL
  , gzip.staticGzip(publicDir, {
        matchType: /text|javascript|image|font/
      , maxAge: process.env.NODE_ENV === 'development' ? 0 : 604800000
    })
);

server.listen(80);

var io = io.listen(server);

function getUnusedHash() {
  do { var hash = randString(4); } while (hash in games);
  return hash;
}
function getGame(hash) {
  if (hash && hash in games) return games[hash];
  hash = getUnusedHash();
  return (games[hash] = new Game(hash));
}

function getLatestPublicGame() {
  if (!latestPublicGame ||
    latestPublicGame.started ||
    !(latestPublicGame.hash in games))
  {
    var hash = getUnusedHash();
    latestPublicGame = games[hash] = new Game(hash, 3);
  }
  return latestPublicGame;
}

io.on('connection', function(client){
  var game = null;
  client.on('message', function(message){
    console.log(message);
    if ('action' in message && message.action === 'init') {
      game = getGame(message.game);
      game.registerClient(client, message.sess);
      if (message.game !== game.hash) client.send({action: 'setHash', hash: game.hash});
    }
    if (game !== null) game.message(client, message);
  });

  client.on('disconnect', function() {
    if (!game) return;
    var hash = game.hash;
    game.unregisterClient(client, function gameOver() {
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
    cssdataimg: false,
    htmlabspath: false,
    texttransport: false
  };
  ams.build
    .create(publicDir)
    .add(depsDir + '/JSON-js/json2.js')
    .add(depsDir + '/Socket.IO/socket.io.js')
    .add(clientDir + '/util.js')
    .add(depsDir + '/jquery-bbq/jquery.ba-bbq.js')
    .add(depsDir + '/jquery.transform.js/jquery.transform.light.js')
    .add(clientDir + '/client.js')
    .add(clientDir + '/style.css')
    .combine({js: 'client.js', css: 'style.css'})
    .process(options)
    .write(publicDir)
  .end();
  ams.build
    .create(publicDir)
    .add(depsDir + '/headjs/src/load.js')
    .combine({js: 'head.load.js'})
    .process(options)
    .write(publicDir)
  .end();
  ams.build
    .create(publicDir)
    .add(clientDir + '/index.html')
    .add(clientDir + '/game.html')
    .write(publicDir)
  .end()
}

function cleanOldStaticFiles(path) {
  fs.stat(path, function(err, stats) {
    if (err) throw err;
    if (stats.isDirectory()) {
      fs.readdir(path, function(err, files) {
        if (err) throw err;
        files.forEach(function(filename, index) {
          cleanOldStaticFiles(path + '/' + filename);
        });
      });
    } else if (/\.gz$/.exec(path)) fs.unlink(path);
  });
}
