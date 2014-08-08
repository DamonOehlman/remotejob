var test = require('tape');
var queueName = require('uuid').v4();
var jobs = require('..')(queueName, {
  key: process.env.REMOTEBUILD_TEST_KEY,
  secret: process.env.REMOTEBUILD_TEST_SECRET
});

test('wait for ready', function(t) {
  t.plan(1);
  jobs.once('ready', function() {
    t.pass('ready for operation');
  });
});

test('able to get the status of the queue', function(t) {
  t.plan(1);
  jobs.status(function(err, status) {
    t.ifError(err);
    console.log(arguments);
  });
});
