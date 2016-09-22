# react easypopin

Get the AMD module located at `react-easypopin.js` and include it in your project.

Here is a sample integration:

```js
require.config({
  paths: {
    'react': 'vendor/bower_components/react/react',
    'ReactEasypopin': 'react-easypopin'
  }
});

require(['react', 'ReactEasypopin'], function(React, ReactEasypopin) {

  React.render(React.createElement(ReactEasypopin), document.getElementById('widget-container'));

});
```

## Development

* Development server `npm start`.
* Continuously run tests on file changes `npm run watch-test`;
* Run tests: `npm test`;
* Build `npm run build`;
