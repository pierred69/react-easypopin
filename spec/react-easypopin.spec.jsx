import React from 'react/addons';
import ReactEasypopin from '../lib/react-easypopin.jsx';

describe('ReactEasypopin', function() {
  var component;

  beforeEach(function() {
    component = React.addons.TestUtils.renderIntoDocument(
      <ReactEasypopin>
          <div className='test'>
              <p>ceci est un test !!</p>
          </div>
      </ReactEasypopin>
    );
  });

  it('should render', function() {
    expect(component.getDOMNode().className).toEqual('react-easypopin');
  });
});
