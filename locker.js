// This is the class generator used
var Class = function(methods) {
    var c = function() {
        this.initialize.apply(this, arguments);
    };

    for (var property in methods) {
        c.prototype[property] = methods[property];
    }

    if (!c.prototype.initialize) c.prototype.initialize = function() {};

    return c;
};

/**
 * Locker.js v0.0.0
 * Author: Tony Lopez
 * Copyright (c) 2016 Tony Lopez, released under the MIT license.
 * Demo on: http://codepen.io/zephyr/pen/yOwxqW
 *
 * This class generates a pattern locker with touch and mouse support
 * it is inspired by the android pattern lock
 *
 * TODO List:
 * 1) Better point generation
 * 2) Clean up the colour shift function
 * 3) Add some sort of message or notification if the wrapper doesn’t exist (or create it? haven’t decided what to do there)
 * 4) Save a pattern (via ajax most likely) and test against it - uses LocalStorage atm
 * 5) Eventually make full comments adhering to a standard
 * 6) General cleanup
 * 7) Stop interactivity on mouseup until the locker is reset
 *
 */
var Locker = Class({
    /**
     * The extend function, used to extend an object with another
     * while overriding it's properties if any match
     */
    extend: function() {
        var extended = {};
        var deep = false;
        var i = 0;
        var length = arguments.length;

        if (Object.prototype.toString.call(arguments[0]) === '[object Boolean]') {
            deep = arguments[0];
            i++;
        }

        var merge = function(obj) {
            for (var prop in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, prop)) {
                    if (deep && Object.prototype.toString.call(obj[prop]) === '[object Object]') {
                        extended[prop] = extend(true, extended[prop], obj[prop]);
                    } else {
                        extended[prop] = obj[prop];
                    }
                }
            }
        };

        for (; i < length; i++) {
            var obj = arguments[i];
            merge(obj);
        }

        return extended;
    },
    /**
     * Calculate the exactly length of a line (i.e it's hypoteneuse via the two)
     * x and y coordinates
     */
    hypot: function() {
        var y = 0;
        var length = arguments.length;

        for (var i = 0; i < length; i++) {
            if (arguments[i] === Infinity || arguments[i] === -Infinity) {
                return Infinity;
            }
            y += arguments[i] * arguments[i];
        }
        return Math.sqrt(y);
    },
    /**
     * This starts off the whole class with the options given (or the defaults)
     */
    initialize: function(opts) {
        this.opts = this.extend({
            // This is what identifies the wrapping div for the lock
            wrap: '.locker',

            // The height and width of the locker in pixels
            height: 320,
            width: 320,

            // The background colour of the locker
            background: '#333333',

            // Add styling to position it centered on the page
            // set to false if using custom styles to position
            centered: true,

            // The colour of the line as it is being drawn
            drawing: '#FFFFFF',

            // The colour of the line on save
            saved: '#0088CC',

            // The colour of the line on completion if successful
            success: '#00CC88',

            // The colour of the line on completion if incorrect
            error: '#EF5350',

            // The minimum number of points that need to be filled in
            cap: 4,

            // The colour of the points
            pointscolour: '#FFFFFF',

            // The radius of the points
            pointsize: 5,

            // The radius of the points when active
            pointhoversize: 7,

            // The radius of the area around the point which can activate
            // the point
            pointboundary: 22,

            // The width of the line
            strokewidth: 2,

            // The time taken on completion to reset the lock
            timer: 1000,

            // Add a debugger just below the lock showing the event
            // and the x and y values for the event (useful for mobile testing)
            debug: false
        }, opts);

        // Get the wrapper of the locker
        this.wrap = document.querySelector(this.opts.wrap);

        // If the document has the wrapper, and there are no canvas's inside the wrapper
        // start the locker
        if (document.contains(this.wrap) && this.wrap.getElementsByTagName('canvas').length == 0) {
            // Set the height, width and background of the locker according to the options
            this.wrap.style.height = this.opts.height.toString() + 'px';
            this.wrap.style.width = this.opts.width.toString() + 'px';
            this.wrap.style.backgroundColor = this.opts.background;
            document.body.style.overflowY = 'hidden';

            // Set the styles to center the lock if applicable
            if (this.opts.centered) {
                this.wrap.style.position = 'fixed';
                this.wrap.style.top = '50%';
                this.wrap.style.left = '50%';
                this.wrap.style.webkitTransform = 'translate(-50%, -50%)';
                this.wrap.style.transform = 'translate(-50%, -50%)';
            }

            // Add a line canvas in order to use later on with it's context
            this.linecanvas = this.addCanvas();
            this.linectx = this.linecanvas.getContext('2d');

            // Add a points canvas in order to use later on with it's context
            this.pointscanvas = this.addCanvas();
            this.pointsctx = this.pointscanvas.getContext('2d');

            // The key used for using localstorage to save points
            this.localSavedPattern = 'lockpattern-' + Date.now(),

                // Initialise the initial mouse position
                this.mouse = {
                    x: -1,
                    y: -1
                };

            // Initialise the initial starting point
            this.p = {
                x: -1,
                y: -1
            };

            // Initialise the counter to track which points are used in order
            this.count = 0;

            // Make the points and draw them
            this.makePoints();
            this.drawPoints();
            this.saved = false;

            // Add the debugger if applicable
            if (this.opts.debug) {
                this.debugger = this.addDebugger();
            }

            // Bind the mouse events
            this.wrap.addEventListener('mousedown', this.dragStart.bind(this));
            this.wrap.addEventListener('mousemove', this.dragMove.bind(this));
            this.wrap.addEventListener('mouseup', this.dragEnd.bind(this));

            // Bind the touch events
            this.wrap.addEventListener('touchend', this.dragEnd.bind(this));
            this.wrap.addEventListener('touchmove', this.dragMove.bind(this));
            this.wrap.addEventListener('touchstart', this.dragStart.bind(this));
        } else {
            // Silently don't do anything, TODO
        }
    },
    /**
     * A wrapper for setTimeout which will only ever execute once
     */
    executeAfter: (function() {
        var timers = {};
        return function(callback, ms, uniqueId) {
            if (!uniqueId) {
                uniqueId = 'Timer-' + Date.now().toString();
            }
            if (timers[uniqueId]) {
                clearTimeout(timers[uniqueId]);
            }
            timers[uniqueId] = setTimeout(callback, ms);
        };
    })(),
    /**
     * Test if all the points have been filled
     */
    allPointsFilled: function(arr) {
        var i = arr.length;
        while (i--) {
            if (arr[i].s === false) {
                return false;
            }
        }
        return true;
    },
    /**
     * Add a canvas element with a few styles and return it's reference
     */
    addCanvas: function() {
        var canv = document.createElement('canvas');
        canv.height = this.opts.height;
        canv.width = this.opts.width;

        canv.style.position = 'absolute';
        canv.style.top = '0';
        canv.style.left = '0';
        canv.style.zIndex = '-1';

        this.wrap.appendChild(canv);
        return canv;
    },
    /**
     * Add the debugger with a few styles and return it's reference
     */
    addDebugger: function() {
        var debug = document.createElement('div');
        debug.className = 'locker-debugger';

        debug.style.position = 'absolute';
        debug.style.width = '100%';
        debug.style.top = 'calc(100% + 15px)';
        debug.style.fontSize = '15px';
        debug.style.textAlign = 'center';

        this.wrap.appendChild(debug);
        return debug;
    },
    /**
     * Attach the appropriate event info to the debugger
     * Will probably be removed
     */
    debugEvent: function(e) {
        this.debugger.innerHTML = 'Event type: ' + e.type;
        if (e.type == 'touchstart' || e.type == 'touchmove' || e.type == 'touchend') {
            this.debugger.innerHTML += ' x: ' + e.targetTouches[0].pageX +
                ' y: ' + e.targetTouches[0].pageY +
                ' top: ' + e.target.getBoundingClientRect().top +
                ' left: ' + e.target.getBoundingClientRect().left;
        } else {
            this.debugger.innerHTML += ' x: ' + e.offsetX +
                ' y: ' + e.offsetY;
        }
    },
    /**
     * A wrapper for the points to initialise them in a grid layout
     * TODO: Get a better way of generating these points
     */
    makePoints: function() {
        this.points = [{
            x: this.opts.width / 4,
            y: this.opts.height / 4,
            s: false,
            id: 1
        }, {
            x: this.opts.width / 2,
            y: this.opts.height / 4,
            s: false,
            id: 2
        }, {
            x: this.opts.width * 3 / 4,
            y: this.opts.height / 4,
            s: false,
            id: 3
        }, {
            x: this.opts.width / 4,
            y: this.opts.height / 2,
            s: false,
            id: 4
        }, {
            x: this.opts.width / 2,
            y: this.opts.height / 2,
            s: false,
            id: 5
        }, {
            x: this.opts.width * 3 / 4,
            y: this.opts.height / 2,
            s: false,
            id: 6
        }, {
            x: this.opts.width / 4,
            y: this.opts.height * 3 / 4,
            s: false,
            id: 7
        }, {
            x: this.opts.width / 2,
            y: this.opts.height * 3 / 4,
            s: false,
            id: 8
        }, {
            x: this.opts.width * 3 / 4,
            y: this.opts.height * 3 / 4,
            s: false,
            id: 9
        }];
    },
    /**
     * Save points - Prefer to be ajax instead of within object
     * is stored just for simplicity and testing
     */
    savePoints: function(p) {
        localStorage.setItem(this.localSavedPattern, JSON.stringify(p));
        this.saved = true;

        var clicked = (navigator.userAgent.match(/iPad/i)) ? 'touchstart' : 'click';
        var reset = this.addReset();
        reset.addEventListener(clicked, function() {
            this.resetSavedPoints(reset);
        }.bind(this));
    },
    /**
     * Match points - match the saved points to the current points
     */
    matchPoints: function(p) {
        var saved = JSON.parse(localStorage.getItem(this.localSavedPattern));
        for (var i = 0; i < saved.length; i++) {
            if (saved[i].s === false) {
                saved[i] = 'unused';
            }
        }
        for (var i = 0; i < p.length; i++) {
            if (p[i].s === false) {
                p[i] = 'unused';
            }
        }
        saved = this.sortPoints(saved);
        p = this.sortPoints(p);
        return JSON.stringify(p) === JSON.stringify(saved);
    },
    /**
     * Reset the saved points
     */
    resetSavedPoints: function(reset) {
        localStorage.removeItem(this.localSavedPattern);
        reset.remove();
        this.saved = false;
    },
    addReset: function() {
        var reset = document.createElement('div');
        reset.innerHTML = 'Reset';

        reset.style.backgroundColor = '#fff';
        reset.style.color = '#333';
        reset.style.borderRadius = '0.2em';
        reset.style.padding = '7px 10px';
        reset.style.cursor = 'pointer';

        reset.style.position = 'absolute';
        reset.style.top = '20px';
        reset.style.left = '50%';
        reset.style.webkitTransform = 'translateX(-50%)';
        reset.style.transform = 'translateX(-50%)';
        reset.style.zIndex = '0';

        this.wrap.appendChild(reset);
        return reset;
    },
    /**
     * Sort the points (p) via when they have been filled in
     */
    sortPoints: function(p) {
        return p.sort(function(a, b) {
            if (a.s === false) {
                return 1;
            } else if (b.s === false) {
                return -1;
            } else if (a.s === b.s) {
                return 0;
            } else {
                return a.s < b.s ? -1 : 1;
            }
        });
    },
    /**
     * Wrapper for drawing a point
     * x = the x coordinate of the point
     * y = the y coordinate of the point
     * s = the radius of the point
     * c = the colour of the point
     */
    drawPoint: function(x, y, s, c) {
        this.pointsctx.beginPath();
        this.pointsctx.arc(x, y, s, 0, 2 * Math.PI);
        this.pointsctx.strokeStyle = c;
        this.pointsctx.stroke();
        this.pointsctx.fillStyle = c;
        this.pointsctx.fill();
    },
    /**
     * Wrapper for clearing a point
     * x = the x coordinate of the point
     * y = the y coordinate of the point
     * s = the radius of the point
     */
    clearPoint: function(x, y, s) {
        this.pointsctx.clearRect(x - 2, y - 2, s + 4, s + 4);
    },
    /**
     * Wrapper for animating a point to grow
     */
    growPoint: function(point) {
        // Get the initial size
        var s = this.opts.pointsize;

        // The id of the requested animation frame to clear
        var id;

        // Wrap this in another variable to use inside the draw function
        var self = this;
        (function draw() {
            // If the current size is less than the maximum size, increase the size
            // otherwise, clear the animation
            if (s <= self.opts.pointhoversize) {
                self.clearPoint(point.x, point.y, s * 2);
                s += 0.23;
                self.drawPoint(point.x, point.y, s, self.opts.pointscolour);
                id = window.requestAnimationFrame(draw);
            } else {
                window.cancelAnimationFrame(id);
                id = undefined;
            }
        })();
    },
    /**
     * Reverse of growPoint
     */
    shrinkPoint: function(point) {
        var s = this.opts.pointhoversize;
        var id;
        var self = this;
        (function draw() {
            if (s >= self.opts.pointsize) {
                self.clearPoint(point.x - s, point.y - s, s * 2);
                s += -0.23;
                self.drawPoint(point.x, point.y, s, self.opts.pointscolour);
                id = window.requestAnimationFrame(draw);
            } else {
                window.cancelAnimationFrame(id);
                id = undefined;
            }
        })();
    },
    /**
     * Draw all the points
     */
    drawPoints: function() {
        for (var i = 0; i < this.points.length; i++) {
            this.drawPoint(this.points[i].x, this.points[i].y, this.opts.pointsize, this.opts.drawing);
        }
    },
    /**
     * Clear all the points
     */
    clearPoints: function() {
        this.pointsctx.clearRect(0, 0, this.opts.width, this.opts.height);
    },
    /**
     * Reset the locker to it's starting state after testing the pattern
     * c = the colour determined after testing the pattern (i.e. success or fail)
     */
    clearLocker: function(c) {
        this.clearLine();
        this.colourShift(this.points, this.opts.drawing, c);

        this.executeAfter(function() {
            this.clearLine();
            for (var i = 0; i < this.points.length; i++) {
                if (this.points[i].s !== false) {
                    this.shrinkPoint(this.points[i]);
                    this.points[i].s = false;
                }
            }
            this.makePoints();
        }.bind(this), this.opts.timer);
    },
    /**
     * Wrapper for drawing a line
     * x = the x coordinate of the start of the line
     * y = the y coordinate of the start of the line
     * mx = the x coordinate of the end of the line
     * my = the y coordinate of the end of the line
     * c = the colour of the line
     */
    drawLine: function(x, y, mx, my, c) {
        this.linectx.beginPath();
        this.linectx.moveTo(x, y);
        this.linectx.lineTo(mx, my);
        this.linectx.strokeStyle = c;
        this.linectx.lineWidth = this.opts.strokewidth;
        this.linectx.stroke();
    },
    /**
     * Wrapper for clearing the line canvas
     */
    clearLine: function() {
        this.linectx.clearRect(0, 0, this.opts.width, this.opts.height);
    },
    /**
     * Wrapper for drawing the existing line (minus the line being drawn)
     * p = the points
     * c = the colour to draw the line
     */
    drawExistingLine: function(p, c) {
        for (var i = 0; i < p.length - 1; i++) {
            if (p[i].s !== false && p[i + 1].s !== false) {
                this.drawLine(p[i].x, p[i].y, p[i + 1].x, p[i + 1].y, c);
            }
        }
    },
    /**
     * Wrapper for drawing the existing line while snapping the drawn line to a point
     * p = the points
     * c = the colour to draw the line
     */
    drawExistingPartialLine: function(p, c) {
        for (var i = 0; i < p.length - 2; i++) {
            if (p[i].s !== false && p[i + 1].s !== false && p[i + 2].s !== false) {
                this.drawLine(p[i].x, p[i].y, p[i + 1].x, p[i + 1].y, c);
            }
        }
    },
    /**
     * Wrapper for drawing the existing line while snapping the drawn line if it overlaps a point
     * p = the points
     * c = the colour to draw the line
     */
    drawExistingIntersectingPartialLine: function(p, c) {
        for (var i = 0; i < p.length - 3; i++) {
            if (p[i].s !== false && p[i + 1].s !== false && p[i + 2].s !== false && p[i + 3].s !== false) {
                this.drawLine(p[i].x, p[i].y, p[i + 1].x, p[i + 1].y, c);
            }
        }
    },
    /**
     * Wrapper for snapping the line to a point in an animated fashion
     * a = the starting point of the line
     * b = the current position of the end of the line
     * c = the end position of the end of the line
     */
    snapLine: function(a, b, c) {
        // Make a temporary version of the b point
        var tmp = {
            x: b.x,
            y: b.y
        };

        // Calculate the difference between the c point and b point
        var dx = c.x - b.x;
        var dy = c.y - b.y;

        // Get the last point (in order to increment the counter)
        var max = Math.max.apply(Math, this.points.map(function(o) {
            return o.s;
        }));
        var maxpoint = this.points.map(function(o) {
            return o.s;
        }).indexOf(max);

        // Test if there is a point inbetween point b and point c
        // and if so, fill it in and increment the counter
        var intersect = false;
        for (var j = 0; j < this.points.length; j++) {
            if (this.intersects(c, a, this.points[j])) {
                this.growPoint(this.points[j]);
                this.points[j].s = this.count;
                this.count++;
                this.points[maxpoint].s = this.count;
                this.count++;
                intersect = true;
                break;
            }
        }

        // The current requested animation frame
        var id;

        // Wrap this for use within the draw function
        var self = this;

        // Set the number of steps taken to animate
        var steps = 10;

        // Set the initial step in order to increment
        var step = 0;
        (function draw() {
            // Snap the line in an animated way to point c from point b
            if (step < steps) {
                if (intersect) {
                    self.clearLine();
                    self.drawExistingIntersectingPartialLine(self.points, self.opts.drawing);
                    self.drawLine(a.x, a.y, tmp.x, tmp.y, self.opts.drawing);
                    tmp.x += dx / steps;
                    tmp.y += dy / steps;
                } else {
                    self.clearLine();
                    self.drawExistingPartialLine(self.points, self.opts.drawing);
                    self.drawLine(a.x, a.y, tmp.x, tmp.y, self.opts.drawing);
                    tmp.x += dx / steps;
                    tmp.y += dy / steps;
                }
                id = window.requestAnimationFrame(draw);
                step++;
            } else {
                self.clearLine();
                self.drawExistingPartialLine(self.points, self.opts.drawing);
                self.drawLine(a.x, a.y, c.x, c.y, self.opts.drawing);
                window.cancelAnimationFrame(id);
                id = undefined;
            }
        })();
    },
    /**
     * Calculate the rgb value from the given hex value (c)
     */
    hexToRgb: function(c) {
        var h = (c.charAt(0) == "#") ? c.substring(1, 7) : c;
        var arr = [
            parseInt(h.substring(0, 2), 16),
            parseInt(h.substring(2, 4), 16),
            parseInt(h.substring(4, 6), 16),
        ];
        return arr;
    },
    /**
     * Calculate the hex value from the given rgb value (c)
     */
    rgbToHex: function(c) {
        var start_pos = c.indexOf('(') + 1;
        if (c.substring(0, start_pos - 1) === 'rgb') {
            var end_pos = c.indexOf(')', start_pos);
            var rgb = c.substring(start_pos, end_pos).split(',');

            function toHex(n) {
                n = parseInt(n, 10);
                if (isNaN(n)) return '00';
                n = Math.max(0, Math.min(n, 255));
                return '0123456789ABCDEF'.charAt((n - n % 16) / 16) +
                    '0123456789ABCDEF'.charAt(n % 16);
            }
            return '#' + toHex(rgb[0]) + toHex(rgb[1]) + toHex(rgb[2]);
        } else {
            return 'Sorry, this isn\'t an rgb colour';
        }
    },
    /**
     * Transition the colour of the line
     * p = all the points
     * oc = original colour
     * c = resulting colour
     */
    colourShift: function(p, oc, c) {
        // Get the rgb values of the colours
        var ocrgb = this.hexToRgb(oc);
        var crgb = this.hexToRgb(c);

        // Set the number of steps taken and calculate the step size
        // for each red, green and blue values of the rgb colours
        // TODO: Clean this up
        var steps = 10;
        var rstep, gstep, bstep;

        if (crgb[0] < ocrgb[0]) {
            rstep = Math.floor((crgb[0] - ocrgb[0]) / steps);
        } else if (crgb[0] > ocrgb[0]) {
            rstep = Math.floor((ocrgb[0] - crgb[0]) / steps);
        } else {
            rstep = 0;
        }

        if (crgb[1] < ocrgb[1]) {
            gstep = Math.floor((crgb[1] - ocrgb[1]) / steps);
        } else if (crgb[1] > ocrgb[1]) {
            gstep = Math.floor((ocrgb[1] - crgb[1]) / steps);
        } else {
            gstep = 0;
        }

        if (crgb[2] < ocrgb[2]) {
            bstep = Math.floor((crgb[2] - ocrgb[2]) / steps);
        } else if (crgb[2] > ocrgb[2]) {
            bstep = Math.floor((ocrgb[2] - crgb[2]) / steps);
        } else {
            bstep = 0;
        }

        // Set a temporary holder for the colour to change
        var colour = [
            ocrgb[0],
            ocrgb[1],
            ocrgb[2]
        ];

        // The current requested animation frame
        var id;

        // Wrap this for use within the draw function
        var self = this;

        // Set the initial step in order to increment
        var step = 0;
        (function draw() {
            // Animate the colour change with clamping to the resulting colour
            if (step < steps) {
                self.clearLine();
                var tmp = colour;
                colour = [
                    tmp[0] + rstep,
                    tmp[1] + gstep,
                    tmp[2] + bstep
                ];
                self.drawExistingLine(p, self.rgbToHex('rgb(' + colour[0] + ',' + colour[1] + ',' + colour[2] + ')'));
                id = window.requestAnimationFrame(draw);
                step++;
            } else {
                self.clearLine();
                self.drawExistingLine(p, c);
                window.cancelAnimationFrame(id);
                id = undefined;
            }
        })();
    },
    /**
     * Test if a point intersects the line between two points
     * a = The starting point of the line
     * b = The ending point of the line
     * c = The point being tested
     */
    intersects: function(a, b, c) {
        // Test if all the points are valid
        if (a.x > -1 && a.y > -1 && b.x > -1 && b.y > -1 && c.x > -1 && c.y > -1) {
            // Test if all the points are unique
            if (!((a.x == b.x) && (a.y == b.y)) && !((a.x == c.x) && (a.y == c.y)) && !((b.x == c.x) && (b.y == c.y))) {
                // Calculate the length of the three lines
                var ab = this.hypot(b.x - a.x, b.y - a.y);
                var ac = this.hypot(c.x - a.x, c.y - a.y);
                var bc = this.hypot(b.x - c.x, b.y - c.y);

                // Test if the intersecting point has already been used and
                // if the distance between a and c, and b and c is the same
                // as the total distance between a and b
                if ((ac + bc == ab) && c.s === false) {
                    return ac + bc == ab;
                }
            }
        }
    },
    /**
     * When the pointer is pressed (i.e. mousedown or touchstart), set the current position
     * of the pointer
     */
    dragStart: function(e) {
        this.mouse = {
            x: e.offsetX,
            y: e.offsetY
        };

        if (e.type == 'touchstart') {
            this.mouse = {
                x: e.targetTouches[0].pageX - e.target.getBoundingClientRect().left,
                y: e.targetTouches[0].pageY - e.target.getBoundingClientRect().top
            };
        }

        if (this.opts.debug) {
            this.debugEvent(e);
        }
    },
    /**
     * When the pointer is moving, draw a line to the pointer, calculating if it passes
     * through any points on the way
     */
    dragMove: function(e) {
        // The current cursor position
        var x = e.offsetX;
        var y = e.offsetY;

        if (e.type == 'touchmove') {
            x = e.targetTouches[0].pageX - e.target.getBoundingClientRect().left;
            y = e.targetTouches[0].pageY - e.target.getBoundingClientRect().top;
        }

        // Store the last filled point temporarily
        var prev = {
            x: this.p.x,
            y: this.p.y
        };

        // Test if the pointer is within the locker wrap
        if (this.mouse.x > -1 && this.mouse.y > -1) {
            // Clear the line canvas
            this.clearLine();

            // If not all the points have been filled in, check if the pointer
            // is within snapping distance of a not filled point and then animate
            // the snap to the point and fill the point
            if (!this.allPointsFilled(this.points)) {
                for (var i = 0; i < this.points.length; i++) {
                    var minx = this.points[i].x - this.opts.pointboundary;
                    var maxx = this.points[i].x + this.opts.pointboundary;
                    var miny = this.points[i].y - this.opts.pointboundary;
                    var maxy = this.points[i].y + this.opts.pointboundary;
                    if (x > minx && x < maxx && y > miny && y < maxy) {
                        if (this.points[i].s === false) {
                            this.p.x = this.points[i].x;
                            this.p.y = this.points[i].y;

                            this.points[i].s = this.count;
                            this.count++;
                            this.growPoint(this.points[i]);
                        }
                    }
                }

                // Sort the points to draw the existing line
                this.points = this.sortPoints(this.points);
                this.drawExistingLine(this.points, this.opts.drawing);

                if (this.p.x > -1 && this.p.y > -1 && prev.x > -1 && prev.y > -1) {
                    if ((this.p.x != prev.x) || (this.p.y != prev.y)) {
                        this.snapLine(prev, {
                            x: x,
                            y: y
                        }, this.p);
                    }
                    this.drawLine(this.p.x, this.p.y, x, y, this.opts.drawing);
                }
            } else {
                this.drawExistingLine(this.points, this.opts.drawing);
            }
        }

        if (this.opts.debug) {
            this.debugEvent(e);
        }
    },
    /**
     * When the pointer is off the screen (mouseup or touchend), test
     * if the current pattern is valid, and reset the locker after the
     * amount of time specified in the options
     */
    dragEnd: function(e) {
        this.mouse = {
            x: -1,
            y: -1
        };
        var points = this.points;

        this.p.x = -1;
        this.p.y = -1;
        this.count = 0;

        var num = this.points.filter(function(value) {
            return value.s !== false;
        }).length;

        if (num >= this.opts.cap) {
            if (!this.saved) {
                this.savePoints(points);
                this.clearLocker(this.opts.saved);
            } else {
                if (this.matchPoints(points)) {
                    this.clearLocker(this.opts.success);
                } else {
                    this.clearLocker(this.opts.error);
                }
            }
        } else {
            this.clearLocker(this.opts.error);
        }

        if (this.opts.debug) {
            this.debugEvent(e);
        }
    }
});
