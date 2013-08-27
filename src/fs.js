/**
 * Copyright (c) 2013 Adam Ranfelt
 *
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE
 * OR OTHER DEALINGS IN THE SOFTWARE.
 */
'use strict';

var fs = require('graceful-fs');
var path = require('path');
var q = require('q');

var fsExtended = {
    copyFile: function(src, dest, callback) {
        fs.readFile(src, function(error, data) {
            if (error) {
                callback(error);
                return;
            }

            if (data === null) {
                callback('Content does not exist at ' + src)
            }

            fs.writeFile(dest, data, callback);
        });
    },

    copyFileSync: function(src, dest) {

        var readContent = fs.readFileSync(src);
        
        if (readContent === null) {
            return 'Content does not exist at ' + src;
        }

        fs.writeFileSync(dest, readContent);
    },

    rmDir: function(dir, callback) {
        fs.exists(dir, function(exists) {
            if (!exists) {
                callback(dir + ' does not exist');
                return;
            }

            fs.readdir(dir, function(error, files) {
                if (error) {
                    callback(error);
                    return;
                }

                var i = 0;
                var length = files.length;
                var counter = 1;
                for (; i < length; i++) {
                    (function(dir, file) {
                        var filepath = path.join(dir, file);

                        fs.stat(filepath, function(error, stats) {
                            if (error) {
                                callback(error);
                                return;
                            }

                            counter++;
                            if (stats.isDirectory()) {
                                fsExtended.rmDir(filepath, onRemoveComplete);
                            } else {
                                fs.unlink(filepath, onRemoveComplete);
                            }
                        });
                    }(dir, files[i]));
                }

                function onRemoveComplete(error) {
                    if (error) {
                        callback(error, false);
                        return;
                    }

                    counter--;
                    if (counter === 1) {
                        fs.rmdir(dir, onRemoveComplete);
                    }

                    if (counter === 0) {
                        callback(null, true);
                    }
                }
            });
        });
    },

    rmDirSync: function(dir) {
        if (!fs.existsSync(dir)) {
            throw new TypeError(dir + ' does not exist');
        }

        var files = fs.readdirSync(dir);

        var i = 0;
        var length = files.length;
        var stats;
        var filepath;
        var error = null;
        for (; i < length; i++) {
            filepath = path.join(dir, files[i]);
            stats = fs.statSync(filepath);

            if (stats.isDirectory()) {
                error = fsExtended.rmDirSync(filepath);
            } else {
                error = fs.unlinkSync(filepath);
            }

            if (error) {
                return error;
            }
        }

        error = fs.rmdirSync(dir);
        if (error) {
            return error;
        }

        return null;
    },

    copyDir: function(src, dest, callback) {
        fs.exists(src, function(exists) {
            if (!exists) {
                callback(src + ' does not exist');
                return;
            }

            fs.exists(dest, function(exists) {
                if (exists) {
                    fs.stat(dest, function(error, stats) {
                        if (error) {
                            callback(error);
                        }

                        if (stats.isDirectory()) {
                            fsExtended.rmDir(dest, makeDestDir);
                        } else {
                            fs.unlink(dest, makeDestDir);
                        }
                    });
                } else {
                    makeDestDir(null);
                }

                function makeDestDir(error) {
                    if (error) {
                        callback(error);
                    }

                    fs.mkdir(dest, function(error) {
                        if (error) {
                            callback(error);
                        }

                        fs.readdir(src, function(error, files) {
                            if (error) {
                                callback(error);
                                return;
                            }

                            var i = 0;
                            var length = files.length;
                            var counter = 0;
                            for (; i < length; i++) {
                                (function(src, dest, file) {
                                    var srcpath = path.join(src, file);
                                    var destpath = path.join(dest, file);

                                    fs.stat(srcpath, function(error, stats) {
                                        if (error) {
                                            callback(error);
                                            return;
                                        }

                                        counter++;
                                        if (stats.isDirectory()) {
                                            fsExtended.copyDir(srcpath, destpath, onCopyComplete);
                                        } else {
                                            fsExtended.copyFile(srcpath, destpath, onCopyComplete);
                                        }
                                    });
                                }(src, dest, files[i]));
                            }

                            function onCopyComplete(error) {
                                if (error) {
                                    callback(error, false);
                                    return;
                                }

                                counter--;
                                if (counter === 0) {
                                    callback(null, true);
                                }
                            }
                        });
                    });
                }
            });
        });
    },

    // Will not work for a number of files that exceeds the maximum kernel amount
    copyDirSync: function(src, dest) {
        var error = null;
        if (!fs.existsSync(src)) {
            throw new TypeError(src + ' does not exist');
        }

        if (fs.existsSync(dest)) {
            var stats = fs.statSync(dest);
            if (stats.isDirectory()) {
                error = fsExtended.rmDirSync(dest);    
            } else {
                error = fs.unlinkSync(dest);
            }
            
            if (error) {
                return error;
            }
        }

        error = fs.mkdirSync(dest);
        if (error) {
            return error;
        }

        var files = fs.readdirSync(src);

        var i = 0;
        var length = files.length;
        var stats;
        var srcpath;
        var destpath;
        
        for (; i < length; i++) {
            srcpath = path.join(src, files[i]);
            destpath = path.join(dest, files[i]);
            stats = fs.statSync(srcpath);

            if (stats.isDirectory()) {
                error = fsExtended.copyDirSync(srcpath, destpath);
            } else {
                error = fsExtended.copyFileSync(srcpath, destpath);
            }

            if (error) {
                return error;
            }
        }
        if (error) {
            return error;
        }

        return null;
    }
};
// Generate any promise-based versions of methods within fs 
(function() {

    var funcName;
    var arraySlice = Array.prototype.slice;
    var methodExceptions = [
        'exists'
    ];

    var invalidMethods = [
        'createReadStream',
        'createWriteStream',
        'watch',
        'unwatch',
        'watchFile',
        'unwatchFile'
    ];

    for (funcName in fsExtended) {
        // _private, upperCase
        if (funcName.charAt(0) === '_'
            || funcName.charAt(0) === funcName.charAt(0).toUpperCase()
            || funcName.toLowerCase().indexOf('sync') !== -1
            || invalidMethods.indexOf(funcName) !== -1
        ) {
            continue;
        }

        fsExtended[funcName + 'Promise'] = generatePromiseFromNode(funcName, fsExtended[funcName]);
    }

    for (funcName in fs) {
        fsExtended[funcName] = fs[funcName];

        if (funcName.charAt(0) === '_'
            || funcName.charAt(0) === funcName.charAt(0).toUpperCase()
            || funcName.toLowerCase().indexOf('sync') !== -1
            || invalidMethods.indexOf(funcName) !== -1
        ) {
            continue;
        }

        fsExtended[funcName + 'Promise'] = generatePromiseFromNode(funcName, fs[funcName]);
    }

    function generatePromiseFromNode(methodName, method) {
        var isException = methodExceptions.indexOf(methodName) !== -1;

        return makePromiseFromNode(methodName, method, isException);
    }

    function makePromiseFromNode(methodName, method, isException) {
        var promiseFunction = function() {
            var defer = q.defer();

            var args = arraySlice.call(arguments, 0);
            if (isException) {
                args.push(resolveOnly);
            } else {
                args.push(resolveIfNoError);
            }

            method.apply(null, args);

            return defer.promise;

            function resolveOnly(/* arguments */) {
                defer.resolve.apply(defer, arguments);
            }

            function resolveIfNoError(error/*, arguments */) {
                if (error) {
                    defer.reject(error);
                }
                var args = arraySlice.call(arguments, 1);
                defer.resolve.apply(defer, args);
            }
        };
        promiseFunction.name = methodName + 'Promise';

        return promiseFunction;
    }

}());

module.exports = fsExtended;