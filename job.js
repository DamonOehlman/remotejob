function Job(queue, data) {
  if (! (this instanceof Job)) {
    return new Job(queue, data);
  }

  this.queue = queue;
  this.data = data || {};
  this.id = this.data.MessageId;
}

module.exports = Job;
Job.prototype.acknowledge = function(callback) {
  // ensure we have a callback
  callback = callback || function() {};

  // remove from the pending queue
  this.queue._removeJob('pending', this.data.ReceiptHandle, callback);
};
