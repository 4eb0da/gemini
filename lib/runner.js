'use strict';
var EventEmitter = require('events').EventEmitter,

    q = require('q'),
    inherit = require('inherit'),
    promiseUtils = require('./promise-util'),

    BrowserLauncher = require('./browser/launcher');

module.exports = inherit(EventEmitter, {

    __constructor: function(config, browserLauncher) {
        this.config = config;
        this.browserLauncher = browserLauncher || new BrowserLauncher(config);
    },

    runPlans: function(plans) {
        var _this = this;
        this.emit('begin');
        return q(this._prepare())
            .then(function() {
                return promiseUtils.seqMap(plans, _this.runPlan.bind(_this));
            })
            .then(function() {
                _this.emit('end');
            });
    },

    _prepare: function() {
    },

    runPlan: function(plan) {
        var _this = this,
            chains = plan.getChains();
        this.emit('beginPlan', plan.name);
        return promiseUtils.seqMap(chains, this._runChain.bind(this))
            .then(function() {
                _this.emit('endPlan', plan.name);
            });
    },

    _runChain: function(chain) {
        var _this = this;
        return q.all(_this.config.browsers.map(function(browserName) {
            var browser = _this.browserLauncher.launch(browserName);
            return _this._runChainInBrowser(chain, browser)
                .then(function() {
                    return _this.browserLauncher.stop(browser);
                });
        }));
    },

    _runChainInBrowser: function(chain, browser) {
        var _this = this;
        return browser.open(this.config.getAbsoluteUrl(chain.getUrl()))
            .then(function() {
                return browser.findElements(chain.getElementsSelectors());
            })
            .then(function(elements) {
                return promiseUtils.seqMap(chain.getStates(), function(state) {
                    _this.emit('beginState', state.plan.name, state.name, browser.name);
                    return browser.captureState(state, elements)
                        .then(function(image) {
                            return q(_this._processCapture({
                                plan: state.plan,
                                state: state,
                                browser: browser,
                                image: image
                            }));
                        })
                        .then(function() {
                            _this.emit('endState', state.plan.name, state.name, browser.name);
                        });
                });
            });
    },

    _processCapture: function() {
    }

});