var fs = require('fs');
var test = require('tape');
var uuid = require('uuid');
var hash = require('hash-files');
var lastJobNo;
var lastJob;

module.exports = function(queue) {
  test('able to submit an entry to the queue', function(t) {
    var data = {
      body: fs.createReadStream(__dirname + '/assets/image-small.zip'),
      name: 'image-small'
    };

    t.plan(2);
    queue.submit(data, function(err, jobno) {
      t.ifError(err);
      t.ok(lastJobNo = jobno, 'got job no');
    });
  });

  test('get the next item from the pending queue', function(t) {
    t.plan(5);
    queue.next('pending', function(err, job) {
      t.ifError(err);
      t.ok(lastJob = job, 'got job');
      t.equal(job.id, lastJobNo, 'matched expected job');
      t.equal(job.name, 'image-small', 'has metadata');

      // acknowledge the job (which removes it from the queue)
      job.acknowledge(t.ifErr);
    });
  });

  test('complete the job', function(t) {
    var items = [
      { key: 'output', body: fs.createReadStream(__dirname + '/assets/lipsum.txt') },
      { key: 'stderr', body: fs.createReadStream(__dirname + '/assets/stderr.log') }
    ];

    t.plan(1);
    lastJob.complete(null, items, function(err) {
      t.ifError(err);
    });
  });
};
