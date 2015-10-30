"use strict";

var eon = eon || {};
eon.subsub = eon.subsub || subsub;
eon.c = {
  create: function(options) {

    options.debug = options.debug || false;

    var clog = function(s, o, e) {

      if (options.debug) {
        if (e) {
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

    if (!self.pubnub) {
      error = "PubNub not found. See http://www.pubnub.com/docs/javascript/javascript-sdk.html#_where_do_i_get_the_code";
    }

    options.transform = options.transform || function(m) {
      return m
    };
    options.channel = options.channel || false;
    options.generate = options.generate || {};
    if (!options.generate.data) {
      options.generate.data = {
        json: null
      };
    }

    options.generate.line = options.generate.line || {};
    
    if(!options.generate.line.connectNull) {
      options.generate.line.connectNull = true;
    }

    options.flow = options.flow || false;
    if (options.flow) {
      if (typeof(options.flow) == "boolean") {
        options.flow = {};
      }
      options.flow.length = options.flow.length || 0;
    }
    options.history = options.history || false;

    options.message = options.message || function() {};
    options.connect = options.connect || function() {};

    // x axis definition
    options.x_type = options.x_type || "auto";
    options.x_id = options.x_id || "x";

    options.rate = options.rate || 1000;

    if (options.x_type == "custom") {

      options.generate.data.x = options.x_id;

    } else if (options.x_type == "auto") {

      options.x_id = dateID;
      options.generate.data.x = options.x_id;

    } else {
      options.x_type = false;
    }

    if (options.x_type) {

      clog('Setup:', 'X_Type Supplied');

      if (!options.generate.axis) {
        options.generate.axis = {}
      }

      // assume js date
      if (!options.generate.axis.x) {
        options.generate.axis.x = {};
      }
      if (!options.generate.axis.x.type) {
        options.generate.axis.x.type = 'timeseries';
      }
      if (!options.generate.axis.x.tick) {
        options.generate.axis.x.tick = {};
      }
      if (!options.generate.axis.x.tick.format) {
        options.generate.axis.x.tick.format = '%Y-%m-%d %H:%M:%S';
      }

    }

    clog('Options:', options);

    if (!options.channel) {
      error = "No channel supplied.";
    };

    if (['spline', 'area', 'area-spline', 'step', 'area-step', 'scatter'].indexOf(options.generate.data.type) == -1 
      && typeof(options.generate.data.type) != "undefined") {
      options.limit = options.limit || 1;
    } else {
      options.limit = options.limit || 10;
    }

    var appendDate = function(data, pubnub_date) {

      if (options.x_type == "auto") {
        clog('PubNub:', 'Appending PubNub datetime to columns.');
        var date = Math.floor(pubnub_date / 10000);
        data[dateID] = new Date(date).getTime();
      }

      return data;

    };


    var nextData = [];
    var dataStore = [];

    // persistent data store
    var object = {
      json: [],
      keys: {
        value: [],
        x: dateID
      }
    };

    // data store for flow animations
    var fobject = {};
    var stale = false;

    var getAllMessages = function(done) {

      clog('Status:', 'Restoring from history');

      var i = 0;

      var page = function(timetoken) {

        clog('History:', 'Retrieving messages from ' + timetoken);

        self.pubnub.history({
          count: options.limit,
          channel: options.channel,
          end: timetoken,
          include_token: true,
          callback: function(payload) {

            var msgs = payload[0];
            var start = payload[1];
            var end = payload[2];

            clog('History:', msgs.length + ' messages found');

            clog('History:', 'Complete... Rendering');

            i = 0;
            while (i < msgs.length) {

              var a = msgs[i];

              a = appendDate(a.message.eon, a.timetoken)
              storeData(a);

              i++;

            }

            if (msgs.length > 1 && object.json.length < options.limit - 1) {
              page(end);
            } else {
              loadData(object);
              done();
            }

          }
        });
      };

      page();

    };

    var kill = function() {

      clog('Status:', 'Chart Animation Disabled');

      self.is_dead = true;

      if (['donut', 'pie', 'gauge'].indexOf(options.generate.data.type) == -1) {
        self.chart.destroy();
      }

      delete self.chart;

    };

    var boot = function() {  

      fobject = {
        json: [],
        keys: {
          value: [],
          x: dateID
        }
      };

      clog('Status:', 'Chart Animation Enabled');

      self.is_dead = false;

      options.generate.data.columns = [];
      self.chart = c3.generate(options.generate);

    };

    Visibility.change(function(e, state) {

      if (Visibility.hidden()) {
        kill();
      } else {
        boot();
        loadData(object)
      }

    });

    var uniqueAppend = function(array, append) {

      // see if value is in array of keys
      var exists = false;
      for (var l = 0; l < array.length; l++) {
        if (array[l] == append) {
          exists = true;
        }
      }

      if (!exists) {
        array.push(append);
      }

      return array;

    };

    var flowLength = 0;

    var mapAppend = function(object) {

      // this just keeps a list of used keys in the object
      for (var i = 0; i < object.json.length; i++) {
        for (var key in object.json[i]) {
          object.keys.value = uniqueAppend(object.keys.value, key);
        }
      }

      return object;

    }

    var storeData = function(data) {

      object.json.push(data);
      
      if(object.json.length > options.limit) {
        object.json.shift();
        flowLength++;
      }

      mapAppend(object);

      if (options.flow) {

        fobject.json.push(data);
        mapAppend(fobject);

      };

    };

    var loadData = function(data) {
      flowLength = 0;
      self.chart.load(data);
    }

    setInterval(function(){

      clog('Status:', 'Rendering');

      if (!stale) {
        clog('Render:', 'No new data');
      } else if(self.is_dead) {
        clog('Render:', 'Tab out of focus.');
      } else {

        if(fobject.json.length) {
          
          fobject.length = flowLength;
          
          self.chart.flow(fobject);

          fobject = {
            json: [],
            keys: {
              value: [],
              x: dateID
            }
          };

          flowLength = 0;

        } else {
          loadData(object);
        }

        stale = false;

        clog('Render:', 'Complete');

      }

    }, options.rate);

    var elog = function(text) {
      console.error("EON:" + text);
      kill();
    };

    var subscribe = function() {

      subsub.subscribe(self.pubnub, options.channel, options.connect, function(message, env, channel) {

        clog('PubNub:', '-------------------');
        clog('PubNub:', 'Received Message', message);

        clog('PubNub:', 'Transforming Message using options.transform');

        // v0.4 migration notice to be deprecated
        if(message.columns) {
          elog('Error! The data schema has been updated. Please publish data using our new JSON schema. See: https://github.com/pubnub/eon-chart');
        } else {

          var message = options.transform(message);

          message.eon = appendDate(message.eon, env[1]);

          clog('PubNub:', 'Message Result', message);

          stale = true;
          storeData(message.eon);

          clog('PubNub:', 'Calling options.message');
          options.message(message, env, channel);
           
        }

      });

    };

    var init = function() {

      clog('PubNub:', 'Subscribed to ' + options.channel);

      if (options.history) {
        getAllMessages(function(){
          subscribe();
        });
      } else {
        subscribe();
      }

    };

    if (error) {
      elog(error);
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