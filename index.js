var AWS = require('aws-sdk');
var async = require('async');
var debug = require('debug')('remotejob');
var pluck = require('whisk/pluck');
var extend = require('cog/extend');
var EventEmitter = require('events').EventEmitter;
var uuid = require('uuid');
var curry = require('curry');
var Job = require('./job');
var _ = require('lodash');

var DEFAULT_SQS_Attributes = {
  ReceiveMessageWaitTimeSeconds: '20',
  VisibilityTimeout: '30'
};
var DEFAULT_STATUSES = ['pending', 'inprogress', 'completed'];
var ACCEPTABLE_S3_ERRORS = [
  'BucketAlreadyOwnedByYou'
];
var NOTMETA_KEYS = ['key', 'body'];

/**
  # remotejob

  This is a package that allows you to request the execution of remote jobs
  through the use of AWS S3 and SQS for job coordination.  It's an opinionated
  approach to getting remote work done, but also pragmatic.

  ## Getting Started

  The following code illustrates what a "job requester" would do to request a job
  is queued for remote execution.

  <<< examples/submit.js

  On the receiving end, the code would look something similar to this:

  <<< examples/process-next.js

  ## Reference

**/
module.exports = function(name, opts) {
  var bucket = ['remotejobs', name].join('-');
  var queue = new EventEmitter();
  var accessKeyId = (opts || {}).key;
  var region = (opts || {}).region || 'us-west-1';
  var ready = false;

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

  function createBucket() {
    return function(callback) {
      var opts = {
        Bucket: bucket,
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
          debug('bucket ' + bucket + ' creation failed: ', err);
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

  function defer(fn, args, scope) {
    return function() {
      fn.apply(scope, args);
    };
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
    #### `download(opts) => ReadableStream`

    Create a readable stream for the S3 object details provided.
  **/
  queue.download = function (job) {
    var opts = {
      Bucket: (job || {}).bucket || bucket,
      Key: (job || {}).key
    };

    debug('attempting to download: ', opts);
    return s3.getObject(opts).createReadStream();
  };

  /**
    #### `next(status, callback)`

    This function is used to request the next job available for the `status`
    processing queue. If the requested `status` does not relate to a known
    queue, then the callback will return an error, otherwise, it will
    fire once the next
  **/
  queue.next = curry(function _next(status, callback) {
    var opts = {
      QueueUrl: statusQueues[status],
      MaxNumberOfMessages: 1
    };

    if (! ready) {
      return queue.once('ready', defer(_next, arguments));
    }

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
    #### `remove(key, callback)`

    Remove the specified `key` from the objects datastore.
  **/
  queue.remove = curry(function _remove(key, callback) {
    var opts = {
      Bucket: bucket,
      Key: key
    };

    if (! ready) {
      return queue.once('ready', defer(_remove, arguments));
    }

    debug('attempting to remove object ' + key + ' from bucket: ' + bucket);
    s3.deleteObject(opts, callback);
  });

  /**
    #### `retrieve(key, callback)`

    Retrieve an object from with the specified `key`
  **/
  queue.retrieve = curry(function _retrieve(key, callback) {
    var opts = {
      Bucket: bucket,
      Key: key
    };

    if (! ready) {
      return queue.once('ready', defer(_retrieve, arguments));
    }

    debug('attempting to retrieve object ' + key + ' from bucket: ' + bucket);
    s3.getObject(opts, callback);
  });

  /**
    #### `store(data, callback)`

    The store function is used to store metadata and an optional `body` to
    S3 storage for the queue bucket.

    The remotejob system uses two buckets to track the inbound and outbound
    data for objects being processed by the system.

  **/
  queue.store = curry(function _store(data, callback) {
    var key = (data || {}).key || uuid.v4();
    var metadata = _.omit(data, function(value, key) {
      return NOTMETA_KEYS.indexOf(key) >= 0;
    });

    queue.storeRaw(key, metadata, (data || {}).body || '', function(err) {
      callback(err, err ? null : key);
    });
  });

  /**
    #### `storeRaw(key, metadata, body, callback)`

    A simple wrapper to the raw S3 store operation (`s3.putObject`).
  **/
  queue.storeRaw = curry(function _storeRaw(key, metadata, body, callback) {
    if (! ready) {
      return queue.once('ready', defer(_storeRaw, arguments));
    }

    debug('putting object "' + key + '" into bucket: ' + bucket);
    s3.putObject({
      Bucket: bucket,
      Key: key,
      Metadata: metadata,
      Body: body,
      ACL: 'bucket-owner-read'
    }, callback);
  });


  /**
    #### `submit(data, callback)`

    The `submit` function performs the `store` and `trigger` operations
    one after the other.

  **/
  queue.submit = curry(function _submit(data, callback) {
    if (! ready) {
      return queue.once('ready', defer(_submit, arguments));
    }

    async.waterfall([
      queue.store(data),
      queue.trigger
    ], callback);
  });

  /**
    #### `trigger(key, callback)`

    Add an entry to the queue for processing the input identified by `key`
  **/
  queue.trigger = curry(function _trigger(key, callback) {
    var opts = {
      Bucket: bucket,
      Key: key
    };

    if (! ready) {
      return queue.once('ready', defer(_trigger, arguments));
    }

    debug('attempting to get metadata for object ' + key + ' from bucket: ' + bucket);
    s3.headObject(opts, function(err, data) {
      if (err) {
        return callback(err);
      }

      // write data to the pending queue
      queueWrite('pending', extend({}, data.Metadata, { bucket: bucket, key: key }), callback);
    });
  });

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

  async.parallel([ createQueues, createBucket() ], function(err) {
    if (err) {
      debug('received error initializing: ', err);
      return queue.emit('error', err);
    }

    ready = true;
    queue.emit('ready');
  });

  return queue;
};
