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

    options.xcolumn = options.xcolumn || false;

    if(options.xcolumn) {

      if(!options.generate.axis) {
        options.generate.axis = {}
      }

      // assume js date
      if(!options.generate.axis.x) {

        options.generate.axis.x = {
          type: 'timeseries',
          tick: {
              format: '%Y-%m-%d %H:%M:%S'
          }
        }

      }
       
    }

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
    var lastX = null;
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
              message.columns[i][0] == options.xcolumn &&
              lastData[j][0] == options.xcolumn
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

    };

    var updateInterval = false;

    var kill = function() {
      // self.chart.destroy(); waiting on #1305
      delete self.chart;
    };

    var boot = function() {

      if(options.xcolumn) {
        options.generate.data.x = options.xcolumn; 
      }

      options.generate.data.columns = dataStore;

      if(dataStore.length && dataStore[0].length - 1 > options.limit) {
        dataStore = [];
      }

      self.chart = c3.generate(options.generate);

    };

    var reboot = function() {
      kill();
      boot();
    };

    Visibility.change(function (e, state) {
        reboot();
      }
    });

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

        var newx = false;
        var i = 0;

        if(!dataStore.length || !options.xcolumn) {
          newx = true;
        }

        // find out if this x value is different from the last plotted
        while(i < lastData.length) {

          if(lastData[i][0] == options.xcolumn) {

            var j = 0;

            while(j < dataStore.length) {

              if(dataStore[j][0] == options.xcolumn &&
                dataStore[j][dataStore[j].length - 1] !== lastData[i][1]) {
                newx = true;
              }

              j++;
            }


          }

          i++;
        }

        if(newx && lastData.length) {

          if(options.flow) {

            var trimLength = needsTrim();

            if((buffer.length && !buffer[0].values.length) || trimLength > 1) {
              reboot();
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

          var i = 0;
          if(!dataStore.length) {
            dataStore = JSON.parse(JSON.stringify(lastData));
          } else {

            while(i < lastData.length) {

              // if this is a new key, add the id
              if(typeof dataStore[i] == "undefined") {
                dataStore[i] = [lastData[i][0]];
              }

              dataStore[i].push(lastData[i][1]);

              if(dataStore[i].length > options.limit) {
                dataStore[i].splice(1,1);
              }

              i++;
            }

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

  },
  flatten: function(ob) {

    var toReturn = {};
    
    for (var i in ob) {
      if (!ob.hasOwnProperty(i)) continue;
      
      if ((typeof ob[i]) == 'object') {
        var flatObject = eon.c.flatten(ob[i]);
        for (var x in flatObject) {
          if (!flatObject.hasOwnProperty(x)) continue;
          
          toReturn[i + '.' + x] = flatObject[x];
        }
      } else {
        toReturn[i] = ob[i];
      }
    }
    
    return toReturn;

  }
};
eon.chart = function(o) {
  return new eon.c.create(o);
};
