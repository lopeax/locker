# Pattern Locker
A Vanilla JS implementation of a pattern locker

## Usage
```javascript
var locker = new Locker({
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
});
```
