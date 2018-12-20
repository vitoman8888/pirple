/* 
*
*  Worker related tasks
*
*/

//  Dependencies
var path = require('path');
var fs = require('fs');
var _data = require('./data');
var https = require('https');
var http = require('http');
var helpers= require('./helpers');
var url = require('url');
var _logs = require('./logs');
var util = require('util');
var debug = util.debuglog('workers');   // $>  NODE_DEBUG=workers node index.js

//  Instantiate the worker object
var workers = {};

//  Lookup all checks, get thier data, send to validator
workers.gatherAllChecks = function() {
    //  Get all the checks that exist in the system
    _data.list('checks', function(err, checks) {
        if (!err && checks && checks.length > 0) {
            checks.forEach(function(check) {
                //  Read in the check data
                _data.read('checks', check, function(err, originalCheckData) {
                    if (!err && originalCheckData) {
                        //  Pass it to the check validator, and let that function 
                        //  continue or log errors as needed
                        workers.validateCheckData(originalCheckData);
                    }  else  {
                        debug("Error reading one of the check's data")
                    }
                })
            });
        }  else  {
            debug("Error: Could not find any checks to process.")
        }
    })
};

//  Timer to execute the worker process once per minute
workers.loop = function() {
    setInterval(function() {
        workers.gatherAllChecks();
    }, 1000 * 60)
};

//  Sanity checking the check data
workers.validateCheckData = function(checkData)  {
    checkData = typeof(checkData) == 'object' && checkData !== null ? checkData : {}; 
    checkData.id = typeof(checkData.id) == 'string' && checkData.id.trim().length == 20 ? checkData.id.trim() : false;
    checkData.userPhone = typeof(checkData.userPhone) == 'string' && checkData.userPhone.trim().length == 10 ? checkData.userPhone.trim() : false;
    checkData.protocol = typeof(checkData.protocol) == 'string' && ['http', 'https'].indexOf(checkData.protocol) > -1 ? checkData.protocol : false;
    checkData.url = typeof(checkData.url) == 'string' && checkData.url.trim().length > 0 ? checkData.url.trim() : false;
    checkData.method = typeof(checkData.method) == 'string' && ['POST', 'GET', 'PUT', 'DELETE'].indexOf(checkData.method.toUpperCase()) > -1 ? checkData.method : false;
    checkData.successCodes = typeof(checkData.successCodes) == 'object' && checkData.successCodes instanceof Array && checkData.successCodes.length > 0 ? checkData.successCodes : false;
    checkData.timeoutSeconds = typeof(checkData.timeoutSeconds) == 'number' && checkData.timeoutSeconds % 1 === 0 && checkData.timeoutSeconds >= 1 && checkData.timeoutSeconds <= 5 ? checkData.timeoutSeconds : false;

    //  Set the keys that might not be set if the workers have never seen this check before
    checkData.state = typeof(checkData.state) == 'string' && ['up', 'down'].indexOf(checkData.state) > -1 ? checkData.state : 'down';
    checkData.lastChecked = typeof(checkData.lastChecked) == 'number' && checkData.lastChecked % 1 === 0 && checkData.lastChecked > 0 ? checkData.lastChecked : false;

    //  If all the checks pass, pass the data along the next step in the process
    if (checkData.id && checkData.userPhone &&
            checkData.protocol && checkData.url &&
            checkData.method && checkData.successCodes && 
            checkData.timeoutSeconds)  {
        workers.performCheck(checkData);
    }  else {
        debug("one of the checks is not properly formatted.  Skipping it.");
    }

};

//  Perform the check, send the original Check data and the outcome to the next step of the process
workers.performCheck = function(checkData)  {
    //  Prepare the initial check outcome
    var checkOutcome = {
        'error' : false, 
        'responseCode' : false
    };

    //  Mark that the outcome has not been sent yet
    var outcomeSent = false;

    //  Parse the hostname and path out of check data
    var parsedUrl = url.parse(checkData.protocol+'://'+checkData.url, true);
    var hostName = parsedUrl.hostname;
    var path = parsedUrl.path;   //  Using path and not 'pathname' cuz we want the query string

    //  Constructing the request
    var requestDetails = {
        'protocol' : checkData.protocol+':',
        'hostname' : hostName,
        'method' : checkData.method.toUpperCase(),
        'path' : path,
        'timeout' : checkData.timeoutSeconds * 1000
    }

    //  Instantiate the request object 
    var _moduleToUse = checkData.protocol == 'http' ? http : https;
    var req = _moduleToUse.request(requestDetails, function(res) {
        //  Grab the status of the sent request
        var status = res.statusCode;

        //  Update the checkOutcome and pass the data along
        checkOutcome.responseCode = status;
        if (!outcomeSent) {
            workers.processCheckOutcome(checkData, checkOutcome);
            outcomeSent = true;
        }
    });

    //  Bind to the error event so it does not get thrown
    req.on('error', function(e) {
        //  Update the checkOutcome and pass the data along
        checkOutcome.error = {
            'error' : true,
            'value' : e
        };
        if (!outcomeSent) {
            workers.processCheckOutcome(checkData, checkOutcome);
            outcomeSent = true;
        }
    });

    //  Bind to the timeout event
    req.on('timeout', function(e) {
        //  Update the checkOutcome and pass the data along
        checkOutcome.error = {
            'error' : true,
            'value' : 'timeout'
        };
        if (!outcomeSent) {
            workers.processCheckOutcome(checkData, checkOutcome);
            outcomeSent = true;
        }
    });

    //  End the request
    req.end();

};

//  Process the check outcome, update check data, and trigger alert if needed
//  Special logic for accomodating a check that has never been tested before (no alerts)
workers.processCheckOutcome = function(checkData, checkOutcome)  {
    //  Decide if the check is considered up or down in current state
    var state = !checkOutcome.error && checkOutcome.responseCode && checkData.successCodes.indexOf(checkOutcome.responseCode) > -1 ? 'up' : 'down';

    //  Decide if an alert is warrented
    var alertWarrented = checkData.lastChecked && checkData.state !== state  ? true : false;

    //Log the outcome
    var timeOfCheck = Date.now();
    workers.log(checkData, checkOutcome, state, alertWarrented, timeOfCheck);

    //Update the check data
    var newCheckData = checkData;
    newCheckData.state = state;
    newCheckData.lastChecked = timeOfCheck;

    //Save updates to disk
    _data.update('checks', newCheckData.id, newCheckData, function(err)  {
        if (!err)  {
            //  Send the new check data to the next phase in process
            if (alertWarrented) {
                workers.alertUserToStatusChange(newCheckData);
            }  else {
                debug('Check outcome not changed.  No alert needed');
            }
        }  else  {
            debug("Error trying to save updates to one of the checks");
        }
    });
};

//  Alert the user to the change in thier check status
workers.alertUserToStatusChange = function(newCheckData){
    var msg = 'Alert: Your check for '+newCheckData.method.toUpperCase()+' '+newCheckData.protocol+'://'+newCheckData.url+' is currently '+newCheckData.state;
    helpers.sendTwilioSms(newCheckData.userPhone, msg, function(err) {
        if(!err) {
            debug("Success: User was alerted to a status change in thier check via SMS: ", msg);
        }  else  {
            debug("Error:  Could not send SMS alert to user with state change in check.");
        }
    });
};

//  Log
workers.log = function(originalCheckData, checkOutcome, state, alertWarrented, timeOfCheck){
    //  Form the log data
    var logData = {
        'check' : originalCheckData,
        'outcome' : checkOutcome,
        'state' : state,
        'alert' : alertWarrented,
        'time' : timeOfCheck
    };

    //  Convert data to a string
    var logString = JSON.stringify(logData);

    //  Determine the name of the log file
    var logFileName = originalCheckData.id;

    //  Append the log string to the file
    _logs.append(logFileName, logString, function(err) {
        if (!err) {
            debug("Logging to file succeeded");
        }  else  {
            debug("Logging to file failed.");
        }
    });

}

//  Rotate (compress) the log files
workers.rotateLogs = function(){
    //  List all the (non-compressed) log files
    _logs.list(false, function(err, logs){
        if (!err && logs && logs.length > 0){
            logs.forEach(function(logName){
                //  Compress the data to a different file
                var logId = logName.replace('.log','');
                var newFileId = logId+'-'+Date.now();
                _logs.compress(logId, newFileId, function(err){
                    if (!err)  {
                        _logs.truncate(logId, function(err) {
                            if (!err)  {
                                debug("Success truncating logFile");
                            }  else  {  
                                debug("Error truncating logFile");
                            }
                        });
                    }  else  {
                        debug("Error compressing one of the log files", err);
                    }
                })
            });
        }  else  {
            debug("Error : could not find any logs to rotate");
        }
    });
}

//  Timer to execute the log-rotation process once per day
workers.logRotationLoop = function(){
    setInterval(function(){
        workers.rotateLogs();
    },1000 * 60 * 60 * 24)
}

//  Initialize script
workers.init = function() {

    //  Send to console in yellow
    console.log('\x1b[33m%s\x1b[0m', 'Background workers are running');


    //  Execute all the checks immediately
    workers.gatherAllChecks();

    //  Call the loop so the checks will execute later on
    workers.loop();

    //  Compress all the logs immediately
    workers.rotateLogs();

    //  Call the compression loop so that logs will be compressed later on
    workers.logRotationLoop();

};

//  Export the module
module.exports = workers;