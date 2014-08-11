var fs = require('fs');
var queue = require('..')('testqueue', {
  key: process.env.REMOTEBUILD_TEST_KEY,
  secret: process.env.REMOTEBUILD_TEST_SECRET
});

// cats from: http://commons.wikimedia.org/wiki/Cat#mediaviewer/File:Collage_of_Six_Cats-01.jpg
var data = {
  name: 'Cat Montage',
  filename: 'cat.jpg',
  body: fs.createReadStream(__dirname + '/cat.jpg')
};

queue.submit(data, function(err, jobno) {
  if (err) {
    return console.error('could not submit job');
  }

  console.log('job ' + jobno + ' submitted for processing');
});
