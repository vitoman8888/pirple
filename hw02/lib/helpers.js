/*
*
*   Helpers for various tasks
*
*/

//Dependencies
var crypto = require('crypto');
var config = require('./config');
var https = require('https');
var querystring = require('querystring');

//  container for all the helpers
var helpers = {};

//  Create a SHA256 hash
helpers.hash = function(str) {
    if (typeof(str) == 'string' && str.length > 0) {
        var hash = crypto.createHmac('sha256', config.hashingSecret).update(str).digest('hex');
        return hash;
    }  else  {
        return false;
    }
};

//  Parse a JSON string to an object, withoput throwing  
helpers.parseJsonToObject = function(str) {
    try  {
        var obj = JSON.parse(str);
        return obj;
    }  catch(e)  {
        return {};
    }
};

//  Create a string of random alphanumeric characters
helpers.createRandomString = function(strLength) {
    strLength = typeof(strLength) == 'number' && strLength > 0 ? strLength : false;
    if (strLength) {
        //Define all possible characters that could go into a string
        var possibleCharacters = 'abcdefghijklmnopqrstuvwxyz0123456789';

        //Start the final string
        var str = '';
        for (i = 1; i <= strLength; i++)  {
            // Get a random character from the possible Character strings
            var randomCharacter = possibleCharacters.charAt(Math.floor(Math.random() * possibleCharacters.length));
            str += randomCharacter
        }
        return str;
    }  else  {
        return false;
    }
};

// Send anSMS message via Twilio
helpers.sendTwilioSms = function(phone, msg, callback) {
    // Validate parameters
    phone = typeof(phone) == 'string' && phone.trim().length == 10 ? phone.trim() : false;
    msg =  typeof(msg) == 'string' && msg.trim().length > 0 &&  msg.trim().length <= 1600 ? msg.trim() : false;

    console.log("P="+phone+"  msg="+msg);
    console.log("auth"+config.twilio.accountSid+':'+config.twilio.authToken);
    
    if (phone && msg)  {
        //  Configure the request payload
        var payload = {
            'From' : config.twilio.fromPhone,
            'To' : '+1'+phone,
            'Body' : msg
        };

        //  Stringify the payload
        var stringPayload = querystring.stringify(payload);

        //  Configure the request details
        var requestDetails = {
            'protocol' : 'https:',
            'hostname' : 'api.twilio.com',
            'method' : 'POST',
            'path' : '/2010-04-01/Accounts/'+config.twilio.accountSid+'/Messages.json',
            'auth' : config.twilio.accountSid+':'+config.twilio.authToken,
            'headers' : {
                'Content-Type' : 'application/x-www-form-urlencoded',
                'Content-Length' : Buffer.byteLength(stringPayload)
            }
        };

        console.log("Request Details", requestDetails);
        console.log("call URL = "+requestDetails.protocol+"//"+requestDetails.hostname+requestDetails.path);

        //  Instantiate the request object
        var req = https.request(requestDetails, function(res) {
            //  Grab the status of the sent request
            var status = res.statusCode;
            //  Callback successfully if the request went through
            if (status == 200 || status == 201) {
                callback(false);
            }  else  {
                callback('Status code returned was '+ status);
            }

        });

        //  Bind to the error event so it doesnt get thrown
        req.on('error', function(e) {
            callback(e);
        });

        //  Add the payload
        req.write(stringPayload);

        //  End the request
        req.end();

    }  else  {
        callback('Given parameters wre missing or invalid.')
    }
};


//  Export the module
module.exports = helpers;