var fs = require('fs');
var uuid = require('uuid');
var gm = require('gm');
var queue = require('..')('testqueue', {
  key: process.env.REMOTEBUILD_TEST_KEY,
  secret: process.env.REMOTEBUILD_TEST_SECRET
});

function abortWorker(err) {
  console.error('Worker failed: ', err);
  process.exit(1);
}

function processNext(err, job) {
  if (err) {
    return abortWorker(err);
  }

  // acknowledge the job
  job.acknowledge(function(err) {
    if (err) {
      return abortWorker(err);
    }

    // download the file and process with graphicsmagick
    gm(job.createReadStream(), job.filename)
      .resize('400^', '400^')
      .toBuffer('PNG', function(err, buffer) {
        var items = [
          { key: 'output', filename: 'cat.png', body: buffer }
        ];

        job.complete(err, items, function(submitErr) {
          if (submitErr) {
            return abortWorker(submitErr);
          }

          console.log('cat process successfully');
          queue.next('pending', processNext);
        });
      });
  });
}

queue.next('pending', processNext);
