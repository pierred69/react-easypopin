import React, { PropTypes } from 'react';
import './styles/react-easypopin.less';
import {
    EFFECT_APPEAR_FROM_TOP_TO_BOTTOM,
    EFFECT_APPEAR_FROM_BOTTOM_TO_TOP,
    EFFECT_APPEAR_FROM_LEFT_TO_RIGHT,
    EFFECT_APPEAR_FROM_RIGHT_TO_LEFT,
    EFFECT_APPEAR_BY_HORIZONTAL_3D,
    EFFECT_APPEAR_DEFAULT,
    STATUS_OPENING,
    STATUS_OPENED,
    STATUS_CLOSING,
    STATUS_CLOSED
} from './constants';
import classNames from 'classnames';
/**
* @author david pierre
* started in 2016 may 18th
*
* this plugin provides a react popin made to be easy to use
* and adaptable to all kinds of screens with large or small
* customizable content and animations
* provides also a close button and would be completed in term
* of features later...
*/
export default class ReactEasyPopin extends React.Component {

    /** classic constructor that binds methods to
    * be callable from the JSX
    *
    * @param props : object
    */
    constructor (props) {
        super(props);
        this.open = this.open.bind(this);
        this.close = this.close.bind(this);
        this.getAnimation = this.getAnimation.bind(this);
    }

    /**
    * defines state vars with props
    */
    componentDidMount () {
        this.setStatus(this.props.opened ? STATUS_OPENING : STATUS_CLOSED);
        this.defineStatusChangingWithAnimationsEvents();
    }

    /* defines props types */
    static propTypes = {
        children: PropTypes.node,
        opened: PropTypes.bool,
        closable: PropTypes.bool,
        overlay: PropTypes.bool,
        closeByOverlay: PropTypes.bool,
        withCloseButton: PropTypes.bool,
        animation: PropTypes.string
    }

    /* defines default properties */
    static defaultProps = {
        opened: false,
        closable: true,
        withCloseButton: true,
        overlay: true,
        closeByOverlay: true
    }

    /**
      * defines the current status state
      * @param status
    **/
    setStatus = (status) => this.setState({'status': status});

    /**
      * get the current status state
     **/
    getStatus = () => this.state && this.state.status;

    /* let's expose constants for animation */
    static Effects = {
        'EFFECT_APPEAR_FROM_TOP_TO_BOTTOM': EFFECT_APPEAR_FROM_TOP_TO_BOTTOM,
        'EFFECT_APPEAR_FROM_BOTTOM_TO_TOP': EFFECT_APPEAR_FROM_BOTTOM_TO_TOP,
        'EFFECT_APPEAR_FROM_LEFT_TO_RIGHT': EFFECT_APPEAR_FROM_LEFT_TO_RIGHT,
        'EFFECT_APPEAR_FROM_RIGHT_TO_LEFT': EFFECT_APPEAR_FROM_RIGHT_TO_LEFT,
        'EFFECT_APPEAR_BY_HORIZONTAL_3D': EFFECT_APPEAR_BY_HORIZONTAL_3D,
        'EFFECT_APPEAR_DEFAULT': EFFECT_APPEAR_DEFAULT
    };

    /* returns the css class used for the animation
    * fallback is the prop, that could be used to
    * define customed animations css classes */
    getAnimation () {
        return this.props.animation;
    }

    defineStatusChangingWithAnimationsEvents () {
        this.refs.handler.addEventListener('animationend', () => {
            switch (this.getStatus()) {
                case STATUS_OPENING:
                    this.setStatus(STATUS_OPENED);
                    break;
                case STATUS_CLOSING:
                    this.setStatus(STATUS_CLOSED);
                    break;
                default:
                    break;
            }
        })
    }

    /**
      * opens the popin defining its 'opened' state to true
      * is defined to be called by parent component via "ref"
      * or internally
    **/
    open () {
        const status = this.getStatus();
        (!status || status === STATUS_CLOSED)
            && this.setStatus(STATUS_OPENING);
    }

    /**
      * closes the popin defining its state to "closing"
      * is defined to be called by parent component via "ref"
      * or internally
      * works only if the popin is defined as "closable"
      */
    close () {
        this.props.closable
            && this.getStatus() === STATUS_OPENED
            && this.setStatus(STATUS_CLOSING);
    }

    /**
    * @return JSX template of the popin and its classes according
    * to opened state
    */
    render () {
        const status = this.getStatus();
        const { closable, withCloseButton } = this.props;
        const classNameHandler = classNames({
            'react-easypopin__Handler': true,
            'react-easypopin__Open' : status === STATUS_OPENING || status === STATUS_OPENED,
            'react-easypopin__Closed' : !status || status === STATUS_CLOSED,
            'react-easypopin__Closing': status === STATUS_CLOSING,
            [`${this.getAnimation()}`]: true
        });
        const classNameOverlay = classNames({
            'react-easypopin__Overlay' : true,
            'react-easypopin__Overlay__Open' : status === STATUS_OPENING || status === STATUS_OPENED,
            'react-easypopin__Overlay__Closing': status === STATUS_CLOSING,
            'react-easypopin__Overlay__Closed': !status || status === STATUS_CLOSED
        });
        return (
            <div className="react-easypopin">
                <div
                    className={classNameOverlay}
                    onClick={this.close}
                    ref="overlay"
                />
                <div
                    className={classNameHandler}
                    ref="handler"
                >
                    <div
                        className="react-easypopin__Handler__Content"
                    >
                      {closable && withCloseButton && (
                          <a
                              onClick={this.close}
                              className="react-easypopin__Handler__Close"
                          >
                              fermer
                          </a>
                      )}
                      {this.props.children}
                    </div>
                </div>
            </div>
        );
    }
};
