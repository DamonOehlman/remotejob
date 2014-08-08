var fs = require('fs');
var test = require('tape');
var uuid = require('uuid');
var lastJobNo;
var lastJob;

module.exports = function(queue) {
  test('able to submit an entry to the queue', function(t) {
    var data = {
      body: fs.createReadStream(__dirname + '/assets/image-small.zip'),
      metadata: {
        name: 'image-small'
      }
    };

    t.plan(2);
    queue.submit(data, function(err, jobno) {
      t.ifError(err);
      t.ok(lastJobNo = jobno, 'got job no');
    });
  });

  test('get the next item from the pending queue', function(t) {
    t.plan(4);
    queue.next('pending', function(err, job) {
      t.ifError(err);
      t.ok(lastJob = job, 'got job');
      t.equal(job.id, lastJobNo, 'matched expected job');

      // acknowledge the job (which removes it from the queue)
      job.acknowledge(t.ifErr);
    });
  });

  test('able to remove a stored object', function(t) {
    t.plan(1);
    queue.remove('in', lastJob.key, function(err) {
      t.ifError(err);
    });
  });
};
