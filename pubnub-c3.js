"use strict";

var eon = eon || {};
eon.subsub = eon.subsub || subsub;
eon.c = {
  create: function(options) {

    options.debug = options.debug || false;

    var clog = function(s, o, e) {

      if(options.debug) {
        if(e) {
          console.log('EON-CHART:', s, o, e); 
        } else {
          console.log('EON-CHART:', s, o);
        }
      }  
    };

    clog('Status:', 'Initialized');

    var self = this;
    var error = false;
    var dateID = "_eon_datetime";

    self.chart = false;
    self.is_dead = false;

    self.pubnub = options.pubnub || PUBNUB || false;

    if(!self.pubnub) {
      error = "PubNub not found. See http://www.pubnub.com/docs/javascript/javascript-sdk.html#_where_do_i_get_the_code";
    }

    options.transform = options.transform || function(m){return m};
    options.channel = options.channel || false;
    options.generate = options.generate || {};
    if(!options.generate.data) {
      options.generate.data = {
        json: null
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

    // x axis definition
    options.x_type = options.x_type || "auto";
    options.x_id = options.x_id || "";

    if(options.x_type == "custom") {

      options.generate.data.x = options.x_id; 
       
    } else if(options.x_type == "auto") {

      options.x_id = dateID;
      options.generate.data.x = options.x_id; 

    } else {
      options.x_type = false;
    }

    if(options.x_type) {

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

    clog('Options:', options);

    if(!options.channel) {
      error = "No channel supplied.";
    };

    var object = {
      json: [],
      keys: {
        value: [],
        x: dateID
      }
    };
    
    var longest = function(array) {

      // this should just check xvalues instead of caring about points

      var longest = 0;
      var j = 0;
      for(var i in array) {
        if(array[i].length > longest && array[i][0] !== options.x_id) {
          longest = array[i].length;
          j = i;
        }
      }

      return {
        length: longest,
        i: j,
        key: array[j][0]
      }

    }

    var appendDate = function(data, pubnub_date) {

      if(options.x_type == "auto") {
        clog('PubNub:', 'Appending PubNub datetime to columns.');
        var date = Math.floor(pubnub_date / 10000);
        data[dateID] = new Date(date).getTime();
      }

      return data;
       
    };

    var all_messages = [];
    var page = function() {

      clog('Status:', 'Restoring from history');

      all_messages = [];
      var i = 0;

      var getAllMessages = function(timetoken) {
      
        clog('History:', 'Retrieving messages from ' + timetoken);

         self.pubnub.history({
          count: options.limit,
          channel: options.channel,
          start: timetoken,
          include_token: true,
          callback: function(payload) {

             var msgs = payload[0];
             var start = payload[1];
             var end = payload[2];

             clog('History:', msgs.length + ' messages found');

              clog('History:', 'Complete... Rendering');

              i = 0;
              while(i < msgs.length) {

                var inArray = false;
                var a = msgs[i];

                a = appendDate(a.message.json, a.timetoken)
                dataStore = storeData(a, dataStore);

                i++;

              }

              if(longest(dataStore).length < options.limit - 1) {
                getAllMessages(end);
              } else {
                self.chart.load({
                  json: dataStore
                }); 
              }

           }
         });
       };

       getAllMessages();

    };

    var reboot = function() {
      kill();
      boot();
    };

    var needsTrim = function() {

      var buffer = self.chart.data();

      var i = 0;

      while(i < buffer.length) {

        if(buffer[i].values.length > options.limit - 1) {
          return true;
        }
        i++;

      }

      return false;

    };

    var nextData = [];
    var dataStore = [];

    var kill = function() {

      clog('Status:', 'Chart Animation Disabled');

      self.is_dead = true;

      if(['donut', 'pie', 'gauge'].indexOf(options.generate.data.type) == -1) {
        self.chart.destroy();
      }

      delete self.chart;

    };

    var boot = function() {

      clog('Status:', 'Chart Animation Enabled');
      
      self.is_dead = false;

      options.generate.data.columns = [];
      self.chart = c3.generate(options.generate);

    };

    Visibility.change(function (e, state) {

      if (Visibility.hidden()) {
        kill();
      } else {
        boot();
        console.log(object)
        self.chart.load(object)
      }

    });

    var uniqueAppend = function(array, append) {

      // see if value is in array of keys
      var exists = false;
      for(var l in array) {
        if(array[l] == append) {
          exists = true;
        }
      }

      if(!exists) {
        array.push(append);
      }

      return array;

    };

    var storeC3 = function(data) {

      console.log('-----')

      console.log(data)

      object.json.push(data);

      if(object.json.length > options.limit) {
        object.json.shift();
      }

      for(var i in object.json) {
        console.log(object.json[i])
        for(var key in object.json[i]) {
          object.keys.value = uniqueAppend(object.keys.value, key);
        }
      }
      /*
      for(var key in data) {
        
        for(var j in data[key].values) {
          
          var value = data[key].values[j];

          var thisDate = new Date(value.x).getTime();
          var exists = false;

          // see if you can find an object with the same date
          for(var l in object.json) {
            if(object.json[l][dateID] == thisDate) {
              object.json[l][value.id] = value.value;
              exists = true;
            }
          }

          // otherwise create that object
          if(!exists) {

            var tmpobj = {};
            tmpobj[dateID] = thisDate;
            tmpobj[value.id] = value.value;
            object.json.push(tmpobj);

            object.json.slice(1,1);
             
          }

        }

      }
      */

      console.log(object);

    }

    var render = function(data) {

      clog('Status:', 'Rendering');

      storeC3(data);

      if(self.is_dead) {

        clog('Render:', 'Tab out of focus.');

      } else {

        if(options.flow) {
          
          clog('Render:', 'Flow enabled, appending to chart.');

          var trimLength = needsTrim();

          if(trimLength)  {
            options.flow.length = 1;
            clog('Render:', 'Data exceeds options.limit, trimming buffer.');
          }

          options.flow.json = data;
          self.chart.flow(options.flow);

        } else {

          clog('Render:', 'Updating chart.');

          self.chart.load({
            json: data
          });

        }
         
      }

    }

    var init = function() {

      if(options.history) {
        page();
      }
      
      clog('PubNub:', 'Subscribed to ' + options.channel);

      subsub.subscribe(self.pubnub, options.channel, options.connect, function(message, env, channel) {

        clog('PubNub:', '-------------------');
        clog('PubNub:', 'Received Message', message);

        clog('PubNub:', 'Transforming Message using options.transform');
        var message = options.transform(message);

        message.json = appendDate(message.json, env[1]);

        clog('PubNub:', 'Message Result', message);
      
        render(message.json);

        clog('PubNub:', 'Calling options.message');
        options.message(message, env, channel);

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
