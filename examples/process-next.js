var fs = require('fs');
var queue = require('..')('testqueue', {
  key: process.env.REMOTEBUILD_TEST_KEY,
  secret: process.env.REMOTEBUILD_TEST_SECRET
});

queue.next('pending', function(err, job) {
  if (err) {
    return console.error('could not get next job');
  }

  job.createReadStream().pipe(fs.createWriteStream(__dirname, '/newcat.jpg'));
});
