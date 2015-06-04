# EON Charts

Realtime animated graphs with [PubNub](http://pubnub.com) and [C3](http://c3js.org/).

![](http://i.imgur.com/MRK20Kb.gif)

# Examples

* [Spline Chart](http://pubnub.com/developers/eon/chart/spline/)
* [Bar Chart](http://pubnub.com/developers/eon/chart/bar/)
* [Donut (Pie) Chart](http://pubnub.com/developers/eon/chart/donut/)
* [Gauge Chart](http://pubnub.com/developers/eon/chart/gauge/)

## Quickstart

```html
<script type="text/javascript" src="http://pubnub.github.io/eon/lib/eon-chart.js"></script>
<link type="text/css" rel="stylesheet" href="http://pubnub.github.io/eon/lib/eon.css" />
<div id="chart"></div>
<script>
  eon.chart({
    channel: "c3-spline", // the pubnub channel for real time data
    generate: {           // c3 chart object
      bindto: '#chart'
    },         
    flow: {},             // flow configuration
    limit: 10             // the size of your data buffer
  });
</script>
```

Parameter | Value | Default
| :------------ |:---------------| -----:|
| channel | Your [PubNub channel name](http://www.pubnub.com/docs/javascript/overview/data-push.html). | ```false```
| generate | Your [C3 chart generation config](http://c3js.org/gettingstarted.html#generate). | ```undefined```
| rate | How many milliseconds before you update | ```1000```
| flow | Used to update spline charts over time series. | ```false```
| limit | The size of your buffer. How many values to display on the chart before shifting the first value off and appending a new value. This is not native to C3. | ```10```
| history | Fill the buffer by using PubNub history call to retrieve last ```limit``` messages. Requires [PubNub storage](http://www.pubnub.com/how-it-works/storage-and-playback/) to be enabled. | ```false```
| message | A function to call everytime a PubNub message is recieved. See [PubNub subscribe](http://www.pubnub.com/docs/javascript/api/reference.html#subscribe) | function(message, env, channel){} |
| transform | Method for changing the payload format of your stream. See [example](https://github.com/pubnub/eon-chart/blob/master/examples/transform.html)| ```function(m){return m}```
| connect | A function to call when PubNub makes a connection. See [PubNub subscribe](http://www.pubnub.com/docs/javascript/api/reference.html#subscribe) | ```function(){}``` |
| pubnub | An instance of the PUBNUB javascript global. This is required when using your own keys. See the ```subscribe_key``` example. | ```false```


## Simple Example

Plug your normal C3 config into the ```generate``` param. Supply a PubNub channel in `channel`` param. ```eon.chart``` returns the normal c3 chart object.

```html
<div id="chart"></div>
<script>
  eon.chart({
    history: false,
    channel: "c3-spline",
    flow: {
      duration: 100
    },
    generate: {
      bindto: '#chart',
      data: {
        x: 'x',
        labels: true
      },
      axis : {
        x : {
          type : 'timeseries',
          tick: {
            format: '%H:%M:%S'
          }
        }
      }
    }
  });
</script>
```

That's it! Now you can publish messages to the same ```channel`` and they'll render in the graph.

Make sure your messages are in the format that C3 expects! For example:

```js
var pubnub = PUBNUB.init({
  publish_key: 'demo',
  subscribe_key: 'demo'
});
setInterval(function(){
  
  pubnub.publish({
    channel: 'c3-spline',
    message: {
      columns: [
        ['x', new Date().getTime()],
        ['Austin', Math.floor(Math.random() * 99)],
        ['New York', Math.floor(Math.random() * 99)],
        ['San Francisco', Math.floor(Math.random() * 99)],
        ['Portland', Math.floor(Math.random() * 99)]

      ]
    }
  });

}, 1000);
```

Notice how the ```channel```  matches.

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

## Distributed Systems

The EON library compiles all messages at designated intervals. This means you can publish from multiple sources into one chart. For example, you can graph the individual memory usage from 3 servers by supplying the same channel to your PubNub publish requests.
