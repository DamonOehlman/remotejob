var queueName = 'remote_job_test'; // require('uuid').v4();
var test = require('tape');
var queue = require('..')(queueName, {
  key: process.env.REMOTEBUILD_TEST_KEY,
  secret: process.env.REMOTEBUILD_TEST_SECRET
});

test('wait for queue to be ready', function(t) {
  t.plan(1);
  queue.once('ready', t.pass);
});

require('./store')(queue);
require('./trigger')(queue);
require('./submit')(queue);
require('./process')(queue);
