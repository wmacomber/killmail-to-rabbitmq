# killmail-to-rabbitmq

This listens to the killmail websocket feed (though it could easily be modified to listen to the HTTP feed instead) provided by zKillboard.  It takes whatever is posted, ~~grabs some additional character info~~, and reposts it to a RabbitMQ stream.  (I now just post the raw contents to the message queue - ingest to the queue should be as fast as possible and something upstream can enhance incoming data).

I built this mainly because I have multiple ideas for things to do with the killmail feed, but I can only pull a single feed at a time to my home (where I do my development) or I risk getting my IP banned.  So I figured I'd pipe the feed into a queue and expire it after a day.  That way, I can hook multiple apps up to it at the same time and not hammer zKillboard's server(s).

You want to do this yourself?  If you don't already have a RabbitMQ server, Docker is your friend.  https://hub.docker.com/_/rabbitmq is the home of the official RabbitMQ image.  That's the hard part - the code that listens to the feed and throws it into a queue is the easy part.