# EON Charts

Realtime animated graphs with [PubNub](http://pubnub.com) and [C3](http://c3js.org/).

![](http://i.imgur.com/MRK20Kb.gif)

# Examples

* [Spline Chart](http://pubnub.com/developers/eon/chart/spline/)
* [Bar Chart](http://pubnub.com/developers/eon/chart/bar/)
* [Donut Chart](http://pubnub.com/developers/eon/chart/donut/)
* [Gauge Chart](http://pubnub.com/developers/eon/chart/gauge/)

## Installing

### Hotlink

```html
<script type="text/javascript" src="https://pubnub.github.io/eon/v/eon/1.0.0/eon.js"></script>
<link type="text/css" rel="stylesheet" href="https://pubnub.github.io/eon/v/eon/1.0.0/eon.css"/>
```

### Bower

```sh
bower install eon-chart --save
```

Check out our [bower example](https://github.com/pubnub/eon-chart/examples/bower.html).

### NPM

```sh
npm install eon-chart --save
```

Check out our [webpack example](https://github.com/pubnub/eon-chart-webpack).


## Quick Start

Plug your normal C3 config into the ```generate``` param. Supply an array of PubNub channel in ```channels``` param. ```eon.chart``` returns the normal C3 chart object.

```html
<div id="chart"></div>
<script>
  var pubnub = new PubNub({
    publishKey:   'demo', // replace with your own pub-key
    subscribeKey: 'demo' // replace with your own sub-key
  });

  eon.chart({
    pubnub: pubnub,
    channels: ["c3-spline"],
    generate: {
      bindto: '#chart',
      data: {
        labels: true
      }
    }
  });
</script>
```

That's it! Now you can publish messages to the same ```channel``` and they'll render in the graph.

```js
var pubnub = new PubNub({
  publishKey:   'demo', // replace with your own pub-key
  subscribeKey: 'demo' // replace with your own sub-key
});

setInterval(function(){
  pubnub.publish({
    channel: 'c3-spline',
    message: {
      eon: {
        'Austin': Math.floor(Math.random() * 99),
        'New York': Math.floor(Math.random() * 99),
        'San Francisco': Math.floor(Math.random() * 99),
        'Portland': Math.floor(Math.random() * 99)
      }
    }
  });

}, 1000);
```

All chart data must exist within an object called ```eon```. Also notice how the ```channel``` and ```channels``` matches in both examples.

# Configuration

Parameter | Value | Default
| :------------ |:---------------| -----:|
| channels | An array of PubNub channels to subscribe to. Either ```channels``` or ```channelGroups``` must be supplied. | ```false```
| channelGroups | An array of PubNub channel groups to subscribe to. Either ```channels``` or ```channelGroups``` must be supplied. | ```false```
| generate | Your [C3 chart generation config](http://c3js.org/gettingstarted.html#generate). | ```undefined```
| flow | Used to update spline charts over time series. | ```false```
| limit | The size of your buffer. How many values to display on the chart before shifting the first value off and appending a new value. This is not native to C3. | ```10```
| rate | Interval at which new datapoints are drawn on the chart in milliseconds. | ```1000```
| history | Fill the buffer by using PubNub history call to retrieve last ```limit``` messages. Requires [PubNub storage](http://www.pubnub.com/how-it-works/storage-and-playback/) to be enabled. | ```false```
| xType | Your x axis configuration. Can be ```"auto"```, ```"custom"```, ```"category"```, or ```false```. Read more about ```xType``` below. | ```"auto"```
| xId | Your x axis source if ```xType == "custom"``` | ```"x"```
| message | A function to call everytime a PubNub message is recieved. See [PubNub subscribe](http://www.pubnub.com/docs/javascript/api/reference.html#subscribe) | ```function(message, env, channel){}``` |
| transform | Method for changing the payload format of your stream. See [example](https://github.com/pubnub/eon-chart/blob/master/examples/transform.html)| ```function(m){return m}```
| connect | A function to call when PubNub makes a connection. See [PubNub subscribe](http://www.pubnub.com/docs/javascript/api/reference.html#subscribe) | ```function(){}``` |
| pubnub | An instance of the PUBNUB javascript global. This is required when using your own keys. See the ```subscribeKey``` example. | ```false```
| debug | Log EON events to console as they happen | ```false```

## More on Publishing Messages

This uses the included PubNub library to pubnub.publish()
packets to the pubnub.subscribe() call waiting inside the
C3 framework.

You probably want to publish data from the back-end instead.
Check out our docs for more info:

[http://www.pubnub.com/documentation/](http://www.pubnub.com/documentation/)

## Customize Your Graph

eon-chart works will all supported graph types in C3. Just check out the examples above.

You can learn more about customizing your graph from [the official C3 docs](http://c3js.org/gettingstarted.html#customize).

## X Axis Configuration

### Automatic

eon-chart will automatically use the PubNub message timestamp for chart x values. This timestamp is recorded when a message is published to the PubNub data stream network. This is the case when ```xType``` is set to ```"auto"```.

### Custom

If you'd like to supply your own Javascript timestamp, set ```xType``` to ```custom```. Then, set ```xId``` to the x value that appears within your published messages. Any custom ```x``` must be a microtime date like ```1465417017340```.

```js
var pubnub = new PubNub({
  publishKey:   'demo', // replace with your own pub-key
  subscribeKey: 'demo' // replace with your own sub-key
});

eon.chart({
  pubnub: pubnub,
  channels: ["c3-spline"], // the pubnub channel for real time data
  generate: {           // c3 chart object
    bindto: '#chart'
  },
  xType: 'custom',
  xId: 'x'
});
```

Notice how the code below publishes a key value pair called ```x``` with every message.

```js
pubnub.publish({
  channels: 'c3-spline',
  message: {
    eon: {
      'x': new Date().getTime(),
      'Austin': Math.floor(Math.random() * 99)
    }
  }
});
```

### Category

Eon charts supports both time series bar charts and point of time bar charts. If you'd like to represent a bar chart in a single point of time, supply ```xType: "category"``` and only the latest data will appear in the chart categorized by key. See ```examples/bar.html``` for an example.

## Multiple Points Per Payload

It is possible to publish multiple plot points per payload. Rather than using the object name ```eon``` use the name ```eons``` and supply an ```Array```. Because you use the ```eons``` property name, the library will know to loop through the array and plot each point.

Note that if publishing multiple points per payload, **you must use ```xType: "custom"``` and supply an ```xId```**.

```js
eons: [
  {
    x: new Date().getTime(),
    value: 1
  },
  {
    x: new Date().getTime(),
    value: 2
  }
]
```

Here's an example of data collected at 100ms increments, but only publishes every 1,000ms. Every payload includes 10 points with 100ms resolution. [See a full example here](https://github.com/pubnub/eon-chart/blob/master/examples/eons.html).

```js
setInterval(function(){
  var data = [];
  var date = new Date().getTime();

  for(var i = 0; i < 10; i++) {
      data.push({
          'pub_time': date + (100 * i),
          'Austin': Math.floor(Math.random() * 99)
      });
  }

  pubnub.publish({
    channels: [channel],
    message: {
      eons: data
    }
  });

}, 1000);
```

### Disable

You can disable eon-chart modifications by setting ```xType``` to ```false```. By default C3 will use an incremental x axis (1,2,3,4...).

## Distributed Systems

You can publish from multiple sources into one chart. For example, you can graph the individual memory usage from 3 servers by supplying the same channel to your PubNub publish requests.

Check out our [distributed chart example](https://github.com/pubnub/EON-distributed-chart).
