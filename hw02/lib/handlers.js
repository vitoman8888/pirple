/* 
*
*  Request handlers
*
*/

//  Dependencies
var _data = require('./data');
var helpers = require('./helpers');
var config = require('./config');

//  Defining handlers
var handlers = {};


//  Users
handlers.users = function(data, callback) {
    var acceptableMethods = ['POST', 'GET', 'PUT', 'DELETE'];
    if (acceptableMethods.indexOf(data.method) > -1)  {
        handlers._users[data.method](data, callback);
    }  else  {
        callback(405);
    }
};

//  Container for the users submethods
handlers._users = {};

//  Users - Post
//     Required:  firstName, lastName, phone, password, tosAgreement
//     Optional data: none
handlers._users.POST = function(data, callback) {
    //  Check that all required fields are filled out
    var firstName = typeof(data.payload.firstName) == 'string' && data.payload.firstName.trim().length > 0 ? data.payload.firstName.trim() : false;
    var lastName = typeof(data.payload.lastName) == 'string' && data.payload.lastName.trim().length > 0 ? data.payload.lastName.trim() : false;
    var phone = typeof(data.payload.phone) == 'string' && data.payload.phone.trim().length == 10 ? data.payload.phone.trim() : false;
    var password = typeof(data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;
    var tosAgreement = typeof(data.payload.tosAgreement) == 'boolean' && data.payload.tosAgreement == true ? true : false;

    if(firstName && lastName && phone && password && tosAgreement) {
        // Make sure that the user does not already exist
        _data.read('users', phone, function(err, data) {
            if (err)  {
                //  hash the password
                var hashedPassword = helpers.hash(password);

                //  Create the user object
                if (hashedPassword) {
                    var userObject = {
                        'firstName' : firstName,
                        'lastName' : lastName,
                        'phone' : phone,
                        'hashedPassword' : hashedPassword,
                        'tosAgreement' : true,
                    }

                    //  Store the user
                    _data.create('users', phone, userObject, function(err)  {
                        if (!err) {
                            callback(200);
                        }  else  {
                            callback(500, {'Error' : 'Could not create the new user.'})
                        }
                    });
                }  else  {
                    callback(500, {'Error' : 'Failed to hash the password.'})
                }
            }  else  {
                callback(400, {'Error' : 'A user with that phone number already exist.'})
            }
        })
    }  else  {
        callback(400, {'Error' : 'Missing required fields.'})
    }
};

//  Users - get
//     Required:  phone
//     Optional data: none
handlers._users.GET = function(data, callback) {
    //  Check that the phone number provided is valid
    var phone = typeof(data.queryStringObject.phone) == 'string' && data.queryStringObject.phone.trim().length == 10 ? data.queryStringObject.phone.trim() : false;
    if (phone)  {
        //  Get the token from the headers
        var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
        handlers._tokens.verifyToken(token, phone, function(tokenIsValid) { 
            if (tokenIsValid) {
                _data.read('users', phone, function(err, data)  {
                    if (!err && data) {
                        //  Remove the hashed password from user object before returning
                        delete data.hashedPassword;
                        callback(200, data);
                    }  else  {
                        callback(404);
                    }
                });        
            }  else  {
                callback(403, {'Error' : 'Missing required token in header, or token is invalid.'})
            }
        });
    }  else  {
        callback(400, {'Error' : 'Missing required field.'});
    }
};

//  Users - put
//     Required:  phone
//     Optional data: firstName, lastName, password (At least one field required)
handlers._users.PUT = function(data, callback) {
    //  Check that all required fields are filled out
    var phone = typeof(data.payload.phone) == 'string' && data.payload.phone.trim().length == 10 ? data.payload.phone.trim() : false;
    console.log("users.PUT   phone = "+phone);

    //  Check for the optional fields
    var firstName = typeof(data.payload.firstName) == 'string' && data.payload.firstName.trim().length > 0 ? data.payload.firstName.trim() : false;
    var lastName = typeof(data.payload.lastName) == 'string' && data.payload.lastName.trim().length > 0 ? data.payload.lastName.trim() : false;
    var password = typeof(data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;

    //  Error if the phone is invalid
    if (phone)  {
        //  Get the token from the headers
        var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
        handlers._tokens.verifyToken(token, phone, function(tokenIsValid) { 
            if (tokenIsValid) {
                //  Error if nothing is sent to update
                if (firstName || lastName || password) {
                    //  Lookup the user
                    _data.read('users', phone, function(err, userData)  {
                        if (!err && userData) {
                            //  Update the fields necessary
                            if (firstName) {
                                userData.firstName = firstName;
                            }
                            if (lastName) {
                                userData.lastName = lastName;
                            }
                            if (password) {
                                //  hash the password
                                var hashedPassword = helpers.hash(password);
                                userData.hashedPassword = hashedPassword;
                            }
                            //  Store the new updates
                            _data.update('users', phone, userData, function(err) {
                                if (!err)  {
                                    callback(200);
                                }  else  {
                                    console.log(err);
                                    callback(500, {'Error' : 'Could not update the user.'});
                                }
                            });
                        }  else  {
                            callback(400, {'Error' : 'Specified user does not exists.'});
                        }
                    });    
                }  else  {
                    callback(400, {'Error' : 'Missing fields to update.'});
                }
            }  else {
                callback(403, {'Error' : 'Missing required token in header, or token is invalid.'})
            }
        });
    }  else  {
        callback(400, {'Error' : 'Missing required field.'});
    }

};

//  Users - delete
//     Required:  phone
//     Optional data: none
handlers._users.DELETE = function(data, callback) {
    //  Check that the phone number provided is valid
    var phone = typeof(data.queryStringObject.phone) == 'string' && data.queryStringObject.phone.trim().length == 10 ? data.queryStringObject.phone.trim() : false;
    if (phone)  {
        //  Get the token from the headers
        var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
        handlers._tokens.verifyToken(token, phone, function(tokenIsValid) { 
            if (tokenIsValid) { 
                _data.read('users', phone, function(err, userData)  {
                    if (!err && data) {
                        var userChecks = typeof(userData.checks) == 'object' && userData.checks instanceof Array ? userData.checks : [];

                        //  Remove the user
                        _data.delete('users', phone, function(err)  {
                            if (!err) {
                                //  Delete each of checks associated with the user
                                var checksToDelete = userChecks.length;
                                if (checksToDelete > 0) {
                                    var checksDeleted = 0;
                                    var deletionErrors = false;
                                    //  Loop through the checks 
                                    userChecks.forEach(function(checkId) {
                                        //  Delete the check
                                        _data.delete('checks', checkId, function(err) {
                                            if(err) {
                                                deletionErrors = true;
                                            }
                                            checksDeleted++;
                                            if (checksDeleted == checksToDelete) {
                                                if (!deletionErrors) {
                                                    callback(200);
                                                }  else  {
                                                    callback(500, {"Error" : "Errors encouintered when deleting the users checks, not all the checks may have been deleted."})
                                                }
                                            }
                                        });
                                    });
                                }  else  {
                                    callback(200);
                                }
                            }  else  {
                                console.log("_users.DELETE ERR", err);
                                callback(500, {'Error' : 'User just refused to delete.'});
                            }
                        });
                    }  else  {
                        callback(400, {'Error' : 'Could not find the user.'});
                    }
                });
            }   else  {
                callback(403, {'Error' : 'Missing required token in header, or token is invalid.'})
            }
        });
    }  else  {
        callback(400, {'Error' : 'Missing required field.'});
    }
};

//  Tokens
handlers.tokens = function(data, callback) {
    var acceptableMethods = ['POST', 'GET', 'PUT', 'DELETE'];
    if (acceptableMethods.indexOf(data.method) > -1)  {
        handlers._tokens[data.method](data, callback);
    }  else  {
        callback(405);
    }
};

//  Container for all the token methods
handlers._tokens = {};

//  Tokens - post
//     Required Data:  phone, password
//     Optional Data: none
handlers._tokens.POST = function(data, callback) {
    var phone = typeof(data.payload.phone) == 'string' && data.payload.phone.trim().length == 10 ? data.payload.phone.trim() : false;
    var password = typeof(data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;
    console.log("tokens POST  phone="+phone+" password="+password);
    if (phone && password) {
        //  Lookup the user who matches that phone number
        _data.read('users', phone, function(err, userData) {
            if (!err && userData)  {
                //  Hash the sent password and compare to the current password
                var hashedPassword = helpers.hash(password);
                if (hashedPassword == userData.hashedPassword) {
                    //  iF valid, create a new token witha random name. Set expiration date 1 hour in future
                    var tokenId = helpers.createRandomString(20);

                    var expires = Date.now() + (1000 * 60 * 60);
                    var tokenObject = {
                        'phone' : phone,
                        'id' : tokenId,
                        'expires' : expires
                    }

                    //  Store the token
                    _data.create('tokens', tokenId, tokenObject, function(err) {
                        if (!err) {
                            callback(200, tokenObject);
                        }  else  {
                            callback(500, {'Error' : 'Could create the token.'})
                        }
                    });
                }  else  {
                    callback(400, {'Error' : 'Password didi not match the specified user\'s stored password.'});
                }
            }  else  {
                callback(400, {'Error' : 'Could not find the specified user.'});
            }
        });
    }  else  {
        callback(400, {'Error' : 'Missing required fields.'});
    }
};

//  Tokens - get
//     Required Data:  id
//     Optional Data: none
handlers._tokens.GET = function(data, callback) {
    //  Check that the id provided is valid
    var id = typeof(data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
    if (id)  {
        _data.read('tokens', id, function(err, tokenData)  {
            if (!err && tokenData) {
                callback(200, tokenData);
            }  else  {
                callback(404);
            }
        });
    }  else  {
        callback(400, {'Error' : 'Missing required field.'});
    }};

//  Tokens - put
//     Required Data:  id, extend
//     Optional Data: none
handlers._tokens.PUT = function(data, callback) {
    var id = typeof(data.payload.id) == 'string' && data.payload.id.trim().length == 20 ? data.payload.id.trim() : false;
    var extend = typeof(data.payload.extend) == 'boolean' && data.payload.extend == true ? true : false;
    if (id && extend) {
        //  Lookup the token
        _data.read('tokens', id, function(err, tokenData)  {
            if (!err && tokenData) {
                //  Check to make sure that the token has not expired
                if (tokenData.expires > Date.now()) {
                    //  Set the expiration to an hour from now
                    tokenData.expires = Date.now() + (1000 * 60 * 60);
                    //  Store the new updates
                    _data.update('tokens', id, tokenData, function(err) {
                        if (!err)  {
                            callback(200);
                        }  else  {
                            console.log(err);
                            callback(500, {'Error' : 'Could not update the token\'s expiration.'});
                        }
                    });                    
                }  else  {
                    callback(400, {'Error' : 'The token has already expired and cannot be extended.'});
                }
            }  else {
                callback(400, {'Error' : 'Could not find the specified token.'});
            }
        });
    }  else  {
        callback(400, {'Error' : 'Missing required fields or fields are invalid.'});
    }
};

//  Tokens - delete
//     Required:  id
//     Optional data: none
handlers._tokens.DELETE = function(data, callback) {
    //  Check that the id provided is valid
    var id = typeof(data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
    if (id)  {
        _data.read('tokens', id, function(err, tokenData)  {
            if (!err && tokenData) {
                //  Remove the token
                _data.delete('tokens', id, function(err)  {
                    if (!err) {
                        callback(200);
                    }  else  {
                        console.log("_tokens.DELETE ERR", err);
                        callback(500, {'Error' : 'Token just refused to delete.'});
                    }
                });
            }  else  {
                callback(400, {'Error' : 'Could not find the token.'});
            }
        });
    }  else  {
        callback(400, {'Error' : 'Missing required field.'});
    }
};

//  Verify if a given token id is currently valid for a given user
handlers._tokens.verifyToken = function(id, phone, callback) {
    //  Lookup the token
    _data.read('tokens', id, function(err, tokenData){
        if (!err && tokenData)  {
            //Chekc the token is for the given user and has not expired
            if (tokenData.phone == phone && tokenData.expires > Date.now()) {
                callback(true);
            }  else  {
                callback(false);
            }
        }  else  {
            callback(false)
        }
    });
}

//  Checks
handlers.checks = function(data, callback) {
    var acceptableMethods = ['POST', 'GET', 'PUT', 'DELETE'];
    if (acceptableMethods.indexOf(data.method) > -1)  {
        handlers._checks[data.method](data, callback);
    }  else  {
        callback(405);
    }
};

//  Container for all the token methods
handlers._checks = {};

//  Checks - post
//     Required data:  protocol, url, method, successCodes, timeoutSeconds
//     Optional data: none
handlers._checks.POST = function(data, callback) {
    //  Validate inputs
    var protocol = typeof(data.payload.protocol) == 'string' && ['https', 'http'].indexOf(data.payload.protocol) > -1 ? data.payload.protocol : false;
    var url = typeof(data.payload.url) == 'string' && data.payload.url.trim().length > 0 ? data.payload.url.trim() : false;
    var method = typeof(data.payload.method) == 'string' && ['POST', 'GET', 'PUT', 'DELETE', 'post', 'get', 'put', 'delete'].indexOf(data.payload.method) > -1 ? data.payload.method : false;
    var successCodes = typeof(data.payload.successCodes) == 'object' && data.payload.successCodes instanceof Array && data.payload.successCodes.length > 0 ? data.payload.successCodes : false;
    var timeoutSeconds = typeof(data.payload.timeoutSeconds) == 'number' && data.payload.timeoutSeconds % 1 === 0 && data.payload.timeoutSeconds >= 1 && data.payload.timeoutSeconds <= 5 ? data.payload.timeoutSeconds : false;

    if (protocol && url && method && successCodes && timeoutSeconds)  {
        // Get the token from the headers
        var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

        //  Lookup user by reading the token
        _data.read('tokens', token, function(err, tokenData) {
            if (!err && tokenData) {
                var userPhone = tokenData.phone;

                //  Lookup the user data
                _data.read('users', userPhone, function(err, userData) {
                    if (!err && userData) {
                        var userChecks = typeof(userData.checks) == 'object' && userData.checks instanceof Array ? userData.checks : [];
                        //  Verify that the user has less that the max number of checks allowed
                        if (userChecks.length < config.maxChecks) {
                            var checkId = helpers.createRandomString(20);

                            //  Create the check object and include users phone
                            var checkObject = {
                                'id' : checkId,
                                'userPhone' : userPhone,
                                'protocol' : protocol,
                                'url' : url,
                                'method' : method.toUpperCase(),
                                'successCodes' : successCodes,
                                'timeoutSeconds' : timeoutSeconds
                            }

                            // Save the object
                            _data.create('checks', checkId, checkObject, function(err) {
                                if (!err) {
                                    userData.checks = userChecks;
                                    userData.checks.push(checkId);

                                    //  Save the new user data
                                    _data.update('users', userPhone, userData, function(err) {
                                        if (!err) {
                                            //  Return the data about the new check 
                                            callback(200, checkObject);
                                        }  else  {
                                            callback(500, {'Error' : 'Could not update the user with the new check.'})                                            
                                        }
                                    });
                                }  else  {
                                    callback(500, {'Error' : 'Could not create the new check.'})
                                }
                            })
                        }  else  {
                            callback(400, {'Error' : 'User already has the maximum number of chaecks ('+ config.maxChecks +').'})
                        }
                    }  else  {
                        callback(403);
                    }
                });
            }  else  {
                callback(403, {'Error' : 'Missing required token in header, or token is invalid.'})
            }
        });
    }  else  {
        callback(400, {'Error' : 'Missing required inputs, or inputs are invalid'});
    }
};

//  Checks - get
//     Required:  id
//     Optional data: none
handlers._checks.GET = function(data, callback) {
    //  Check that the id provided is valid
    var id = typeof(data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
    if (id)  {
        // Lookup the check
        console.log("checks GET  id=<"+id+">");
        _data.read('checks', id, function(err, checkData) {
            if (!err && checkData) {
                //  Get the token from the headers
                var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
                //Verify that the given token is valid and belongs to user who created check
                handlers._tokens.verifyToken(token, checkData.userPhone, function(tokenIsValid) { 
                    if (tokenIsValid) {
                        callback(200, checkData)
                    }  else  {
                        callback(403, {'Error' : 'Missing required token in header, or token is invalid.'})
                    }
                });
            }  else  {
                callback(404);
            }
        });
    }  else  {
        callback(400, {'Error' : 'Missing required field.'});
    }
};

//  Checks - put
//     Required:       id
//     Optional data:  protocol, url, method, successCodes, timeoutSeconds (one must be sent)
handlers._checks.PUT = function(data, callback) {
    //  Check that all required fields are filled out
    var id = typeof(data.payload.id) == 'string' && data.payload.id.trim().length == 20 ? data.payload.id.trim() : false;
    console.log("checks.PUT   id = "+id);

    //  Check for the optional fields
    var protocol = typeof(data.payload.protocol) == 'string' && ['https', 'http'].indexOf(data.payload.protocol) > -1 ? data.payload.protocol : false;
    var url = typeof(data.payload.url) == 'string' && data.payload.url.trim().length > 0 ? data.payload.url.trim() : false;
    var method = typeof(data.payload.method) == 'string' && ['POST', 'GET', 'PUT', 'DELETE', 'post', 'get', 'put', 'delete'].indexOf(data.payload.method) > -1 ? data.payload.method : false;
    var successCodes = typeof(data.payload.successCodes) == 'object' && data.payload.successCodes instanceof Array && data.payload.successCodes.length > 0 ? data.payload.successCodes : false;
    var timeoutSeconds = typeof(data.payload.timeoutSeconds) == 'number' && data.payload.timeoutSeconds % 1 === 0 && data.payload.timeoutSeconds >= 1 && data.payload.timeoutSeconds <= 5 ? data.payload.timeoutSeconds : false;

    //  Error if the phone is invalid
    if (id)  {
        if (protocol || url || method || successCodes || timeoutSeconds) {
            _data.read('checks', id, function(err, checkData) {
                if (!err && checkData) {
                    var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
                    handlers._tokens.verifyToken(token, checkData.userPhone, function(tokenIsValid) { 
                        if (tokenIsValid) {
                            if (protocol) {
                                checkData.protocol = protocol;
                            }
                            if (url) {
                                checkData.url = url;
                            }
                            if (method) {
                                checkData.method = method.toUpperCase();
                            }
                            if (successCodes) {
                                checkData.successCodes = successCodes;
                            }
                            if (timeoutSeconds) {
                                checkData.timeoutSeconds = timeoutSeconds;
                            }
                            _data.update('checks', id, checkData, function(err) {
                                if (!err)  {
                                    callback(200);
                                }  else  {
                                    console.log(err);
                                    callback(500, {'Error' : 'Could not update the check.'});
                                }
                            });
                        }  else {
                            callback(403, {'Error' : 'Missing required token in header, or token is invalid.'})
                        }
                    });
                }  else  {
                    callback(400, {'Error' : 'Check ID does not exists.'});
                }
            });
        }   else  {
            callback(400, {'Error' : 'Missing fields to update.'});
        }
    }  else  {
        callback(400, {'Error' : 'Missing required field.'});
    }

};

//  Checks - delete
//     Required:  id
//     Optional data: none
handlers._checks.DELETE = function(data, callback) {
    //  Check that the phone number provided is valid
    var id = typeof(data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
    if (id)  {
        //  Lookup the check 
        _data.read('checks', id, function(err, checkData) {
            if (!err && checkData) {
                //  Get the token from the headers
                var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
                handlers._tokens.verifyToken(token, checkData.userPhone, function(tokenIsValid) { 
                    if (tokenIsValid) { 
                        
                        //  Delete the check data
                        _data.delete('checks', id, function(err) {
                            if (!err) {
                                _data.read('users', checkData.userPhone, function(err, userData)  {
                                    if (!err && userData) {
                                        var userChecks = typeof(userData.checks) == 'object' && userData.checks instanceof Array ? userData.checks : [];
                                        //  Remove the delete check from thier list of checks
                                        var checkPosition = userChecks.indexOf(id);
                                        if (checkPosition > -1) {
                                            userChecks.splice(checkPosition, 1);
                                            //  Re-save the user's data
                                            _data.update("users", checkData.userPhone, userData, function(err) {
                                                if (!err) {
                                                    callback(200);
                                                }  else  {
                                                    callback(500, {'Error' : "Could not update users object after process, so did not remove from the user record."})
                                                }
                                            });
                                        }  else  {
                                            callback(500, {'Error' : "Could not find the check on the users object, so did not remove from the user record."})
                                        }
                                    }  else  {
                                        callback(400, {'Error' : 'Could not find the user who created the check so the check might still be on the user record.'});
                                    }
                                });
                            }  else  {
                                console.log("_checks.DELETE ERR", err);
                                callback(500, {'Error' : 'Check just refused to delete.'});
                            }
                        });
                    }
                });
            }   else  {
                callback(403, {'Error' : 'Missing required token in header, or token is invalid.'})
            }
        });
    }  else  {
        callback(400, {'Error' : 'The specified check ID does not exist.'});
    }
};

//  Ping handler
handlers.ping = function(data, callback) {
    callback(200);
};

//  Not Found handler
handlers.notFound = function(data, callback) {
    callback(404);
};


//  Export the module
module.exports = handlers;



/*

{
   "firstName":"John",
   "lastName":"Smith",
   "phone":"5551234567",
   "password":"thisIsAPassword",
   "tosAgreement":true
}

*/