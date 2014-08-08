var AWS = require('aws-sdk');
var async = require('async');
var debug = require('debug')('remotejob');
var pluck = require('whisk/pluck');
var extend = require('cog/extend');
var EventEmitter = require('events').EventEmitter;

var DEFAULT_Attributes = {};
var ACCEPTABLE_S3_ERRORS = [
  'BucketAlreadyOwnedByYou'
];

/**
  # remotejob


**/
module.exports = function(name, opts) {
  var queue = new EventEmitter();
  var queueUrl;
  var accessKeyId = (opts || {}).key;
  var region = (opts || {}).region || 'us-west-1';

  var s3 = new AWS.S3({
    apiVersion: '2006-03-01',
    accessKeyId: accessKeyId,
    secretAccessKey: (opts || {}).secret
  });

  var sqs = new AWS.SQS({
    apiVersion: '2012-11-05',
    accessKeyId: accessKeyId,
    secretAccessKey: (opts || {}).secret,
    region: region
  });

  function createBucket(subcat) {
    var bucketName = 'remotejobs-' + (subcat || '') + '-' + name;

    return function(callback) {
      var opts = {
        Bucket: bucketName,
//         CreateBucketConfiguration: {
//           LocationConstraint: ['EU', region, ''].join(' | ')
//         },
        ACL: 'private'
      }

      debug('attempting to create bucket: ', opts);
      s3.createBucket(opts, function(err, data) {
        // ignore particular errors
        if (err && ACCEPTABLE_S3_ERRORS.indexOf(err.code) >= 0) {
          err = null;
        }

        if (err) {
          debug('bucket ' + bucketName + ' creation failed: ', err);
        }

        callback(err, data);
      });
    };
  }

  function createQueue(callback) {
    var opts = {
      QueueName: name,
      Attributes: extend({}, DEFAULT_Attributes, (opts || {}).attributes)
    };

    debug('attempting queue creation: ', opts);
    sqs.createQueue(opts, function(err, data) {
      queueUrl = err || (data && data.QueueUrl);
      callback(err);
    });
  }

  function getQueueAttributes(url, callback) {
    var opts = {
      QueueUrl: url,
      AttributeNames: ['All']
    };

    debug('attempting to get queue attributes: ', opts);
    sqs.getQueueAttributes(opts, callback);
  }

  function getQueueUrl(callback) {
    var opts = {
      QueueName: name
    };

    debug('attempting to get queue url for: ' + name);
    sqs.getQueueUrl(opts, function(err, response) {
      if (err) {
        return callback(err);
      }

      queue.emit('ready', queueUrl = response.QueueUrl);
      callback(null, queueUrl)
    });
  }

  /**
    #### `status(callback)`

  **/
  queue.status = function(callback) {
    if (! queueUrl) {
      return queue.once('ready', function() {
        queue.status(callback);
      });
    }

    if (queueUrl instanceof Error) {
      return callback(queueUrl);
    }

    getQueueAttributes(queueUrl, callback);
  };

  async.parallel([ createQueue, createBucket('in'), createBucket('out') ], function(err) {
    if (err) {
      return queue.emit('error', err);
    }

    queue.emit('ready');
  });

  return queue;
};
