var test = require('tape');

module.exports = function(queue) {
  test('able to get the status of the queue', function(t) {
    t.plan(1);
    queue.status(function(err, status) {
      t.ifError(err);
    });
  });
};
