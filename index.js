var AWS = require('aws-sdk');
var debug = require('debug')('remotejob');

/**
  # remotejob


**/
module.exports = function(name, opts) {
  var queue = {};
  var sqs = new AWS.SQS({
    apiVersion: '2012-11-05',
    accessKeyId: (opts || {}).key,
    secretAccessKey: (opts || {}).secret,
    region: (opts || {}).region || 'us-east-1',
    logger: {
      log: function() {
        console.log(arguments);
      }
    }
  });

  /**
    #### `status(callback)`

  **/
  queue.status = function(callback) {
    debug('attempting to get queue attributes for: ' + name);
    sqs.getQueueAttributes({ QueueUrl: name }, callback);
  };

  return queue;
};
