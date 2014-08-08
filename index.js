var AWS = require('aws-sdk');
var async = require('async');
var debug = require('debug')('remotejob');
var pluck = require('whisk/pluck');
var extend = require('cog/extend');
var EventEmitter = require('events').EventEmitter;
var uuid = require('uuid');
var curry = require('curry');

var DEFAULT_Attributes = {};
var ACCEPTABLE_S3_ERRORS = [
  'BucketAlreadyOwnedByYou'
];

/**
  # remotejob

  This is a package that allows you to request the execution of remote jobs
  through the use of AWS S3 and SQS for job coordination.  It's an opinionated
  approach to getting remote work done, but also pragmatic.

  ## How it Works

  To be completed.

  ## Reference

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

  /**
    #### `retrieve(direction, key, callback)`

    Retrieve an object from either the input or the output queue (as
    specified byt the `direction` argument).
  **/
  queue.retrieve = curry(function(direction, key, callback) {
    var bucket = ['remotejobs', direction, name].join('-');
    var opts = {
      Bucket: bucket,
      Key: key
    };

    debug('attempting to retrieve object ' + key + ' from bucket: ' + bucket);
    s3.getObject(opts, callback);
  });

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

  /**
    #### `store(direction, data, callback)`

  **/
  queue.store = curry(function(direction, data, callback) {
    var key = (data || {}).key || uuid.v4();
    var bucket = ['remotejobs', direction, name].join('-');
    var opts = {
      Bucket: bucket,
      Key: key,
      Body: (data || {}).body || '',
      Metadata: (data || {}).metadata || {},
      ACL: 'bucket-owner-read'
    };

    debug('putting object "' + key + '" into bucket: ' + bucket);
    s3.putObject(opts, function(err, response) {
      callback(err, err ? null : key);
    });
  });

  /**
    #### `submit(data, callback)`

    The `submit` function performs the `store` and `schedule` operations
    one after the other.

  **/
  queue.submit = function(data, callback) {
  };

  async.parallel([ createQueue, createBucket('in'), createBucket('out') ], function(err) {
    if (err) {
      return queue.emit('error', err);
    }

    queue.emit('ready');
  });

  return queue;
};
