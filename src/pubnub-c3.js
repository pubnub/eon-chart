"use strict";

module.exports = function(options, c3, Visibility, PubNub) {

  console.log(PubNub)

  console.log(options)

    options.debug = options.debug || false;

    var self = this;

    self.clog = function(s, o, e) {

      if (options.debug) {
        if (e) {
          console.log('EON-CHART:', s, o, e);
        } else {
          console.log('EON-CHART:', s, o);
        }
      }
    };

    self.clog('Status:', 'Initialized');

    self.error = false;
    self.dateID = "_eonDatetime";

    self.chart = false;
    self.isDead = false;

    self.pubnub = options.pubnub || PubNub || false;

    if (!self.pubnub) {
      self.error = "PubNub not found. See http://www.pubnub.com/docs/javascript/javascript-sdk.html#_where_do_i_get_the_code";
    }

    options.transform = options.transform || function(m) {
      return m
    };
    options.channels = options.channels || false;
    options.channelGroups = options.channelGroups || false;

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
    options.xType = options.xType || "auto";
    options.xId = options.xId || "x";

    options.rate = options.rate || 1000;

    if (options.xType == "custom") {

      options.generate.data.x = options.xId;

    } else if (options.xType == "category") {
        // just so xtype is not false
    } else if (options.xType == "auto") {

      options.xId = self.dateID;
      options.generate.data.x = options.xId;

    } else {
      options.xType = false;
    }

    self.generateXAxis = function() {

      if (!options.generate.axis) {
        options.generate.axis = {}
      }

      // assume js date
      if (!options.generate.axis.x) {
        options.generate.axis.x = {};
      }

    }

    if (options.xType) {

      self.clog('Setup:', 'xType Supplied');

      self.generateXAxis();

      // bar chart needs to be of type "category"
      if(options.xType == "category") {

        console.log(options.xType)
        console.log('running this')

        if (!options.generate.axis.x.type) {
          options.generate.axis.x.type = 'category';
        }

      } else {

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

    }

    self.clog('Options:', options);

    if (!options.channels && !options.channelGroups) {
      self.error = "No channels or channel groups supplied.";
    };

    if (['spline', 'area', 'area-spline', 'step', 'area-step', 'scatter'].indexOf(options.generate.data.type) == -1
      && typeof(options.generate.data.type) != "undefined") {
      options.limit = options.limit || 1;
    } else {
      options.limit = options.limit || 10;
    }

    self.appendDate = function(data, pubnubDate) {

      if (options.xType == "auto") {
        self.clog('PubNub:', 'Appending PubNub datetime to columns.');
        var date = Math.floor(pubnubDate / 10000);
        data[self.dateID] = new Date(date).getTime();
      }

      return data;

    };


    self.nextData = [];
    self.dataStore = [];

    // persistent data store
    self.object = {
      json: [],
      keys: {
        value: [],
        x: options.xId
      }
    };

    // data store for flow animations
    self.fobject = {};
    self.stale = false;

    self.loadHistory = function() {

      self.clog('Status:', 'Restoring from history');

      for(var k in options.channels) {

        var i = 0;

        var page = function(timetoken) {

          self.clog('History:', 'Retrieving messages from ' + timetoken);

          self.pubnub.history({
            count: options.limit,
            channel: options.channels[k],
            end: timetoken,
            includeTimetoken: true
          }, function(status, payload) {

            var msgs = payload.messages;
            var start = payload.startTimeToken;
            var end = payload.endTimeToken;

            self.clog('History:', msgs.length + ' messages found');

            self.clog('History:', 'Complete... Rendering');

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
                    as[j] = self.appendDate(as[j], a.timetoken)
                    self.storeData(as[j], true);
                  }

                }

              } else {
                self.clog('Rejecting history message as improper format supplied.');
              }



              i++;

            }

            if (msgs.length > 1 && self.object.json.length < options.limit - 1) {
              page(end);
            } else {
              self.loadData(self.object);
            }

          });

        };

        page();

      }

    };

    self.boot = function() {

      self.fobject = {
        json: [],
        keys: {
          value: [],
          x: options.xId
        }
      };

      self.clog('Status:', 'Chart Animation Enabled');

      self.isDead = false;

      options.generate.data.columns = [];
      self.chart = c3.generate(options.generate);

    };

    self.uniqueAppend = function(array, append) {

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

    self.flowLength = 0;

    self.mapAppend = function(object) {

      // this just keeps a list of used keys in the object
      for (var i = 0; i < object.json.length; i++) {
        for (var key in object.json[i]) {
          object.keys.value = self.uniqueAppend(object.keys.value, key);
        }
      }

      return object;

    }

    self.storeData = function(data, isHistory) {

      self.object.json.push(data);

      if(self.object.json.length > (options.limit * options.channels.length)) {
        self.object.json.shift();
        self.flowLength++;
      }

      self.mapAppend(self.object);

      if (options.flow && !isHistory) {

        self.fobject.json.push(data);
        self.mapAppend(self.fobject);

      };

    };

    // function to reformat data into categories for bar chart
    self.categorize = function(data) {

      var newobj = JSON.parse(JSON.stringify(data));

      delete data.json[0]['_eonDatetime']

      var newData = [];
      for(var i in data.json[0]) {

        var whatever = {
          name: i,
          value: data.json[0][i]
        };

        newData.push(whatever);

      }

      newobj.json = newData;

      newobj.keys = {
        x :'name',
        value: ['value']
      }

      return newobj;

    }

    self.loadData = function(data) {

      if(options.xType == 'category') {
        console.log('self.categorize')
        data = self.categorize(data);
      }

      self.flowLength = 0;
      self.clog('Load Data')
      self.chart.load(data);
    }

    setInterval(function() {

      self.clog('Status:', 'Rendering');

      if (!self.stale) {
        self.clog('Render:', 'No new data');
      } else if(self.isDead) {
        self.clog('Render:', 'Tab out of focus.');
      } else {

        if(self.fobject.json.length) {

          self.fobject.length = self.flowLength;

          self.chart.flow(self.fobject);

          self.fobject = {
            json: [],
            keys: {
              value: [],
              x: options.xId
            }
          };

          self.flowLength = 0;

        } else {
          self.loadData(self.object);
        }

        self.stale = false;

        self.clog('Render:', 'Complete');

      }

    }, options.rate);

    var listener = Visibility.change(function (e, state) {

      console.log('hidden', Visibility.hidden())

      self.isDead = Visibility.hidden();
    });

    self.elog = function(text) {
      console.error("EON:" + text);
    };

    self.subscribe = function() {

      self.pubnub.addListener({
        status: function(statusEvent) {
          if (statusEvent.category === "PNConnectedCategory") {
            options.connect();
          }
        },
        message: function(m) {

          if(options.channels.indexOf(m.subscribedChannel) > -1) {

            self.clog('PubNub:', '-------------------');
            self.clog('PubNub:', 'Received Message', m);

            self.clog('PubNub:', 'Transforming Message using options.transform');

            var message = options.transform(m.message);

            if(message && (message.eon || message.eons)) {

              var ms = message.eons || [];

              if(message.eon) {
                ms.push(message.eon);
              }

              for(var i in ms) {

                if(ms.hasOwnProperty(i)) {

                  ms[i] = self.appendDate(ms[i], m.timetoken);
                  self.clog('PubNub:', 'Message Result', ms[i]);

                  self.stale = true;
                  self.storeData(ms[i], false);

                }

              }

              self.clog('PubNub:', 'Calling options.message');

            } else {

                if(message && !message.eon) {
                  console.error('Eon messages must be in proper format. For example:',  {eon: [1,2,3]})
                } else {
                  self.clog('EON:', 'Message rejected');
                }

            }

            options.message(message, m.timetoken, m.channel);

          }

        }
      });

      if(options.channelGroups) {

        // assuming an intialized PubNub instance already exists
        pubnub.channelGroups.listChannels({
            channelGroup: options.channelGroups
          }, function (status, response) {

            if (status.error) {
              self.clog("operation failed w/ error:", status);
              return;
            }

            options.channels = response.channels;

            if(options.history) {
              self.loadHistory();
            }

            self.pubnub.subscribe({
              channelGroups: options.channelGroups
            });

          }
        );

      } else {

        if(options.history) {
          self.loadHistory();
        }

        self.pubnub.subscribe({
          channels: options.channels
        });

      }

    };

    self.init = function() {

      self.clog('PubNub:', 'self.subscribed to ' + options.channels);
      self.subscribe();

    };

    if (self.error) {
      self.elog(self.error);
    } else {
      self.init();
      self.boot();

    }

    return self.chart;

}
