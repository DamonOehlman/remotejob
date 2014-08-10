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

  test('can download the job to the local file system', function(t) {
    t.plan(1);

    if (! lastJob) {
      return t.fail('no job available');
    }

    lastJob
      .createReadStream()
      .once('end', function() {
        t.pass('downloaded file');
      })
      .pipe(fs.createWriteStream(__dirname + '/tmp.zip'));
  });

  test('compare the uploaded file with the downloaded file', function(t) {
    var files = [
      __dirname + '/assets/image-small.zip',
      __dirname + '/tmp.zip'
    ];
    var hashes;

    t.plan(1);
    hashes = files.map(function(filename) {
      return hash.sync({ files: [ filename ], noGlob: true });
    });

    t.equal(hashes[0], hashes[1], 'files match');
  });

  test('remove the tmp file', function(t) {
    t.plan(1);
    fs.unlink(__dirname + '/tmp.zip', t.ifError);
  });

  test('able to remove a stored object', function(t) {
    t.plan(1);
    queue.remove(lastJob.key, function(err) {
      t.ifError(err);
    });
  });
};
