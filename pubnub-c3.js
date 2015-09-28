"use strict";

var eon = eon || {};
eon.subsub = eon.subsub || subsub;
eon.c = {
  create: function(options) {

    var self = this;
    var error = false;

    self.chart = false;

    self.is_dead = false;

    self.pubnub = options.pubnub || PUBNUB || false;

    if(!self.pubnub) {
      error = "PubNub not found. See http://www.pubnub.com/docs/javascript/javascript-sdk.html#_where_do_i_get_the_code";
    }

    options.transform = options.transform || function(m){return m};
    options.channel = options.channel || false;
    options.generatge = options.generate || {};
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

              i = 0;
               while(i < msgs.length) {
                 all_messages.push(msgs[[i]]);
                 i++;
               }

             }

             if (msgs.length && all_messages.length < options.limit) {
               getAllMessages(start);
             } else {

                i = 0;
                while(i < all_messages.length) {

                  render(all_messages[i].columns);
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

    var storeData = function(data) {

      var i = 0;
      if(!dataStore.length) {
        dataStore = JSON.parse(JSON.stringify(data));
      } else {

        while(i < data.length) {

          // if this is a new key, add the id
          if(typeof dataStore[i] == "undefined") {
            dataStore[i] = [data[i][0]];
          }

          dataStore[i].push(data[i][1]);

          if(dataStore[i].length > options.limit) {
            dataStore[i].splice(1,1);
          }

          i++;
        }

      }

    }

    var kill = function() {

      console.log('kill')

      self.is_dead = true;

      if(['donut', 'pie', 'gauge'].indexOf(options.generate.data.type) == -1) {
        self.chart.destroy();
      }

      delete self.chart;

    };

    var boot = function() {

      console.log('boot')
      
      self.is_dead = false;

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

      if (Visibility.hidden()) {
        kill();
      } else {
        boot();
      }

    });

    var render = function(data) {

      storeData(data);

      if(self.is_dead) {

        console.log('got data while unfocused')
        console.log(data)

      } else {

        if(options.flow) {

          var trimLength = needsTrim();

          if(trimLength)  {
            options.flow.length = 1;
          }

          options.flow.columns = data;
          self.chart.flow(options.flow);

        } else {

          self.chart.load({
            columns: data
          });

        }
         
      }

    }

    var init = function() {

      if(options.history) {
        page();
      }

      subsub.subscribe(self.pubnub, options.channel, options.connect, function(message, env, channel) {

        var message = options.transform(message);

        options.message(message, env, channel);

        render(message.columns);

      });

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
