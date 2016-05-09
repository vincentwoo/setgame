May 2016 Update
===============

Set Enterprises, Inc has been after me for a few years to take down multiplayerset.com.
I've sort of lost the willpower to deal with them, so I've just taken down the hosted
version of the game and redirected it to here. If you want to play with the code to see
how it worked, go nuts. Sorry to any longtime fans. If you're in SFBA, hit me up, let's
get coffee: me@vincentwoo.com.

Addendum
--------

A certain player wrote in:

> Also, so there is someone that I would run into while playing set online who was really really good (the only person to beat me in years - trying not to humble brag but its true). If someone else emails you can you let them know I'm interested in staying in contact?

The suspected time of play was PST. If you'd like to be put in touch (even if you're not sure if you're the particular person being asked after), please feel free to write in!

nodeJS + set
============

This is a multiplayer, realtime implementation of the popular ["Set" card game][1].
It uses [socket.io][2] to achieve realtime feedback with clients and [jQuery][3] for
various clientside animations.

After cloning:

    git submodule update --init --recursive
    npm install

The server runs in dev mode with:

    npm run-script dev

or prod (requires sudo for port 80):

    sudo npm run-script prod

[1]: http://en.wikipedia.org/wiki/Set_(game)
[2]: http://socket.io/
[3]: https://github.com/jquery/jquery
