var socketPort = window.location.host.indexOf('setgame') != -1 ? 9980 : 80
  , socket = new io.Socket(null, {
        port: 80
      , transports: ['websocket', 'xhr-polling', 'jsonp-polling']
      , rememberTransport: false
      , transportOptions: {
            websocket: { port: socketPort }
        }
  })
  , selected = []
  , cards = []
  , lastSets = {}
  , me;

$(document.body).ready( function() {
  setTimeout(function() {
    socket.connect();
  }, 250);
  $('#hint').click(hint);
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
  setTimeout(function() { $('#hint').show(); }, 610);
}

socket.on('message', function(obj){
  log(obj);
  if (!obj.action) return;
  if (obj.action === 'init') {
    addCards(obj.board);
    updateScores(obj.players);
    me = obj.you;
    $('#me-indicator').prependTo($('#p' + me));
    $('#hint').css('display', 'block');
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
        var offsx = (j * 33) + 40 +
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
                $(this).css('left', j * 33 + 40);
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

  if (obj.action === 'win') {
    hideAllPuzzled();
    $('#board').fadeOut('slow', function () {
      $('#board').html('<h1>Player ' + (obj.player + 1)+ ' wins!</h1>');
      $('#board').show();
    });
  }
});

socket.on('connect', function() {
  var init = {action: 'init'};
  var hash = window.location.hash;
  if (hash) {
    hash = hash.substring(hash.indexOf('#!/') + 3);
    init['game'] = hash;
  }
  socket.send(init);
});

$(document).bind('mousedown', function(event) {
  var target = $(event.target)[0];
  var idx = cards.map( function(v) { return v[0]; } ).indexOf(target);

  if (idx != -1) {
    select(idx);
  } else {
    clearSelected();
  }
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

function log(m) {
  if (typeof console !== 'undefined') console.log(m);
}
/*socket.on('disconnect', function(){ message({ message: ['System', 'Disconnected']})});
socket.on('reconnect', function(){ message({ message: ['System', 'Reconnected to server']})});
socket.on('reconnecting', function( nextRetry ){ message({ message: ['System', 'Attempting to re-connect to the server, next attempt in ' + nextRetry + 'ms']})});
socket.on('reconnect_failed', function(){ message({ message: ['System', 'Reconnected to server FAILED.']})});*/