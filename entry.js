window.PubNub = require('pubnub');
require('./node_modules/c3/c3.css');
module.exports = function(options) {
    eonChart = require('./src/pubnub-c3');
    return new eonChart(options, require('c3'), require("visibilityjs"));
};
