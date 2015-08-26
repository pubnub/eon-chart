/*
 * Author: Alex Gibson
 * https://github.com/alexgibson/visibility.js
 * License: MIT license
 */

(function(global, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD environment
        define(function() {
            return factory(global, global.document);
        });
    } else if (typeof module !== 'undefined' && module.exports) {
        // CommonJS environment
        module.exports = factory(global, global.document);
    } else {
        // Browser environment
        global.Visibility = factory(global, global.document);
    }
} (typeof window !== 'undefined' ? window : this, function (w, d) {

    'use strict';

    function Visibility(options) {

        this.options = {
            onVisible: null,
            onHidden: null
        };

        //User defined options
        if (typeof options === 'object') {

            for (var i in options) {
                if (options.hasOwnProperty(i)) {
                    this.options[i] = options[i];
                }
            }

            //callback when page is hidden
            if (typeof this.options.onHidden === 'function') {
                this.onHiddenCallback = this.options.onHidden;
            }

            //callback when page is visible
            if (typeof this.options.onVisible === 'function') {
                this.onVisibleCallback = this.options.onVisible;
            }
        }

        //store a reference to our binding for visibilitychange event
        //this is needed for removeEventListener if destroy() is called
        this.change = this.bindContext(this, this.visibilityChange);

        //add an event listener for visibilitychange
        this.configListener('add');
    }

    Visibility.prototype.configListener = function (config) {

        var visProp, evtName;

        visProp = this.getHiddenProp(d);

        if (visProp) {
            evtName = visProp.replace(/[H|h]idden/, '') + 'visibilitychange';

            if (config === 'add') {
                d.addEventListener(evtName, this.change, false);
            } else if (config === 'remove') {
                d.removeEventListener(evtName, this.change, false);
            }
        }
    };

    Visibility.prototype.getHiddenProp = function (doc) {

        var prefixes = ['webkit', 'moz', 'ms', 'o'];

        // if 'hidden' is natively supported just return it
        if ('hidden' in doc) { return 'hidden'; }

        // otherwise loop over all the known prefixes until we find one
        for (var i = 0; i < prefixes.length; i += 1) {
            if ((prefixes[i] + 'Hidden') in doc) {
                return prefixes[i] + 'Hidden';
            }
        }

        // otherwise it's not supported
        return null;
    };

    Visibility.prototype.isHidden = function () {

        var prop = this.getHiddenProp(d);

        if (!prop) { return false; }

        return d[prop];
    };

    Visibility.prototype.isSupported = function () {

        var prop = this.getHiddenProp(d);

        if (!prop) { return false; }

        return true;
    };

    Visibility.prototype.bindContext = function (context, handler) {
        return function () {
            return handler.call(context);
        };
    };

    Visibility.prototype.visibilityChange = function () {

        var hidden = this.isHidden();

        if (hidden && this.onHiddenCallback) {
            this.onHiddenCallback();
        } else if (!hidden && this.onVisibleCallback) {
            this.onVisibleCallback();
        }
    };

    Visibility.prototype.destroy = function () {
        this.configListener('remove');
        this.onHiddenCallback = null;
        this.onVisibleCallback = null;
    };

    return Visibility;

}));
