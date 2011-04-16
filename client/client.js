var socket = new io.Socket(null, {
        port: 80
      , rememberTransport: false
      , transports: ['websocket', 'flashsocket', 'xhr-multipart', 'xhr-polling', 'jsonp-polling']
  })
  , selected = []
  , cards = []
  , lastSets = {}
  , me
  , colors = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728",
              "#9467bd", "#e377c2", "#bcbd22", "#17becf"]
  , lastMsg;

$(document.body).ready( function() {
  setTimeout(function() {
    socket.connect();
  }, 250);
  $('#hint').click(hint);
  $('#input').keypress(input);
  $('#input').focus();
  $(window).hashchange(initGame);

  $(document).bind('mousedown', function(event) {
    var target = $(event.target)
      , id = target.attr('id');

    if (id === 'hint' |
        target.parent().attr('id') === 'hint'  ||
        id === 'input')
      return;
    var idx = cards.map( function(v) { return v[0]; } ).indexOf(target[0]);
    if (idx != -1) {
      select(idx);
    } else {
      clearSelected();
    }
  });

  $(document).bind('mouseup', function(event) {
    setTimeout(function() {
      if (getSelText() == '') {
        $('#input').focus();
      }
    }, 50);
  });

  $('#share').bind('click', function(event) {
    $('#share input')[0].select();
  });
});

function addCards(newCards) {
  var tr = null;
  $.each(newCards, function(idx, card) {
    if (idx % 3 === 0) tr = $('<tr/>');
    var td = $('<td/>');
    var c = $('<img/>', {
      'class': 'card'
    , src: '/cards/' + (1 + card.number  + card.color * 3 + card.shape * 9 + card.shading * 27) + '.gif'
    });
    cards.push(c);
    var w = $('<div class="cardwrap"></div>');
    w.append(c);
    td.append(w);
    tr.append(td);
    if (idx % 3 === 0) $('#board').append(tr);
  });
}

function select(idx) {
  var search = selected.indexOf(idx);
  if (search != -1) {
    unselect(search);
  } else {
    var card = cards[idx];
    card.addClass('red');
    selected.push(idx);
    checkSet();
  }
}

// takes index of selected array to unselect
function unselect(idx) {
  var deselected = selected.splice(idx, 1)[0];
  cards[deselected].removeClass('red');
}

function clearSelected() {
  selected.forEach( function(idx) {
    cards[idx].removeClass('red');
  });
  selected = [];
}

function checkSet() {
  if (selected.length === 3) {
    socket.send({action: 'take',
                  selected: selected});
    $.each(selected, function(idx, card) {
      setTimeout(function() {cards[card].removeClass('red');}, 250);
    });
    selected = [];
    return;
  }
}

function updateScores(scores) {
  // hard coding in max players on the clientside
  for (var i = 0; i < 8; i++) {
    if (i in scores) {
      var player = $('#p' + i);
      var score = player.children('h2');
      score.text('' + scores[i]);
      player.slideDown();
    }
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

function hint() {
  socket.send({action: 'hint'});
  $('#hint').hide();
  showPuzzled(me);
  return false;
}

function showPuzzled(player) {
  $('#p' + player + ' .puzzled').fadeIn();
}

function hideAllPuzzled() {
  $('.puzzled').fadeOut(600);
  setTimeout(function() { $('#hint').slideDown(); }, 610);
}

function input(e) {
  e = e || event;
  if (e.which === 13) {
    if (!e.ctrlKey) {
      if (this.value !== "") socket.send({action: 'msg', msg: this.value});
      this.value = "";
    } else {
      this.value += "\n";
    }
    e.preventDefault();
    return false;
  }
  return true;
}

function message(obj) {
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
      '<div class="name" style="color:' + colors[obj.player] +
      '">Player ' +(obj.player+1) + '</div>') +
    '<div class="message cornered ' + (obj.event ? 'event' : 'player-message') + '">' +
    obj.msg + '</div></li>'
  );
  lastMsg = {player: obj.player, event: obj.event};
  $('#chat').append(m);
  $('html, body').stop();
  $('html, body').animate({ scrollTop: $(document).height() }, 200);
}

socket.on('message', function(obj){
  log(obj);
  if (!obj.action) return;
  if (obj.action === 'init') {
    cards = [];
    $('#board tr').remove();
    if ('board' in obj) addCards(obj.board);
    if ('players' in obj) updateScores(obj.players);
    if ('you' in obj) me = obj.you;
    if ('msgs' in obj && !lastMsg) obj.msgs.forEach(message);
    $('#me-indicator').prependTo($('#p' + me));
    $('#hint, #share').slideDown();
    fadeOutAllLastSets();
    return;
  }
  if (obj.action === 'taken') {
    var j = 0;
    fadeOutLastSet(obj.player);
    var deleteLastRow = 0;
    for (var i in obj.update) {
      if (i in selected) unselect(i);
      var card = obj.update[i]
        , dupe = cards[i].clone()
        , p = $('#p' + obj.player);
      cards[i].after(dupe);

      if (typeof card === 'number') {
        var replace = cards[card]
          , old = cards[i];
        cards[i] = replace;
        deleteLastRow++;
        (function (old) {
          var offsx = old.offset().left - replace.offset().left
            , offsy = old.offset().top - replace.offset().top;
          replace.css('z-index', '10');
          replace.animate({
              transform: 'translateX(' + offsx + 'px) translateY(' + offsy + 'px) rotate(360deg)'}
            , { duration: 1250
              , easing: 'easeOutQuad'
              , complete: function() {
                  $(this).css('transform', 'translateX(0px) translateY(0px)');
                  old.hide();
                  old.after($(this));
                  old.remove();
                  if (--deleteLastRow === 0) {
                    $('#board tr:last').remove();
                    cards.splice(cards.length-3, 3);
                  }
                }
          });
        })(old);
      } else if (card) {
        cards[i].attr('src', '/cards/' + (1 + card.number  + card.color * 3 + card.shape * 9 +
            card.shading * 27) + '.gif');
      } else {
        cards[i].fadeOut('fast');
      }

      (function (j) {
        var offsx = (j * 36) - 30 +
                    p.offset().left - dupe.offset().left
          , offsy = p.offset().top - dupe.offset().top - 4;
        dupe.removeClass('red');
        dupe.css('z-index', '10');
        dupe.animate({
            transform: 'translateX(' + offsx + 'px) translateY(' + offsy + 'px) rotate(450deg) scale(0.5)'}
          , { duration: 1000
            , easing: 'easeOutQuad'
            , complete: function() {
                $(this).css('transform', 'translateX(0px) translateY(0px) rotate(90deg) scale(0.5)');
                $(this).css('top', -4);
                $(this).css('left', j * 36 - 30);
                $(this).appendTo(p);
              }
        });
      })(j++);
      lastSets[obj.player].push(dupe);
    }
    updateScores(obj.players);
    hideAllPuzzled();
    $('.hint').removeClass('hint');
    return;
  }
  if (obj.action === 'setHash') {
    window.location.hash = '#!/' + obj.hash;
    return;
  }
  if (obj.action === 'join') {
    var update = {};
    update[obj.player] = 0;
    updateScores(update);
    return;
  }
  if (obj.action === 'leave') {
    $('#p' + obj.player).fadeOut();
    fadeOutLastSet(obj.player);
    return;
  }

  if (obj.action === 'puzzled') {
    if (obj.player != me) showPuzzled(obj.player);
    return;
  }

  if (obj.action === 'add') {
    hideAllPuzzled();
    addCards(obj.cards);
    return;
  }

  if (obj.action === 'hint') {
    hideAllPuzzled();
    cards[obj.card].parent().addClass('hint');
    return;
  }

  if (obj.action === 'msg') {
    message(obj);
    return;
  }

  if (obj.action === 'win') {
    hideAllPuzzled();
    $('#board').fadeOut(650, function () {
      $('#board tr').remove();
      $('#board').append('<tr><td class="announcement"><h1>Player ' +
        (obj.player + 1)+ ' wins!</h1></td></tr>' +
        '<tr><td><span id="timer">15</span> seconds until the next round</td></tr>');
      resetTimer(15);
      $('#board').show();
      $('#hint').hide();
      message({event: true, msg: 'Player ' + (obj.player + 1)+ ' has won this round'});
    });
  }
});

function resetTimer(seconds) {
  $('#timer').text('' + seconds);
  if (seconds >= 0)
    setTimeout(function() {resetTimer(seconds-1);}, 1000);
  else
    initGame();
}

function initGame() {
  log('initting game');
  var init = {action: 'init'};
  var hash = window.location.hash;
  if (hash) {
    hash = hash.substring(hash.indexOf('#!/') + 3);
    init['game'] = hash;
    $('#share input').attr('value', window.location.href);

  }
  socket.send(init);
}

socket.on('connect', initGame);

socket.on('disconnect', function() {
  message({event:true, msg: 'Disconnected'})
});
socket.on('reconnect', function() {
  message({event:true, msg: 'Reconnected to server'})
});
socket.on('reconnecting', function(nextRetry) {
  message({event:true, msg: ('Attempting to re-connect to the server, next attempt in ' + nextRetry + 'ms')})
});
socket.on('reconnect_failed', function() {
  message({event:true, msg: 'Reconnect to server FAILED.'})
});

jQuery.extend( jQuery.easing,
{
  def: 'easeOutQuad',
  swing: function (x, t, b, c, d) {
    //alert(jQuery.easing.default);
    return jQuery.easing[jQuery.easing.def](x, t, b, c, d);
  },
  easeOutQuad: function (x, t, b, c, d) {
    return -c *(t/=d)*(t-2) + b;
  },
  easeOutBack: function (x, t, b, c, d, s) {
    if (s == undefined) s = 1.70158;
    return c*((t=t/d-1)*t*((s+1)*t + s) + 1) + b;
  }
});

function getSelText() {
  var txt = '';
  if (window.getSelection) {
    txt = window.getSelection();
  } else if (document.getSelection) {
    txt = document.getSelection();
  } else if (document.selection) {
    txt = document.selection.createRange().text;
  }
  return txt;
}

jQuery.fn.selText = function() {
    var obj = this[0];
    if ($.browser.msie) {
        var range = obj.offsetParent.createTextRange();
        range.moveToElementText(obj);
        range.select();
    } else if ($.browser.mozilla || $.browser.opera) {
        var selection = obj.ownerDocument.defaultView.getSelection();
        var range = obj.ownerDocument.createRange();
        range.selectNodeContents(obj);
        selection.removeAllRanges();
        selection.addRange(range);
    } else if ($.browser.safari) {
        var selection = obj.ownerDocument.defaultView.getSelection();
        selection.setBaseAndExtent(obj, 0, obj, 1);
    }
    return this;
}

function log(m) {
  if (typeof console !== 'undefined') console.log(m);
}
