var async = require('async');

/**
  ### `Job` prototype

  A `Job` is a helper layer for working with the underlying queue. The exposed
  methods are provided as a convenience, and do generally make working with
  the queue a little more terse than it would be otherwise.

**/
function Job(queue, data) {
  var body;
  var job = this;

  if (! (this instanceof Job)) {
    return new Job(queue, data);
  }

  this.queue = queue;
  this.data = data || {};
  this.id = this.data.MessageId;

  // get the body from the data and JSON parse it
  try {
    body = JSON.parse(this.data.Body);
  }
  catch (e) {
    body = {};
  }

  // copy data from the body to the job
  Object.keys(body).forEach(function(key) {
    job[key] = body[key];
  });

}

module.exports = Job;
var proto = Job.prototype;

/**
  #### `Job#acknowledge(callback)`

  Remove the job from the `pending` queue.
**/
proto.acknowledge = function(callback) {
  // ensure we have a callback
  callback = callback || function() {};

  // remove from the pending queue
  this.queue._removeJob('pending', this.data.ReceiptHandle, callback);
};

/**
  #### `Job#createReadStream(name?)` => `ReadableStream`

  Initiate a download of the resource associated with the job. If
  `name` is not specified this will be the input file associated with
  the job request.
**/
proto.createReadStream = function() {
  return this.queue.download(this);
};


/**
  #### `Job#complete(err, assets, callback)`

  When the job processing has been completed, the `complete` method is
  used to pass back the job status and any assets that have been created
  during the procesing.

  In the event that an error has occurred during processing, then an
  `Error` should be passed back through the `err` argument and the job
  status will be updated to reflect this.
**/
proto.complete = function(err, assets, callback) {
  function finalizeJob(assetSaveErr) {
    // TODO: update job status

    callback(assetSaveErr);
  }

  // check for callback in the assets location
  if (typeof assets == 'function') {
    callback = assets;
    assets = [];
  }

  // process any assets
  async.forEach(
    [].concat(assets || []),
    this.queue._storeAsset(this),
    finalizeJob
  );
};
