var AWS = require('aws-sdk');
var async = require('async');
var debug = require('debug')('remotejob');
var pluck = require('whisk/pluck');
var extend = require('cog/extend');
var EventEmitter = require('events').EventEmitter;

var DEFAULT_Attributes = {};

/**
  # remotejob


**/
module.exports = function(name, opts) {
  var queue = new EventEmitter();
  var queueUrl;
  var accessKeyId = (opts || {}).key;
  var sqs = new AWS.SQS({
    apiVersion: '2012-11-05',
    accessKeyId: accessKeyId,
    secretAccessKey: (opts || {}).secret,
    region: (opts || {}).region || 'us-east-1'
  });

  function createQueue() {
    var opts = {
      QueueName: name,
      Attributes: extend({}, DEFAULT_Attributes, (opts || {}).attributes)
    };

    debug('attempting queue creation: ', opts);
    sqs.createQueue(opts, function(err, data) {
      queueUrl = err || (data && data.QueueUrl);
      queue.emit('ready', queueUrl);
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

  // initialise the queueUrl, creating the queue if required
  getQueueUrl(function(err) {
    if (err) {
      createQueue();
    }
  });

  return queue;
};
