var webpack = require("webpack");

module.exports = {
  entry:   "./entry.js",
  output:  {
    path:     __dirname,
    filename: "eon-chart.js",
    library: ["eon", "chart"],
    libraryTarget: "umd"
  },
  module: {
    loaders: [
      { test: /\.json$/, loader: "json" },
      { test: /\.css$/, loader: "style-loader!css-loader" },
      { test: /\.png$/, loader: "url-loader?limit=100000" },
    ]
  }
};
