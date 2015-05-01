var eon = eon || {};
eon.c = {
  observers: {},
  message: function(message, env, channel) {

    for(var i in eon.c.observers[channel]) {
      eon.c.observers[channel][i](message, env, channel);
    }

  },
  subscribe: function(pubnub, channel, connect, callback) {

    if(typeof(eon.c.observers[channel]) == "undefined") {

      eon.c.observers[channel] = [callback];

      pubnub.subscribe({
        channel: channel,
        connect: connect,
        message: function(message, env, channel) {

          eon.c.message(message, env, channel);

        }
      });

    } else {
      eon.c.observers[channel].push(callback);
    }

  },
  create: function(options) {

    var self = this;
    var error = false;

    c3 = c3;
    self.chart = false;

    self.pubnub = options.pubnub || PUBNUB || false;

    if(!self.pubnub) {
      error = "PubNub not found. See http://www.pubnub.com/docs/javascript/javascript-sdk.html#_where_do_i_get_the_code";
    }

    options.channel = options.channel || false;
    options.generate = options.generate || {};
    options.flow = options.flow || false;
    options.flow.length = options.flow.length || 0;
    options.limit = options.limit || 10;
    options.history = options.history || false;

    options.rate = options.rate || 1000;

    options.message = options.message || function(){};
    options.connect = options.connect || function(){};

    if(options.limit > 100) {
      options.limit = 100;
    }

    if(!options.channel) {
      error = "No channel supplied.";
    }

    var page = function() {

      all_messages = [];

      getAllMessages = function(timetoken) {
         self.pubnub.history({
          count: options.limit,
          channel: options.channel,
          start: timetoken,
           callback: function(payload) {

             var msgs = payload[0];
             var start = payload[1];
             var end = payload[2];

             if (msgs !== undefined && msgs.length) {

               msgs.reverse();

               i = 0;
               while(i < msgs.length) {
                 all_messages.push(msgs[[i]]);
                 i++;
               }

             }

             if (msgs.length && all_messages.length < options.limit) {
               getAllMessages(start);
             } else {

                var data = [];

               i = 0;
               while(i < all_messages.length) {

                var columns = all_messages[i].columns;

                 for(var j in columns) {

                    if(i == 0) {
                      data[j] = [];
                      data[j].push(columns[j][0]);
                    }

                    data[j].push(columns[j][1]);

                 }

                 i++;

               }

               // ready to go
               data.reverse();
               self.chart.load({columns: data});

             }

           }
         });
       };

       getAllMessages();

    };

    var buffer = []
    var needsTrim = function() {

      buffer = self.chart.data();

      for(i in buffer) {
        if(buffer[i].values.length > options.limit) {
          return buffer[i].values.length - options.limit;
          break;
        }
      }

      return false;

    };

    var lastData = [];
    var mapMessage = function(message) {

      var i = 0;

      // if we have data already
      if(lastData.length) {

        // loop through the new message
        while(i < message.columns.length) {

          var j = 0;
          var found = false;

          // and compare it against the old message
          while(j < lastData.length) {

            // if it's x, then see if the new one is larger
            if(
              message.columns[i][0] == 'x' &&
              lastData[j][0] == 'x'
            ) {

              if(message.columns[i][1] > lastData[j][1]) {
                lastData[j][1] = message.columns[i][1];
              }

              found = true;

            // if they have the same key, overwrite the buffer              }
            } else if(lastData[j][0] == message.columns[i][0]) {
              lastData[j][1] = message.columns[i][1];
              found = true;
            }

            j++;

          }

          if(!found) {
            lastData[j] = message.columns[i];
          }

          i++;

        }

      } else {
        lastData = message.columns;
      }

      message.columns = lastData;

      console.log(message);
      return message;

    };

    var boot = function() {

      options.generate.data.columns = [];
      self.chart = c3.generate(options.generate);

      if(options.history) {
        page();
      }

      var consumeMessage = function() {

      }

      eon.c.subscribe(self.pubnub, options.channel, options.connect, function(message, env, channel) {

        options.message(message, env, channel);

        if(options.flow) {

          if(options.flow === true) {
            options.flow = {};
          }

          var trimLength = needsTrim();

          if(trimLength)  {
            options.flow.length = trimLength;
          }

          message = mapMessage(message);

          options.flow.columns = message.columns;

          self.chart.flow(options.flow);

        } else {
          self.chart.load(mapMessage(message));
        }

      });

      return self;

    };

    if(error) {
      console.error("EON: " + error);
    } else {
      boot();
    }

    return self.chart;

  }
};
eon.chart = function(o) {
  return new eon.c.create(o);
};