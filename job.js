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
Job.prototype.acknowledge = function(callback) {
  // ensure we have a callback
  callback = callback || function() {};

  // remove from the pending queue
  this.queue._removeJob('pending', this.data.ReceiptHandle, callback);
};

Job.prototype.createReadStream = function() {
  return this.queue.download(this);
};
