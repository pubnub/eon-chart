"use strict";

var eon = eon || {};
eon.subsub = eon.subsub || subsub;
eon.c = {
  create: function(options) {

    var self = this;
    var error = false;

    self.chart = false;

    self.tick = false;
    self.rTick = setTimeout(function(){}, 1);

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

        console.log(timetoken)

         self.pubnub.history({
          count: options.limit,
          channel: options.channel,
          start: timetoken,
           callback: function(payload) {

             var msgs = payload[0];
             var start = payload[1];
             var end = payload[2];

             if (msgs !== undefined && msgs.length) {

              i = 0;
               while(i < msgs.length) {
                 all_messages.push(msgs[[i]]);
                 i++;
               }

             }

             console.log(options.limit)
             console.log(all_messages.length)

             if (msgs.length && all_messages.length < options.limit) {
               getAllMessages(start);
             } else {

                console.log('done')

                i = 0;
                while(i < all_messages.length) {

                  addNextData(all_messages[i]);    
                  self.tick(true);
                  i++;

                }

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

    var nextData = [];
    var lastX = null;
    var dataStore = [];

    var storeData = function() {

      var i = 0;
      if(!dataStore.length) {
        dataStore = JSON.parse(JSON.stringify(nextData));
      } else {

        while(i < nextData.length) {

          // if this is a new key, add the id
          if(typeof dataStore[i] == "undefined") {
            dataStore[i] = [nextData[i][0]];
          }

          dataStore[i].push(nextData[i][1]);

          if(dataStore[i].length > options.limit) {
            dataStore[i].splice(1,1);
          }

          i++;
        }

      }

    }

    var addNextData = function(message) {

      var i = 0;

      // if we have data already
      if(nextData.length) {

        // loop through the new message
        while(i < message.columns.length) {

          var j = 0;
          var found = false;

          // and compare it against the old message
          while(j < nextData.length) {

            // if it's x, then see if the new one is larger
            if(
              message.columns[i][0] == options.xcolumn &&
              nextData[j][0] == options.xcolumn
            ) {

              if(message.columns[i][1] > nextData[j][1]) {
                nextData[j][1] = message.columns[i][1];
              }

              
            }
            
            // if they have the same key, overwrite the buffer
            if(nextData[j][0] == message.columns[i][0]) {
              nextData[j][1] = message.columns[i][1];
              found = true;
            }

            j++;

          }

          if(!found) {
            nextData[j] = message.columns[i];
          }

          i++;

        }

      } else {
        nextData = message.columns;
      }

    };

    var kill = function() {
      
      clearTimeout(self.rTick)

      if(['donut', 'pie', 'gauge'].indexOf(options.generate.data.type) == -1) {
        self.chart.destroy();
      }

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

      self.tick();

    };

    var reboot = function() {
      kill();
      boot();
    };

    Visibility.change(function (e, state) {

      if (Visibility.hidden()) {
        kill();
      } else {
        boot();
      }

    });

    var render = function() {

      if(options.flow) {

        var trimLength = needsTrim();

        if((buffer.length && !buffer[0].values.length) || trimLength > 1) {
          reboot();
        } else {

          if(trimLength)  {
            options.flow.length = 1;
          }

          options.flow.columns = nextData;
          self.chart.flow(options.flow);

        }

      } else {

        self.chart.load({
          columns: nextData
        });

      }

    }

    var init = function() {

      if(options.history) {
        page();
      }

      subsub.subscribe(self.pubnub, options.channel, options.connect, function(message, env, channel) {

        var message = options.transform(message);

        options.message(message, env, channel);
        addNextData(message);

      });

      self.tick = function(disable_recursive){

        var newx = false;
        var i = 0;

        if(!dataStore.length || !options.xcolumn) {
          newx = true;
        }

        // find out if this x value is different from the last plotted
        while(i < nextData.length) {

          if(nextData[i][0] == options.xcolumn) {

            var j = 0;

            while(j < dataStore.length) {

              if(dataStore[j][0] == options.xcolumn &&
                dataStore[j][dataStore[j].length - 1] !== nextData[i][1]) {
                newx = true;
              }

              j++;
            }


          }

          i++;
        }

        if(newx && nextData.length) {

          render();
          storeData();

        }

        if(!disable_recursive) {

          self.rTick = setTimeout(function(){
            self.tick();
          }, options.rate);
           
        }

      };

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
