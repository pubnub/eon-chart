window.PubNub = require('pubnub');
window.c3 = require('c3');
require('./node_modules/c3/c3.css');
module.exports = function(options) {
    eonChart = require('./src/pubnub-c3');
    return new eonChart(options, window.c3, require("visibilityjs"), window.PubNub);
};
