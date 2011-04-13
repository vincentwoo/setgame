module.exports = function Game(hash, client) {

  this.players = [new Player(client), null, null, null, null, null, null, null];
  this.hash = hash;
  this.puzzled = [];
  this.messages = [];
  
  this.reset = function() {
    this.deck = [];
    this.board = [];
    this.players.forEach(function(player) {
      if (player !== null) player.score = 0;
    });
    for (var i = 0; i < 81; i++) {
      this.deck.push( new Card(i) );
    }
    shuffle(this.deck);
    for (var i = 0; i < 12; i++) {
      this.board.push(this.deck.pop());
    }    
  }
  
  this.reset();

  this.getActivePlayers = function() {
    return this.players.filter( function(player) { return player !== null; });
  }

  this.numPlayers = function() {
    return this.getActivePlayers().length;
  }

  this.firstAvailablePlayerSlot = function() {
    for (var i = 0; i < this.players.length; i++) {
      if (this.players[i] === null) return i;
    }
    return 0;
  }

  this.getPlayerIdx = function(client) {
    for (var i = 0; i < this.players.length; i++) {
      if (this.players[i] !== null &&
          this.players[i].client.sessionId === client.sessionId)
        return i;
    }
    return -1;
  }

  this.playerScores = function() {
    ret = {};
    for (var i = 0; i < this.players.length; i++) {
      if (this.players[i] !== null) ret[i] = this.players[i].score;
    }
    return ret;
  }

  this.registerClient = function(client) {
    if (this.numPlayers() >= this.players.length) return false;
    if (this.players.every( function(player) {
      return (player === null || player.client.sessionId !== client.sessionId);
    })) {
      var playerIdx = this.firstAvailablePlayerSlot();
      this.broadcast({action: 'join', player: playerIdx});
      this.sendMsg({event: true, msg: 'Player ' + (playerIdx + 1) + ' has joined'});
      this.players[playerIdx] = new Player(client);
    }
    return true;
  }

  this.unregisterClient = function(client, gameOver) {
    var playerIdx = this.getPlayerIdx(client);
    this.players[playerIdx] = null;
    this.broadcast({action: 'leave', player: playerIdx});
    this.sendMsg({event: true, msg: 'Player ' + (playerIdx + 1) + ' has left'});
    var that = this;
    setTimeout( function delayGameover() {
      if (that.numPlayers() === 0) gameOver();
    }, 5000);
  }

  this.broadcast = function(message) {
    console.log(this.hash + ' broadcasting: ');
    console.log(message);
    this.players.forEach( function(player) {
      if (player !== null) player.client.send(message);
    });
  }
  
  this.sendMsg = function(msg) {
    this.messages.push(msg);
    if (this.messages.length > 15) this.messages.shift();
    msg.action = 'msg';
    this.broadcast(msg);
  }

  this.message = function(client, message) {
    if (!message.action) return;
    var player = this.getPlayerIdx(client);
    if (player === -1) return;
    console.log('player ' + player + ' sends: ');
    console.log(message);
    if (message.action === 'init') {
      client.send({
          action: 'init'
        , board: this.board
        , players: this.playerScores()
        , you: player
        , msgs: this.messages
      });
      return;
    }
    if (message.action === 'take') {
      if (this.checkSet(message.selected)) {
        console.log('take set succeed');
        var update = {};
        if (this.board.length <= 12 && this.deck.length > 0) {
            message.selected.forEach( function(val) {
              var c = this.deck.pop();
              update[val] = c;
              this.board[val] = c;
            }, this );
        } else {
          var lastRow = this.board.length - 3;
          var lastReplace = this.board.length - 1;
          message.selected.sort( function reverse(a, b) { return b - a; } );
          message.selected.forEach( function(val) {
            if (val >= lastRow) {
              update[val] = false;
            } else {
              while (message.selected.indexOf(lastReplace) != -1)
                lastReplace--;
              update[val] = lastReplace--;
              this.board[val] = this.board[update[val]];
            }
          }, this);
          this.board.splice(lastRow, 3);
        }
        this.players[player].score += 3;
        var playerUpdate = {};
        playerUpdate[player] = this.players[player].score;
        this.puzzled = [];
        this.broadcast({
            action: 'taken'
          , update: update
          , player: player
          , players: playerUpdate
        });
        
        if (this.deck.length === 0 && !this.checkSetExistence()) {
          var message = {
              action: 'win'
            , player: this.players.reduce(function(prev, cur, idx, arr) {
                if (cur === null) return prev;
                if (prev === null || cur.score > arr[prev].score) return idx;
                return prev;
              }, null)
          };
          var that = this;
          setTimeout(function() { that.broadcast(message); }, 2000);
          this.reset();
        }
      } else {
        console.log('take set failed');
      }
      return;
    }
    
    if (message.action === 'hint') {
      if (this.puzzled.indexOf(player) != -1) return;
      this.puzzled.push(player);
      this.broadcast({
          action: 'puzzled'
        , player: player
      });
      var that = this;
      setTimeout(function() {
        console.log('hint timeout executing');
        if (that.puzzled.length < Math.ceil(that.numPlayers() * 0.51)) return;
        var setExists = that.checkSetExistence();
        if (setExists) {
          that.broadcast({
              action: 'hint'
            , card: setExists[Math.floor(Math.random()*3)]
          });
        } else if (that.deck.length > 0) {
          var newCards = [];
          for (var i = 0; i < 3; i++) newCards.push(that.deck.pop());
          that.board = that.board.concat(newCards);
          that.broadcast({
              action: 'add'
            , cards: newCards
          });
        }
        that.puzzled = [];
      }, 1000);
      return;
    }
    
    if (message.action === 'msg') {
      var msg = message.msg.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>');
      this.sendMsg({ player: player, msg: msg });
      return;
    }
  }
  
  this.checkSetExistence = function() {
    if (this.board.length < 3) return false;
    for (var i = 0; i < this.board.length - 2; i++) {
    for (var j = i + 1; j < this.board.length - 1; j++) {
    for (var k = j + 1; k < this.board.length; k++) {
      if (this.verifySet(this.board[i],this.board[j],this.board[k])) return [i,j,k];
    }}}
    return false;
  }

  this.checkSet = function(indexes) {
    indexes = indexes.unique();
    if (indexes.length != 3) return false;
    if (!indexes.every( function valid(index) {
      return (index >= 0 && index < this.board.length);
    }, this)) {
      return false;
    }
    return this.verifySet(this.board[indexes[0]], this.board[indexes[1]], this.board[indexes[2]]);
  }

  // hardcoding and unrolling all this for speed, possibly premature optimization
  this.verifySet = function(c0, c1, c2) {
    var s = c0.number + c1.number + c2.number;
    if (s != 0 && s != 3 && s != 6) return false;
    s = c0.color + c1.color + c2.color;
    if (s != 0 && s != 3 && s != 6) return false;
    s = c0.shape + c1.shape + c2.shape;
    if (s != 0 && s != 3 && s != 6) return false;
    s = c0.shading + c1.shading + c2.shading;
    if (s != 0 && s != 3 && s != 6) return false;
    return true;
  }
}

function Card(idx) {
  this.number = idx % 3;
  idx = Math.floor(idx / 3);
  this.color = idx % 3;
  idx = Math.floor(idx / 3);
  this.shape = idx % 3;
  idx = Math.floor(idx / 3);
  this.shading = idx % 3;
}

function Player(client) {
  this.client = client;
  this.score = 0;
}

//+ Jonas Raoni Soares Silva
//@ http://jsfromhell.com/array/shuffle [rev. #1]
function shuffle(v){
    for(var j, x, i = v.length;
      i;
      j = parseInt(Math.random() * i), x = v[--i], v[i] = v[j], v[j] = x)
    ;
    return v;
};

// **************************************************************************
// Copyright 2007 - 2009 Tavs Dokkedahl
// Contact: http://www.jslab.dk/contact.php
//
// This file is part of the JSLab Standard Library (JSL) Program.
//
// JSL is free software; you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation; either version 3 of the License, or
// any later version.
//
// JSL is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program. If not, see <http://www.gnu.org/licenses/>.
// ***************************************************************************

// Return new array with duplicate values removed
Array.prototype.unique =
  function() {
    var a = [];
    var l = this.length;
    for(var i=0; i<l; i++) {
      for(var j=i+1; j<l; j++) {
        // If this[i] is found later in the array
        if (this[i] === this[j])
          j = ++i;
      }
      a.push(this[i]);
    }
    return a;
  };