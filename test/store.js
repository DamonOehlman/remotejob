var fs = require('fs');
var test = require('tape');
var uuid = require('uuid');
var lastKey;

module.exports = function(queue) {
  test('able to store data in the queue', function(t) {
    var data = {
      body: fs.createReadStream(__dirname + '/assets/image-small.zip')
    };

    t.plan(2);
    queue.store('in', data, function(err, key) {
      t.ifError(err);
      t.ok(lastKey = key);
    });
  });

  test('attempt to retrieve an unknown object fails', function(t) {
    t.plan(1);
    queue.retrieve('in', uuid.v4(), function(err) {
      t.ok(err, 'received error as expected');
    });
  });

  test('able to retrieve a stored object', function(t) {
    t.plan(1);
    queue.retrieve('in', lastKey, function(err, data) {
      t.ifError(err);
    });
  });
};
