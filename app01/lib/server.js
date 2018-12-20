/* 
*
*  Server related tasks
*
*/

//  Dependencies
var http = require('http');
var https = require('https');
var url = require('url');
var StringDecoder = require('string_decoder').StringDecoder;
var config = require('./config');
var fs = require('fs');
var handlers = require('./handlers');
var helpers = require('./helpers');
var path = require('path');
var util = require('util');
var debug = util.debuglog('server');   // $>  NODE_DEBUG=server node index.js

//Instantiate the server module object
var server = {};

// Instantiating the HTTP server
server.httpServer = http.createServer(function(req, res) {
    server.unifiedServer(req, res);
});


// Instantiating the HTTP server
server.httpsServerOptions = {
    'key' : fs.readFileSync(path.join(__dirname, '/../https/key.pem')),
    'cert' : fs.readFileSync(path.join(__dirname, '/../https/cert.pem'))
};
server.httpsServer = https.createServer(server.httpsServerOptions, function(req, res) {
    server.unifiedServer(req, res);
});

//  All the server logic for both http and https requests
server.unifiedServer = function(req, res) {
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
        var chosenHandler = typeof(server.router[trimmedPath]) !== 'undefined' ? server.router[trimmedPath] : handlers.notFound;

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

            //  If the response is 200, print green otherwise print red
            if (statusCode == 200) {
                debug('\x1b[32m%s\x1b[0m', method.toUpperCase()+' /'+trimmedPath+' '+statusCode);
            }  else  {
                debug('\x1b[31m%s\x1b[0m', method.toUpperCase()+' /'+trimmedPath+' '+statusCode);
            }
        });

        //  Log the request path
        //debug('Request received on path: '+trimmedPath+' with this method '+method+' and with these query string paramaters',queryStringObject );
        //debug('Request received with these headers ',headers);
        //debug('Request received with this payload ',buffer);
    });

};


//  Defining a request router
server.router = {
    'ping' : handlers.ping,
    'users' : handlers.users,
    'tokens' : handlers.tokens,
    'checks' :handlers.checks
};

//  Init script
server.init = function(){
    //  Start the server
    server.httpServer.listen(config.httpPort, function() {
        console.log('\x1b[36m%s\x1b[0m', "The server is listening on port "+config.httpPort+" now");
    });

    //  Start the HTTPS server
    server.httpsServer.listen(config.httpsPort, function() {
        console.log('\x1b[35m%s\x1b[0m', "The server is listening on port "+config.httpsPort+" now");
    });

}

module.exports = server;