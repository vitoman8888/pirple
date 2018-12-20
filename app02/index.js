/* 
*
*  Primary file for the API
*
*/

//  Dependencies
var server = require('./lib/server');
var workers = require('./lib/workers');

//  Declare the app
var app = {};

//  Init function
app.init = function(){
    //start the server
    server.init();
    //start the workers
    workers.init();

};

//Execute
app.init();

//Export the app
module.exports = app;


/*
//
//'Earlier' code bfore refactoring for the Background Workers chapter
//
// Instantiating the HTTP server
var httpServer = http.createServer(function(req, res) {
    unifiedServer(req, res);
});

//  Start the server
httpServer.listen(config.httpPort, function() {
    console.log("The server is listening on port "+config.httpPort+" now");
});

// Instantiating the HTTP server
var httpsServerOptions = {
    'key' : fs.readFileSync('./https/key.pem'),
    'cert' : fs.readFileSync('./https/cert.pem')
};
var httpsServer = https.createServer(httpsServerOptions, function(req, res) {
    unifiedServer(req, res);
});

//  Start the server
httpsServer.listen(config.httpsPort, function() {
    console.log("The server is listening on port "+config.httpsPort+" now");
});

//  All the server logic for both http and https requests
var unifiedServer = function(req, res) {
    //  Get the URL and parse
    var parsedUrl = url.parse(req.url, true);
    
    //  Get path from the URL
    var path = parsedUrl.pathname;
    var trimmedPath = path.replace(/^\/+|\/+$/g, '');

    // Get the query string as an object
    var queryStringObject = parsedUrl.query;

    //  Get the HTTP method
    var method = req.method.toUpperCase();

    //  Get the headers as an object
    var headers = req.headers;

    //  Get the payload, if any
    var decoder = new StringDecoder('utf-8');
    var buffer = '';
    req.on('data', function(data) {
        buffer += decoder.write(data);
    });
    req.on('end', function()  {
        buffer += decoder.end();

        //  Choose the handler this request should go to 
        //     if not found then use Not Found handler
        var chosenHandler = typeof(router[trimmedPath]) !== 'undefined' ? router[trimmedPath] : handlers.notFound;

        //  Construct the data object to send to the handler
        var data = {
            'trimmedPath' : trimmedPath,
            'queryStringObject' : queryStringObject,
            'method' : method,
            'headers' : headers,
            'payload' : helpers.parseJsonToObject(buffer)
        };

        //  Route the request to the chosen handler
        chosenHandler(data, function(statusCode, payload) {
            //  Use the status code called back by handler, or default to 200
            statusCode = typeof(statusCode) == 'number' ? statusCode : 200;

            //  Use the payload called back by handler, or default to empty object
            payload = typeof(payload) == 'object' ? payload : {};

            //  Convert the payload to a string
            var payloadString = JSON.stringify(payload);

            res.setHeader('Content-Type','application/json');
            res.writeHead(statusCode);
            res.end(payloadString);

            console.log('Returning this response:  ', statusCode,payloadString);
        });

        //  Log the request path
        //console.log('Request received on path: '+trimmedPath+' with this method '+method+' and with these query string paramaters',queryStringObject );
        //console.log('Request received with these headers ',headers);
        //console.log('Request received with this payload ',buffer);
    });

};


//  Defining a request router
var router = {
    'ping' : handlers.ping,
    'users' : handlers.users,
    'tokens' : handlers.tokens,
    'checks' :handlers.checks
};







//var _data = require('./lib/data');

//  TESTING
// @TODO delete this
//_data.create('test', 'newFile', {'foo' : 'bar'}, function(err) {
//   console.log('this was the error', err);
//})
//_data.read('test', 'newFile1', function(err, data) {
//    console.log('this was the error ', err, ' and this was the data ', data);
//})
//_data.update('test', 'newFile', {'fizz' : 'buzz'}, function(err) {
//   console.log('this was the error', err);
//});
//_data.delete('test', 'newFile', function(err) {
//       console.log('this was the error', err);
//});

*/