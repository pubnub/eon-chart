"use strict";

window.eon = window.eon || {};
window.PubNub = PubNub;
window.eon.c = {
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

    self.pubnub = options.pubnub || PubNub || false;

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
        x: options.x_id
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
          includeTimetoken: true
        }, function(status, payload) {

          var msgs = payload.messages;
          var start = payload.startTimeToken;
          var end = payload.endTimeToken;

          clog('History:', msgs.length + ' messages found');

          clog('History:', 'Complete... Rendering');

          i = 0;
          while (i < msgs.length) {

            var a = msgs[i];

            a.message = options.transform(a.entry);

            if(a.message && (a.message.eon || a.message.eons)) {

              var as = a.message.eons || [];

              if(a.message.eon) {
                as.push(a.message.eon);
              }

              for(var j in as) {

                if(as.hasOwnProperty(j)) {
                  as[j] = appendDate(as[j], a.timetoken)
                  storeData(as[j], true);  
                }
                
              }

            } else {
              clog('Rejecting history message as improper format supplied.');
            }

            

            i++;

          }

          if (msgs.length > 1 && object.json.length < options.limit - 1) {
            page(end);
          } else {
            loadData(object);
            done();
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
          x: options.x_id
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

    var storeData = function(data, is_history) {

      object.json.push(data);
      
      if(object.json.length > options.limit) {
        object.json.shift();
        flowLength++;
      }

      mapAppend(object);

      if (options.flow && !is_history) {

        fobject.json.push(data);
        mapAppend(fobject);

      };

    };

    var loadData = function(data) {
      flowLength = 0;
      clog('Load Data')
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
              x: options.x_id
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

      self.pubnub.addListener({
        status: function(statusEvent) {
          if (statusEvent.category === "PNConnectedCategory") {
            options.connect();
          }
        },
        message: function(m) {

          if(m.channel == options.channel) {
            
            clog('PubNub:', '-------------------');
            clog('PubNub:', 'Received Message', m);

            clog('PubNub:', 'Transforming Message using options.transform');

            var message = options.transform(m.message);

            if(message && (message.eon || message.eons)) {

              var ms = message.eons || [];

              if(message.eon) {
                ms.push(message.eon);
              }

              for(var i in ms) {
                
                if(ms.hasOwnProperty(i)) {

                  ms[i] = appendDate(ms[i], m.timetoken);
                  clog('PubNub:', 'Message Result', ms[i]);

                  stale = true;
                  storeData(ms[i], false);
                   
                }

              }

              clog('PubNub:', 'Calling options.message');
               
            } else {

                if(message && !message.eon) {
                  console.error('Eon messages must be in proper format. For example:',  {eon: [1,2,3]})
                } else {
                  clog('EON:', 'Message rejected');
                }

            }
            
            options.message(message, m.timetoken, m.channel);

          }

        }
      });

      self.pubnub.subscribe({
        channels: [options.channel]
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
window.eon.chart = function(o) {
  return new window.eon.c.create(o);
};
