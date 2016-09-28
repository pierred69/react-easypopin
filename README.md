# react easypopin

Get the AMD module located at `react-easypopin.js` and include it in your project.

```js
// importation
import ReactEasypopin from 'react-easypopin';

// usage in template
<ReactEasypopin {...props}>
    // CONTENT
</ReactEasypopin>
```

## **How to use it ?**

* Import the plugin
* Instantiate it in the template using JSX or *React.createElement(ReactEasypopin, {property: value}, React.createElement(content));*
* Define its properties

### Defining Properties :  

| Property   | Usage           | default  |
|----------|:-------------:|:-------:|
| **ref** |  the reference of the popin in your template |          |
| **opened** |    if true, the popin is automatically opened   | false |       
| **closable** | enables to close the popin | true |
| **overlay** | displays an overlay around the popin | true |
| **closableWithOverlayClick** | enables click on the overlay to close the popin | true |
| **withCloseButton** | displays a close icon at the top right | true |
| **animation** | defines the CSS class to run appear & disappear animation. (cf. animation) | *EFFECT_APPEAR_DEFAULT* |

## Animation

The popin can be opened and closed with classy CSS3 animations. Those are available using following constants :

* *EFFECT_APPEAR_FROM_LEFT_TO_RIGHT*
* *EFFECT_APPEAR_FROM_RIGHT_TO_LEFT*
* *EFFECT_APPEAR_FROM_TOP_TO_BOTTOM*
* *EFFECT_APPEAR_FROM_BOTTOM_TO_TOP*
* *EFFECT_APPEAR_BY_HORIZONTAL_3D*
* *EFFECT_APPEAR_DEFAULT*

Example of usage :

```js

import React, { Component } from 'react';
import ReactEasypopin, { Effects } from 'react-easypopin';

export default class Example extends Component {
    render () {
        <div className="Example">
            <ReactEasypopin
                animation={Effects.EFFECT_APPEAR_FROM_BOTTOM_TO_TOP}
                ref="popin"
            />
        </div>
    }
}

```

## trigger open & close

You can trigger an action to open the popin by calling following methods using REFS :

* open()
* close()

Here is a sample integration (ES6) :

```js

import React, { Component } from 'react';
import ReactEasypopin from 'react-easypopin';

export default class widget extends Component {
    openPopin () {
        this.refs.popin.open();
    }
    render = () => (
        <div id="widget-container">
            <button onClick={this.openPopin}>Open</button>
            <ReactEasypopin ref='popin'>
                <div id="content">
                    <p>this is the content of my popin :)</p>
                </div>
            </ReactEasypopin>
        </div>
    );
}

```

## Development

* Development server `npm start`.
* Continuously run tests on file changes `npm run watch-test`;
* Run tests: `npm test`;
* Build `npm run build`;

Please note that tests are run on push
