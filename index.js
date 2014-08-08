var AWS = require('aws-sdk');
var async = require('async');
var debug = require('debug')('remotejob');
var pluck = require('whisk/pluck');
var extend = require('cog/extend');
var EventEmitter = require('events').EventEmitter;
var uuid = require('uuid');
var curry = require('curry');
var Job = require('./job');

var DEFAULT_SQS_Attributes = {
  ReceiveMessageWaitTimeSeconds: '20',
  VisibilityTimeout: '30'
};
var DEFAULT_STATUSES = ['pending', 'inprogress', 'completed'];
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
  var accessKeyId = (opts || {}).key;
  var region = (opts || {}).region || 'us-west-1';

  // initialise the status queues
  var statusQueues = {
    pending: null,
    inprogress: null,
    completed: null
  };

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

  function createQueues(callback) {
    var childQueues = Object.keys(statusQueues);

    async.map(childQueues, createSubQueue, function(err, urls) {
      if (err) {
        return callback(err);
      }

      childQueues.forEach(function(childKey, index) {
        statusQueues[childKey] = urls[index];
      });

      callback();
    });
  }

  function createSubQueue(childKey, callback) {
    var opts = {
      QueueName: name + '-' + childKey,
      Attributes: extend({}, DEFAULT_SQS_Attributes, (opts || {}).attributes)
    };

    debug('attempting queue creation: ', opts);
    sqs.createQueue(opts, function(err, data) {
      callback(err, err || (data && data.QueueUrl));
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

  function queueWrite(status, data, callback) {
    var opts = {
      QueueUrl: statusQueues[status],
      MessageBody: JSON.stringify(data),
    };

    if (! opts.QueueUrl) {
      return callback(new Error('no status queue for status: ' + status));
    }

    debug('writing job to the ' + status + ' queue');
    sqs.sendMessage(opts, function(err, response) {
      if (err) {
        return callback(err);
      }

      callback(null, response && response.MessageId);
    });
  }

  /**
    #### `next(status, callback)`

    This function is used to request the next job available for the `status`
    processing queue. If the requested `status` does not relate to a known
    queue, then the callback will return an error, otherwise, it will
    fire once the next
  **/
  queue.next = curry(function(status, callback) {
    var opts = {
      QueueUrl: statusQueues[status],
      MaxNumberOfMessages: 1
    };

    if (! opts.QueueUrl) {
      return callback(new Error('no status queue for status: ' + status));
    }

    debug('requesting next message from the ' + status + ' queue');
    sqs.receiveMessage(opts, function(err, data) {
      var messages = (data && data.Messages) || [];
      var job;

      if (err) {
        return callback(err);
      }

      // if we have no messages, then continue waiting
      if (messages.length === 0) {
        return queue.next(status, callback);
      }

      // create the new job instance
      callback(null, new Job(queue, messages[0]));
    });
  });

  /**
    #### `remove(direction, key, callback)`

    Remove the specified `key` from the `direction` objects datastore.
  **/
  queue.remove = curry(function(direction, key, callback) {
    var bucket = ['remotejobs', direction, name].join('-');
    var opts = {
      Bucket: bucket,
      Key: key
    };

    debug('attempting to remove object ' + key + ' from bucket: ' + bucket);
    s3.deleteObject(opts, callback);
  });

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

    The `submit` function performs the `store` and `trigger` operations
    one after the other.

  **/
  queue.submit = function(data, callback) {
  };

  /**
    #### `trigger(key, callback)`

    Add an entry to the queue for processing the input identified by `key`
  **/
  queue.trigger = function(key, callback) {
    var bucket = ['remotejobs', 'in', name].join('-');
    var opts = {
      Bucket: bucket,
      Key: key
    };

    debug('attempting to get metadata for object ' + key + ' from bucket: ' + bucket);
    s3.headObject(opts, function(err, data) {
      if (err) {
        return callback(err);
      }

      // write data to the pending queue
      queueWrite('pending', extend({}, data.Metadata, { bucket: bucket, key: key }), callback);
    });
  };

  /**
    ### "Hidden" functions

    The following functions are available for use, but in general aren't that
    useful when working with the `remotejob` queue.
  **/

  /**
    #### `_removeJob(status, receiptHandle, callback)`

    This function is used to remove jobs from the specified `status` queue.
    As required but AWS SQS, this function accepts a `receiptHandle` for a
    message and passed that through to remove the message from the queue.

  **/
  queue._removeJob = curry(function(status, handle, callback) {
    var queueUrl = statusQueues[status];
    if (! queueUrl) {
      return callback(new Error('no queue for status: ' + status));
    }

    debug('attempting to remove message from ' + status + ' queue');
    sqs.deleteMessage({
      QueueUrl: queueUrl,
      ReceiptHandle: handle
    }, callback);
  });

  async.parallel([ createQueues, createBucket('in'), createBucket('out') ], function(err) {
    if (err) {
      debug('received error initializing: ', err);
      return queue.emit('error', err);
    }

    queue.emit('ready');
  });

  return queue;
};
