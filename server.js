require.paths.unshift('.');

var http = require('http')
  , url = require('url')
  , fs = require('fs')
  , io = require('socket.io')
  , connect = require('connect')
  , gzip = require('connect-gzip')
  , ams = require('ams')
  , sys = require(process.binding('natives').util ? 'util' : 'sys')
  , Game = require('game')
  , server
  , games = {}
  , latestPublicGame
  , clientDir = __dirname + '/client'
  , publicDir = __dirname + '/public';

cleanOldStaticFiles(publicDir);
buildStaticFiles();

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

  if (/^\/game\/public/.exec(req.url)) {
    res.writeHead(302, {
      'Location': '/game/#!/' + getLatestPublicGame().hash
    });
    res.end();
    return;
  }

  if (/^\/game\//.exec(req.url)) {
    req.url = '/game.html';
    next();
    return;
  }

  if (/^\/game/.exec(req.url)) {
    res.writeHead(301, {
      'Location': '/game/'
    });
    res.end();
    return;
  }

  next();
}

server = connect.createServer(
    connect.logger()
  , niceifyURL
  , gzip.staticGzip(publicDir, {
        matchType: /text|javascript|image/
      , maxAge: process.env.NODE_ENV === 'development' ? 0 : 604800000
    })
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

function buildStaticFiles() {
  ams.build
  .create(publicDir)
  .add(clientDir + '/jquery-1.5.2.js')
  .add(clientDir + '/jquery.transform.lite.js')
  .add(clientDir + '/jquery.ba-bbq.js')
  .add(clientDir + '/util.js')
  .add(clientDir + '/client.js')
  .add(clientDir + '/style.css')
  .combine({js: 'client.js', css: 'style.css'})
  .process({
    jstransport: false,
    cssabspath: false,
    htmlabspath: false,
    cssvendor: false,
    texttransport: false})
  .write(publicDir)
  .end();
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
    } else {
      if (/\.gz\./.exec(path)) fs.unlink(path);
    }
  });
  
}
