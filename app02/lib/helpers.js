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
var path = require('path');
var fs = require('fs');
var util = require('util');
var debug = util.debuglog('helpers');   // $>  NODE_DEBUG=helpers node index.js


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

//  Get the string content of a template
helpers.getTemplate = function(templateName, data, callback){
    templateName = typeof(templateName) == 'string' && templateName.length > 0 ? templateName : false;
    data = typeof(data) == 'object' && data !== null ? data : {};

    if (templateName)  {
        var templateDir = path.join(__dirname, '/../templates/');
        debug('\x1b[36m%s\x1b[0m', 'h.getTemplates :: templateDir='+templateDir);
        fs.readFile(templateDir+templateName+'.html', 'utf8', function(err, str) {
            if (!err && str && str.length > 0) {
                //  Do interpolation in the string
                debug('\x1b[35m%s\x1b[0m', 'h.getTemplates :: begin interpolate');
                var finalString = helpers.interpolate(str, data);
                debug('\x1b[35m%s\x1b[0m', 'h.getTemplates :: finalString='+finalString);
                callback(false, finalString);
            }  else  {
                callback("No template could be found.");
            }
        });
    }  else  {
        callback("A valid template name was not specified.");
    }
};

//  Add the universal header and footer to a string, and pass provided data object to 
helpers.addUniversalTemplates = function(str, data, callback) {
    str = typeof(str) == 'string' && str.length > 0 ? str : '';
    data = typeof(data) == 'object' && data !== null ? data : {};
    //  Get the header
    helpers.getTemplate('_header', data, function(err, headerString) {
        if (!err && headerString)  {
            //  Get the footer
            helpers.getTemplate('_footer', data, function(err, footerString) {
                if (!err && footerString)  {
                    //Add these 3 strings together
                    var fullString = headerString+str+footerString;
                    callback(false, fullString);
                }  else  {
                    callback('Could not find the footer template.');
                }
            });
        }  else  {
            callback('Could not find the header template.');
        }
    });
};

//  Take a given string and a data object and find/replace all the keys
helpers.interpolate = function(str, data) {
    str = typeof(str) == 'string' && str.length > 0 ? str : '';
    data = typeof(data) == 'object' && data !== null ? data : {};

    for(var keyName in config.templateGlobals) {
        if (config.templateGlobals.hasOwnProperty(keyName))  {
            debug('\x1b[36m%s\x1b[0m', "h.interpolate keyname="+keyName);
            debug('\x1b[36m%s\x1b[0m', "h.interpolate config.tempGlob.keyname="+config.templateGlobals[keyName]);
            data['global.'+keyName] = config.templateGlobals[keyName];
        }
    }

    //  For each key in the data object, insert the value into the template
    for (var key in data) {
        debug('\x1b[33m%s\x1b[0m', "h.interpolate insert val for "+key);
        if (data.hasOwnProperty(key) && typeof(data[key]) == 'string') {
            var replace = data[key];
            var find = '{'+key+'}';
            debug('\x1b[32m%s\x1b[0m', "h.interpolate find="+find);
            debug('\x1b[32m%s\x1b[0m', "h.interpolate replace="+replace);
            str = str.replace(find, replace);
        }
    }

    return str;
};

//  Get the contents of a static (public) asset
helpers.getStaticAsset = function(fileName, callback)  {
    fileName = typeof(fileName) == 'string' && fileName.length > 0 ? fileName : false;
    if (fileName)  {
        var publicDir = path.join(__dirname, '/../public/');
        fs.readFile(publicDir+fileName, function(err, data){
            if (!err && data) {
                callback(false, data);
            }  else  {
                callback('No file was found.');
            }
        });
    }  else  {
        callback('A valid file name was not specified.');
    }
}
//  Export the module
module.exports = helpers;