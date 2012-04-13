var socket
  , selected = []
  , cards = []
  , lastSets = {}
  , me
  , lastMsg
  , preventRefresh = false
  , fixwrap
  , SERVER_EVENTS = ['init', 'join', 'leave', 'rejoin', 'taken', 'setHash', 'remaining', 'puzzled',
      'add', 'hint', 'start', 'win', 'msg'];

$(function() {
  fixwrap = $('#fixwrap');
  $(window).scroll(function() {
    fixwrap.css('left', $(this).scrollLeft() * -1);
  });
});

function startGame() {
  socket = io.connect(null, {
      rememberTransport: true
    , transports: ['websocket', 'flashsocket', 'xhr-multipart', 'xhr-polling', 'jsonp-polling']
  });
  socket.on('connect', function() {
    $('#announcement').html('<h1>Connected!</h1>');
    $('#announcement').removeClass('loading');
    setTimeout(function() {
      $('#announcement').fadeOut(function() {
        initGame();
      });
    }, 1500);
  });
  
  SERVER_EVENTS.forEach(function(event) {
    socket.on(event, window[event]);
  });
  
  socket.on('disconnect', socket_disconnect);
  socket.on('reconnect', socket_reconnect);
  socket.on('reconnecting', socket_reconnect);
  socket.on('reconnect_failed', socket_reconnect_failed);

  $('#hint').click(requestHint);
  $('#input').keydown(input);
  $('#input').focus();
  
  $(window).hashchange(function() {
    if (preventRefresh) {
      preventRefresh = false;
      return;
    }
	  location.reload();
  });

  $(document).bind('mousedown', function(event) {
    var target = $(event.target)
      , id = target.attr('id');

    if (id === 'hint' ||
        target.parent().attr('id') === 'hint'  ||
        id === 'input')
      return;
    var klass = target.attr('class');
    if (klass === undefined || 
		    (klass.indexOf('card') === -1 && klass.indexOf('shape') === -1)) {
      clearSelected();
    }
  });

  $('#share').bind('mouseup', function(event) {
    $('#share input')[0].select();
    event.stopImmediatePropagation();
    return false;
  });

  $(document).bind('mouseup', function(event) {
    setTimeout(function() {
      if (getSelText() == '') {
        $('#input').focus();
      }
    }, 1000);
  });
}

function parseCards() {
  $('.cardwrap').each(function() {
    var elem = $(this)
      , card = {
          number: parseInt(elem.attr('number'))
        , color: parseInt(elem.attr('color'))
        , shape: parseInt(elem.attr('shape'))
        , shading: parseInt(elem.attr('shading'))}
      , c = $('<div class="card"></div>');
    c.append(generateShapes(card));
    elem.append(c);
  });
}

function generateShapes(card) {
  var shapeWrap = $('<div/>', {
        'class': 'shapeWrap'
      })
    , top = card.shape * 55
    , left = (card.color * 3 + card.shading) * 33
    , style = 'background-position: -' + left + 'px -' + top + 'px';
  for (var i = 0; i <= card.number; i++) {
    if (i === card.number) style += ';margin-right:0';
    shapeWrap.append($('<div/>', {
      'class': 'shape',
      style: style
    }));
  }
  return shapeWrap;
}

function addCards(newCards) {
  var tr = null;
  $.each(newCards, function(idx, card) {
    if (idx % 3 === 0) tr = $('<tr/>');
    var td = $('<td/>');
    var c = $('<div/>', {
      'class': 'card',
      mousedown: function() { select(this) }
    });
    c.append(generateShapes(card));
    cards.push(c);
    var w = $('<div class="cardwrap"></div>');
    w.append(c);
    td.append(w);
    tr.append(td);
    if (idx % 3 === 0) $('#board').append(tr);
  });
}

function select(elem) {
  var idx = cards.map( function(v) { return v[0]; } ).indexOf(elem)
    , search = selected.indexOf(idx);
  if (search != -1) {
    unselect(search);
  } else {
    var card = cards[idx];
    card.addClass('selected');
    selected.push(idx);
    checkSet();
  }
}

// takes index of selected array to unselect
function unselect(idx) {
  var deselected = selected.splice(idx, 1)[0];
  cards[deselected].removeClass('selected');
}

function clearSelected() {
  selected.forEach( function(idx) {
    cards[idx].removeClass('selected');
  });
  selected = [];
}

function checkSet() {
  if (selected.length === 3) {
    socket.emit('take', selected);
    setTimeout(clearSelected, 250);
    return;
  }
}

function hidePlayers() {
  $('#scoreboard li').hide();
  $('#scoreboard li .offline').hide();
  $('#scoreboard li .puzzled').hide();
}

function updatePlayers(playerData) {
  for (var i in playerData) {
    var player = $('#p' + i);
    if ('score' in playerData[i]) player.children('h2').text('' + playerData[i].score);
    if ('online' in playerData[i]) {
      if (playerData[i].online) player.children('.offline').fadeOut(1000);
      else player.children('.offline').fadeIn(1000);
    }
    player.slideDown();
  }
}

function fadeOutLastSet(player) {
  if (player in lastSets) {
    lastSets[player].forEach( function(elem) {
      elem.fadeOut(function() {$(this).remove()});
    });
  }
  lastSets[player] = [];
}

function fadeOutAllLastSets() {
  for (var player in lastSets) {
    fadeOutLastSet(player);
  }
}

function requestHint(event) {
  socket.emit('hint');
  $('#hint').animate({opacity:0});
  showPuzzled(me);
  event.preventDefault();
}

function showPuzzled(player) {
  $('#p' + player + ' .puzzled').fadeIn();
}

function hideAllPuzzled() {
  $('.puzzled').fadeOut(600);
  setTimeout(function() { $('#hint').animate({opacity:1}); }, 610);
}

function input(e) {
  e = e || event;
  var self = this;
  if (e.which === 13) {
    if (!e.ctrlKey) {
      if (this.value) socket.emit('msg', this.value);
      this.value = "";
    } else {
      this.value += "\n";
    }
    e.preventDefault();
  }
  setTimeout(function() {
    if (self.value) $(self).prev().fadeOut('fast');
    else $(self).prev().fadeIn('fast');
  }, 15);
}

function msg(obj) {
  var skipName = obj.event !== undefined;
  if (lastMsg && !obj.event && obj.player === lastMsg.player)
  {
    skipName = true;
    var last = $('#chat li:last .message');
    last.removeClass('cornered');
  }
  var m = $('<li>' +
    (skipName ?
      '' :
      '<h3 class="p' + obj.player +
      '">Player ' +(obj.player+1) + '</h3>') +
    '<div class="message cornered ' + (obj.event ? '' : 'player-message') + '">' +
    obj.msg + '</div></li>'
  );
  lastMsg = {player: obj.player, event: obj.event};
  $('#chat').append(m);
  $('html, body').stop();
  $('html, body').animate({ scrollTop: $(document).height() }, 200);
}

function join(player) {
  update = {};
  update[player] = {score: 0, online: true};
  updatePlayers(update);
}

function rejoin(player) {
  var update = {};
  update[player] = {online: true};
  updatePlayers(update);
}

function init(game) {
  cards = [];
  $('#board tr').remove();
  hidePlayers();
  if ('board' in game) addCards(game.board);
  if ('players' in game) updatePlayers(game.players);
  if ('you' in game) me = game.you;
  if ('msgs' in game && !lastMsg) game.msgs.forEach(msg);
  if (game.remaining) {
    $('#training').slideDown();
    $('#training b').text(game.remaining);
  }
  $('#hint, #share').css({display:'block'});
  $('#footer h3').addClass('p' + me).text('Player ' + (me + 1));
  $('#announcement').remove();
  fadeOutAllLastSets();
}
function taken(newBoard) {
  var j = 0;
  fadeOutLastSet(newBoard.player);
  for (var i in newBoard.update) {
    if (i in selected) unselect(i);
    var card = newBoard.update[i]
      , dupe = cards[i].clone()
      , p = $('#p' + newBoard.player);
    cards[i].after(dupe);

    if (typeof card === 'number') {
      var replace = cards[card]
        , old = cards[i];
      cards[i] = replace;
      (function (old) {
        var offsx = old.offset().left - replace.offset().left
          , offsy = old.offset().top - replace.offset().top;
        replace.css('z-index', '3');
        replace.animate({
            transform: 'translateX(' + offsx + 'px) translateY(' + offsy + 'px) rotate(360deg)'}
          , { duration: 1250
            , easing: 'easeOutQuad'
            , complete: function() {
                $(this).css('transform', 'translateX(0px) translateY(0px)');
                old.hide();
                old.after($(this));
                old.remove();
              }
        });
      })(old);
    } else if (card) {
      cards[i].empty();
      cards[i].append(generateShapes(card));
    } else {
      cards[i].fadeOut('fast');
    }

    (function (j) {
      var xconst = (j * 38) - 42, yconst = -12
        , offsx = xconst + p.offset().left - dupe.offset().left
        , offsy = yconst + p.offset().top - dupe.offset().top;
      dupe.removeClass('selected');
      dupe.css('z-index', '3');
      dupe.animate({
          transform: 'translateX(' + offsx + 'px) translateY(' + offsy + 'px) rotate(450deg) scale(0.45)'}
        , { duration: 1000
          , easing: 'easeOutQuad'
          , complete: function() {
              $(this).css('transform', 'translateX(0px) translateY(0px) rotate(90deg) scale(0.45)');
              $(this).css('left', xconst);
              $(this).css('top', yconst);
              $(this).appendTo(p);
            }
      });
    })(j++);
    lastSets[newBoard.player].push(dupe);
  }
  
  if (cards.length > 12) {
    setTimeout(function() {
      $('#board tr:last').remove();
      cards.splice(cards.length-3, 3);
    }, 1350);
  }
  
  updatePlayers(newBoard.players);
  hideAllPuzzled();
  $('.hint').removeClass('hint');
}

function setHash(hash) {
  preventRefresh = true;
  window.location.replace(window.location.href.split('#')[0] + '#!/' + hash);
  $('#share input').attr('value', window.location.href);
}

function leave(player) {
  var update = {};
  update[player] = {online: false};
  updatePlayers(update);
}

function remaining(left) {
  $('#training b').text(left);
}

function puzzled(player) {
  if (player != me) showPuzzled(player);
}

function add(cards) {
  hideAllPuzzled();
  addCards(cards);
}

function hint(card) {
  hideAllPuzzled();
  cards[card].parent().addClass('hint');
}

function win(winner) {
  message = 'Player ' + (winner+ 1) + ' wins!';
  msg({event: true, msg: 'Player ' + (winner + 1) + ' has won this round'});
  newGame();
}

function start() {
  message = 'Game Starting';
  $('#training').fadeOut();
  time = 9;
  newGame();
}

function newGame() {
  $('#board').fadeOut(650, function () {
    $('#board tr').remove();
    $('#boardwrap').prepend('<div id="announcement"><h1>' + message + '</h1>' +
      '<span id="timer">' + time + '</span> seconds until round start</div>');
    resetTimer(time);
    $('#board').show();
    $('#hint').hide();
  });
}

function resetTimer(seconds) {
  $('#timer').text('' + seconds);
  if (seconds > 0)
    setTimeout(function() {resetTimer(seconds-1);}, 1000);
  else
    initGame();
}

function initGame() {
  var sess = getCookie('sess') || randString(10);
  setCookie('sess', sess, 1.0/24);
  log('initting s: ' + sess);
  var init = {sess: sess}
    , hash = window.location.hash;
  if (hash) {
    hash = hash.substring(hash.indexOf('#!/') + 3);
    init.game = hash;
    $('#share input').attr('value', window.location.href);
  }
  socket.emit('init', init);
}

function socket_disconnect() {
  msg({event:true, msg: 'You have been disconnected'})
}
function socket_reconnect() {
  msg({event:true, msg: 'Reconnected to server'})
}
function socket_reconnecting(nextRetry) {
  msg({event:true, msg: ('Attempting to re-connect to the server, next attempt in ' + nextRetry + 'ms')})
}
function socket_reconnect_failed() {
  msg({event:true, msg: 'Reconnect to server FAILED.'})
}
