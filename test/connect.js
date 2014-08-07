var test = require('tape');
var jobs = require('..')('test', {
  key: process.env.REMOTEBUILD_TEST_KEY,
  secret: process.env.REMOTEBUILD_TEST_SECRET
});

test('able to get the status of the queue', function(t) {
  t.plan(1);
  jobs.status(function(err, status) {
    t.ifError(err);
  });
});
