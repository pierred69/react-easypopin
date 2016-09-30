/* jshint node: true */
var path = require('path');


module.exports = {
  context: path.join(__dirname),
  entry: './lib/index.js',

  output: {
    path: path.join(__dirname, 'dist'),
    filename: 'index.js',
    libraryTarget: 'umd',
    library: 'ReactEasypopin'
  },

  externals: {
      react: {
          root: 'React',
          commonjs2: 'react',
          commonjs: 'react',
          amd: 'react'
      },
      "react/addons": {
          root: 'React',
          commonjs2: 'react',
          commonjs: 'react',
          amd: 'react'
      }
  },

  module: {
    loaders: [
      {
        test: /\.less/,
        loader: 'style!css!less?outputStyle=expanded&' +
          'includePaths[]=' + (path.resolve(__dirname, './bower_components')) + '&' +
          'includePaths[]=' + (path.resolve(__dirname, './node_modules'))
      },
      {
        test: /(\.js)|(\.jsx)$/,
        exclude: [/node_modules/, /bower_components/],
        loader: 'babel-loader',
        query: {
          optional: ['runtime'],
          stage: 0
        }
      },
      {
        test: /(\.png)|(\.jpg)$/,
        exclude: [/node_modules/, /bower_components/],
        loader: 'url-loader'
      }
    ]
  }
};
