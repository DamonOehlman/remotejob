var fs = require('fs');
var test = require('tape');
var uuid = require('uuid');
var lastKey;
var lastJobNo;

module.exports = function(queue) {
  test('able to store data in the queue', function(t) {
    var data = {
      body: fs.createReadStream(__dirname + '/assets/image-small.zip')
    };

    t.plan(2);
    queue.store(data, function(err, key) {
      t.ifError(err);
      t.ok(lastKey = key, 'got key: ' + lastKey);
    });
  });

  test('able to trigger processing of an item', function(t) {
    t.plan(2);
    queue.trigger('pending', lastKey, function(err, jobno) {
      t.ifError(err);
      t.ok(lastJobNo = jobno, 'got job no');
    });
  });

  test('get the next item from the pending queue', function(t) {
    t.plan(4);
    queue.next('pending', function(err, job) {
      t.ifError(err);
      t.ok(job, 'got job');
      t.equal(job.id, lastJobNo, 'matched expected job');

      // acknowledge the job (which removes it from the queue)
      job.acknowledge(t.ifErr);
    });
  });

  test('able to remove a stored object', function(t) {
    t.plan(1);
    queue.remove(lastKey, function(err) {
      t.ifError(err);
    });
  });
};
