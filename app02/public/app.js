/*
*
*  This is the frontend logic for application
*
*
*/

//  Container for front end application
var app={};

// Config
app.config = {
    'sessionToken' : false
};

//  AJAX client for RESTful API
app.client = {};

//Interface for making API calls
app.client.request = function(headers, path, method, queryStringObject, payload, callback) {

    //  Set defaults
    headers = typeof(headers) == 'object' && headers !== null ? headers : {};
    path = typeof(path) == 'string' ? path : '/';
    method = typeof(method) == 'string' && ['POST', 'GET', 'PUT', 'DELETE'].indexOf(method) > -1 ? method.toUpperCase() : 'GET';
    queryStringObject = typeof(queryStringObject) == 'object' && queryStringObject !== null ? queryStringObject : {};
    payload = typeof(payload) == 'object' && payload !== null ? payload : {};
    callback = typeof(callback) == 'function' ? callback : false;

    //  For each queryString parameter string sent, add it to the path
    var requestUrl = path+'?';
    var counter = 0;
    for(var queryKey in queryStringObject) {
        if (queryStringObject.hasOwnProperty(queryKey))  {
            counter++;
            //  If at least one query string parameter has been added
            if (counter > 1) {
                requestUrl+='&';
            }
            requestUrl+=queryKey+'='+queryStringObject[queryKey];
        }
    }

    //  Form thr HTTP request as a JSON type
    var xhr = new XMLHttpRequest();
    xhr.open(method, requestUrl, true);
    xhr.setRequestHeader("content-Type", 'application/json');

    //  For each header sent, add it to the request
    for(var headerKey in headers) {
        if (headers.hasOwnProperty(headerKey))  {
            xhr.setRequestHeader(headerKey, headers[headerkey]);
        }
    }

    //  If there is a current session token set, add that as a header
    if(app.config.sessionToken)  {
        xhr.setRequestHeader("token", app.config.sessionToken.id);
    }

    //  When the response comes back, handle the response
    xhr.onreadystatechange = function(){
        if (xhr.readyState == XMLHttpRequest.DONE)  {
            var statusCode = xhr.status;
            var responseReturned = xhr.responseText;

            //  Callback if requested
            if(callback) {
                try  {
                    var parseResponse = JSON.parse(responseReturned);
                    callback(statusCode, parseResponse);
                }  catch(e)  {
                    callback(statusCode, false);
                }
            }
        }
    }

    //  Send the payload as JSON
    var payloadString = JSON.stringify(payload);
    xhr.send(payloadString);
};

