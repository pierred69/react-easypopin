import React from 'react/addons';
import ReactEasypopin from '../lib/react-easypopin.jsx';
import * as Constants from '../lib/constants';

const ReactTestUtils = React.addons.TestUtils;

describe('ReactEasypopin', function() {

    // define creation of component with vars and methods
    let domTree, component, componentDOM;

    /** redefinitions of constants.
      * the test should fail if app constants are modified
      * except if they're modified here too
      *
      * The reason is to avoid regressions
     **/

    const EFFECT_APPEAR_FROM_TOP_TO_BOTTOM = 'fx_ttb';
    const EFFECT_APPEAR_FROM_BOTTOM_TO_TOP = 'fx_btt';
    const EFFECT_APPEAR_FROM_LEFT_TO_RIGHT = 'fx_ltr';
    const EFFECT_APPEAR_FROM_RIGHT_TO_LEFT = 'fx_rtl';
    const EFFECT_APPEAR_BY_HORIZONTAL_3D = 'fx_3d';
    const EFFECT_APPEAR_DEFAULT = 'default';

    const STATUS_OPENING = 'STATUS_OPENING';
    const STATUS_OPENED = 'STATUS_OPENED';
    const STATUS_CLOSING = 'STATUS_CLOSING';
    const STATUS_CLOSED = 'STATUS_CLOSED';


    /**
    * creates an instance of the component using props
    * @param props : object
    * @return ReactEasypopin : ReactEasypopin
    */
    const getComponent = (props = {}) => (
        <ReactEasypopin {...props}>
            <div className='test_content'>
                <p>ceci est un test !!</p>
            </div>
        </ReactEasypopin>
    );

    /**
    * initialize the component into a virtual document
    * @param props : object
    * @return domTree : Document
    */
    const getRenderedTree = (props = {}) => ReactTestUtils.renderIntoDocument(getComponent(props));

    /**
    * process to initialize a new componet into a virtual document
    * @param props : object
    */
    const generateComponent = (props = {}) => {
        domTree = getRenderedTree(props);
        component = ReactTestUtils.findRenderedComponentWithType(domTree, ReactEasypopin);
        componentDOM = ReactTestUtils.findRenderedDOMComponentWithClass(domTree, 'react-easypopin');
    }

    // RENDERING TESTS
    describe('rendering tests', function () {
        /* test : should simply render the popin */
        it('should simply render the popin closed', function() {
            generateComponent();
            expect(ReactTestUtils.isDOMComponent(componentDOM)).toBe(true);
            expect(component.state.status).toEqual(STATUS_CLOSED);
        });

        /* test if component is opened with the option passed */
        it('should simply render the popin opened', function() {
            generateComponent({
                opened: true
            });
            expect(ReactTestUtils.isDOMComponent(componentDOM)).toBe(true);
            expect(component.state.status).toEqual(STATUS_OPENING);
        });

        /* test if component renders the main handler */
        it('should render handler', function() {

            generateComponent({
                opened: true
            });

            const handler = component.refs.handler;
            const handlerDOM = ReactTestUtils.findRenderedDOMComponentWithClass(domTree, 'react-easypopin__Handler');
            const contentDOM = ReactTestUtils.findRenderedDOMComponentWithClass(domTree, 'react-easypopin__Handler__Content');
            expect(ReactTestUtils.isDOMComponent(handlerDOM)).toBe(true);
            expect(ReactTestUtils.isDOMComponent(contentDOM)).toBe(true);
            expect(contentDOM).toEqual(handler.firstChild);
        });

        /* test if component renders without overlay */
        it('should render the popin opened without overlay', function() {

            generateComponent({
                opened: true,
                overlay: false
            });
            const overlay = ReactTestUtils.scryRenderedDOMComponentsWithClass(domTree, 'react-easypopin__Overlay');

            expect(ReactTestUtils.isDOMComponent(componentDOM)).toBe(true);
            expect(component.refs.overlay).toEqual(undefined);
            expect(ReactTestUtils.isDOMComponent(overlay[0])).toBe(false);
        });

        /* test if component renders without close button */
        it('should render the popin opened without close button', function() {

            generateComponent({
                opened: true,
                withCloseButton: false
            });
            const closeBtns = ReactTestUtils.scryRenderedDOMComponentsWithClass(domTree, 'react-easypopin__Close');

            expect(ReactTestUtils.isDOMComponent(componentDOM)).toBe(true);
            expect(component.refs.closeBtn).toEqual(undefined);
            expect(ReactTestUtils.isDOMComponent(closeBtns[0])).toBe(false);
        });

        it('should render the content into a child div', function () {
            generateComponent({
                opened: true
            });
            const content = ReactTestUtils.findRenderedDOMComponentWithClass(domTree, 'test_content');
            expect(ReactTestUtils.isDOMComponent(content)).toBe(true);
            expect(content.firstChild.tagName).toEqual('P');
            expect(content.parentNode.className).toEqual('react-easypopin__Handler__Content');
        });
    });

    describe('status tests', function () {
        it('should behave like an opening popin', function () {
            generateComponent();
            component.setStatus(STATUS_OPENING);
            const handlerOpened = ReactTestUtils.findRenderedDOMComponentWithClass(domTree, 'react-easypopin__Open');
            const overlayOpened = ReactTestUtils.findRenderedDOMComponentWithClass(domTree, 'react-easypopin__Overlay__Open');
            expect(ReactTestUtils.isDOMComponent(handlerOpened)).toBe(true);
            expect(ReactTestUtils.isDOMComponent(overlayOpened)).toBe(true);
        });

        it('should behave like an opened popin', function () {
            generateComponent();
            component.setStatus(STATUS_OPENED);
            const handlerOpened = ReactTestUtils.findRenderedDOMComponentWithClass(domTree, 'react-easypopin__Open');
            const overlayOpened = ReactTestUtils.findRenderedDOMComponentWithClass(domTree, 'react-easypopin__Overlay__Open');
            expect(ReactTestUtils.isDOMComponent(handlerOpened)).toBe(true);
            expect(ReactTestUtils.isDOMComponent(overlayOpened)).toBe(true);
        });

        it('should behave like a closing popin', function () {
            generateComponent();
            component.setStatus(STATUS_CLOSING);
            const handlerClosing = ReactTestUtils.findRenderedDOMComponentWithClass(domTree, 'react-easypopin__Closing');
            const overlayClosing = ReactTestUtils.findRenderedDOMComponentWithClass(domTree, 'react-easypopin__Overlay__Closing');
            expect(ReactTestUtils.isDOMComponent(handlerClosing)).toBe(true);
            expect(ReactTestUtils.isDOMComponent(overlayClosing)).toBe(true);
        });

        it('should behave like a closed popin', function () {
            generateComponent();
            component.setStatus(STATUS_CLOSED);
            const handlerClosing = ReactTestUtils.findRenderedDOMComponentWithClass(domTree, 'react-easypopin__Closed');
            const overlayClosing = ReactTestUtils.findRenderedDOMComponentWithClass(domTree, 'react-easypopin__Overlay__Closed');
            expect(ReactTestUtils.isDOMComponent(handlerClosing)).toBe(true);
            expect(ReactTestUtils.isDOMComponent(overlayClosing)).toBe(true);
        });

        it('should behave like a closed popin with a wrong status', function () {
            generateComponent();
            component.setStatus("STATUS_SHIT");
            expect(component.getStatus()).toEqual(STATUS_CLOSED);
        });
    });

    describe('mouse actions tests', function () {
        /* test if component closes the popin on click on the overlay */
        it('should close the popin on clicking on the overlay', function() {
            generateComponent();
            component.setStatus(STATUS_OPENED);
            const overlay = component.refs.overlay;
            ReactTestUtils.Simulate.click(overlay);
            expect(component.state.status).toEqual(STATUS_CLOSING);
        });

        /* test if component doesn't close the popin on click on the overlay */
        it('should not close the popin on clicking on the overlay', function() {
            generateComponent({
                closableWithOverlayClick: false
            });
            component.setStatus(STATUS_OPENED);
            const overlay = component.refs.overlay;
            ReactTestUtils.Simulate.click(overlay);
            expect(component.state.status).toEqual(STATUS_OPENED);
        });

        /* test if component closes the popin on click on the overlay */
        it('should close the popin on clicking on the button close', function() {
            component.setStatus(STATUS_OPENED);
            const closeBtn = component.refs.closeBtn;
            ReactTestUtils.Simulate.click(closeBtn);
            expect(component.state.status).toEqual(STATUS_CLOSING);
        });
    });

    describe('call-by-ref actions tests', function () {

        // test if component is opened by calling open() method.
        it('should open the popin on call open() method', function() {
            generateComponent(); // reinit component
            component.open();
            expect(component.state.status).toEqual(STATUS_OPENING);
        });

        // test if component is not opened by calling open() method when already opened.
        it('should not open the popin on call open() method when already opened', function() {
            generateComponent(); // reinit component
            component.setStatus(STATUS_OPENED);
            component.open();
            expect(component.state.status).toEqual(STATUS_OPENED); // instead of STATUS_OPENING
        });

        // test if component is closing by calling close() method.
        it('should close the popin on call close() method', function() {
            generateComponent(); // reinit component
            component.setStatus(STATUS_OPENED); // reinit component
            component.close();
            expect(component.state.status).toEqual(STATUS_CLOSING);
        });

        // test if component is not closed by calling close() method when already closing or closed.
        it('should close the popin on call close() method', function() {
            generateComponent(); // reinit component
            component.setStatus(STATUS_CLOSED); // reinit component
            component.close();
            expect(component.state.status).toEqual(STATUS_CLOSED);
        });
    });

    describe('behaviours with props', function () {

        /* test if component closes the popin on click on the overlay */
        it('should not be closable by calling close() not clicking', function() {
            generateComponent({
                closable: false
            });
            component.setStatus(STATUS_OPENED);
            const closeBtn = component.refs.closeBtn;
            const overlay = component.refs.overlay;
            ReactTestUtils.Simulate.click(closeBtn);
            expect(component.state.status).toEqual(STATUS_OPENED);
            ReactTestUtils.Simulate.click(overlay);
            expect(component.state.status).toEqual(STATUS_OPENED);
            component.close();
            expect(component.state.status).toEqual(STATUS_OPENED);
        });
    });

    describe('animations classes', function () {
        it('should write top_to_bottom class', function () {
            generateComponent({
                animation: Constants.EFFECT_APPEAR_FROM_TOP_TO_BOTTOM
            });
            const content = ReactTestUtils.findRenderedDOMComponentWithClass(domTree, EFFECT_APPEAR_FROM_TOP_TO_BOTTOM);
            expect(ReactTestUtils.isDOMComponent(content)).toBe(true);
        });

        it('should write bottom_to_top class', function () {
            generateComponent({
                animation: Constants.EFFECT_APPEAR_FROM_BOTTOM_TO_TOP
            });
            const content = ReactTestUtils.findRenderedDOMComponentWithClass(domTree, EFFECT_APPEAR_FROM_BOTTOM_TO_TOP);
            expect(ReactTestUtils.isDOMComponent(content)).toBe(true);
        });

        it('should write left_to_right class', function () {
            generateComponent({
                animation: Constants.EFFECT_APPEAR_FROM_LEFT_TO_RIGHT
            });
            const content = ReactTestUtils.findRenderedDOMComponentWithClass(domTree, EFFECT_APPEAR_FROM_LEFT_TO_RIGHT);
            expect(ReactTestUtils.isDOMComponent(content)).toBe(true);
        });

        it('should write left_to_right class', function () {
            generateComponent({
                animation: Constants.EFFECT_APPEAR_FROM_RIGHT_TO_LEFT
            });
            const content = ReactTestUtils.findRenderedDOMComponentWithClass(domTree, EFFECT_APPEAR_FROM_RIGHT_TO_LEFT);
            expect(ReactTestUtils.isDOMComponent(content)).toBe(true);
        });

        it('should write horizontal_3d class', function () {
            generateComponent({
                animation: Constants.EFFECT_APPEAR_BY_HORIZONTAL_3D
            });
            const content = ReactTestUtils.findRenderedDOMComponentWithClass(domTree, EFFECT_APPEAR_BY_HORIZONTAL_3D);
            expect(ReactTestUtils.isDOMComponent(content)).toBe(true);
        });

        it('should write default class', function () {
            generateComponent({
                animation: Constants.EFFECT_APPEAR_DEFAULT
            });
            const content = ReactTestUtils.findRenderedDOMComponentWithClass(domTree, EFFECT_APPEAR_DEFAULT);
            expect(ReactTestUtils.isDOMComponent(content)).toBe(true);
        });
    });

});
