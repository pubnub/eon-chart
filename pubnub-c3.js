"use strict";

var eon = eon || {};
eon.subsub = eon.subsub || subsub;
eon.c = {
  create: function(options) {

    var self = this;
    var error = false;

    self.chart = false;

    self.pubnub = options.pubnub || PUBNUB || false;

    if(!self.pubnub) {
      error = "PubNub not found. See http://www.pubnub.com/docs/javascript/javascript-sdk.html#_where_do_i_get_the_code";
    }

    options.transform = options.transform || function(m){return m};
    options.channel = options.channel || false;
    options.generate = options.generate || {};
    if(!options.generate.data) {
      options.generate.data = {
        columns: null
      };
    }
    options.flow = options.flow || false;
    if(options.flow) { 
      if(typeof(options.flow) == "boolean") {
        options.flow = {};
      }
      options.flow.length = options.flow.length || 0;
    }
    options.limit = options.limit || 10;
    options.history = options.history || false;

    options.rate = options.rate || 1000;

    options.message = options.message || function(){};
    options.connect = options.connect || function(){};

    if(!options.channel) {
      error = "No channel supplied.";
    }

    var all_messages = [];
    var page = function() {

      all_messages = [];
      var i = 0;

      var getAllMessages = function(timetoken) {
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

                    if(i === 0) {
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

    var buffer = [];
    var needsTrim = function() {

      buffer = self.chart.data();

      var i = 0;

      while(i < buffer.length) {

        if(buffer[i].values.length > options.limit) {
          var trimLength = buffer[i].values.length - 1 - options.limit;
          return trimLength;
        }
        i++;

      }

      return false;

    };


    var lastData = [];

    var customX = 1;
    var dataStore = [];
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

            // if they have the same key, overwrite the buffer              }
            }

            if(lastData[j][0] == message.columns[i][0]) {
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

      i = 0;
      if(!dataStore.length) {
        dataStore = JSON.parse(JSON.stringify(lastData));
      } else {

        while(i < message.columns.length) {

          if(typeof dataStore[i] == "undefined") {
            dataStore[i] = [message.columns[i][0]];
          }

          dataStore[i].push(message.columns[i][1]);

          if(dataStore[i].length > options.limit) {
            dataStore[i].splice(1,1);
          }

          i++;
        }

      }

    };

    var updateInterval = false;

    var kill = function() {
      delete self.chart;
    };

    var boot = function() {

      options.generate.data.columns = dataStore;

      if(dataStore.length && dataStore[0].length - 1 > options.limit) {
        dataStore = [];
      }

      self.chart = c3.generate(options.generate);

    };

    var init = function() {

      if(options.history) {
        page();
      }

      subsub.subscribe(self.pubnub, options.channel, options.connect, function(message, env, channel) {

        var message = options.transform(message);

        options.message(message, env, channel);
        mapMessage(message);

      });

      var recursive = function(){

        if(lastData.length) {

          if(options.flow) {

            var trimLength = needsTrim();

            if((buffer.length && !buffer[0].values.length) || trimLength > 1) {

                kill();
                boot();

            } else {

              if(trimLength)  {
                options.flow.length = 1;
              }

              options.flow.columns = lastData;
              self.chart.flow(options.flow);

            }

          } else {
            self.chart.load({
              columns: lastData
            });
          }

        }
        setTimeout(function(){
          recursive();
        }, options.rate);
      };
      recursive();

      return self;

    };

    if(error) {
      console.error("EON: " + error);
    } else {
      init();
      boot();

    }

    return self.chart;

  }
};
eon.chart = function(o) {
  return new eon.c.create(o);
};
