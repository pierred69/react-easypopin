import React, { PropTypes } from 'react';
import './styles/react-easypopin.less';
import * as Effects from './constants';
import classNames from 'classnames';
/**
* @author david pierre
* started in 2016 may 18th
*
* this plugin provides a react popin made to be easy to use
* and adaptable to all kinds of screens with large or small
* customizable content
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
        this.setState({'opened': this.props.opened});
    }

    /* let's expose constants for animation */
    static Effects = Effects;

    /* defines default properties */
    static defaults = {
        opened: false
    }

    /* defines props types */
    static propTypes = {
        children: PropTypes.node,
        opened: PropTypes.bool,
        animation: PropTypes.string
    }

    /* returns the css class used for the animation
    * fallback is the prop, that could be used to
    * define customed animations css classes */
    getAnimation () {
        return Effects[this.props.animation] || this.props.animation;
    }

    /**
    * opens the popin defining its 'opened' state to true
    * is defined to be called by parent component via "ref"
    * or internally
    */
    open () {
        this.setState({opened: true});
    }

    /**
    * closes the popin defining its 'opened' state to false
    * is defined to be called by parent component via "ref"
    * or internally
    */
    close () {
        this.refs.handler.className = 'react-easypopin__Handler react-easypopin__Closing';
        this.refs.overlay.className = 'react-easypopin__Overlay react-easypopin__Overlay__Closing';
        setTimeout(() => {
            this.setState({opened: false});
        }, 1000);
    }

    /**
    * @return state.opened
    */
    isOpened () {
        return this.state
            && this.state.opened;
    }

    /**
    * @return JSX template of the popin and its classes according
    * to opened state
    */
    render () {
        const opened = this.isOpened();
        const classNameHandler = classNames({
            'react-easypopin__Handler': true,
            'react-easypopin__Open' : opened,
            'react-easypopin__Close' : !opened,
            [`${this.getAnimation()}`]: true
        });
        const classNameOverlay = classNames({
            'react-easypopin__Overlay' : true,
            'react-easypopin__Overlay__In' : opened,
            'react-easypopin__Overlay__Out': !opened
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
                      <a
                          onClick={this.close}
                          className="react-easypopin__Handler__Close"
                      >
                          fermer
                      </a>
                      {this.props.children}
                    </div>
                </div>
            </div>
        );
    }
};
