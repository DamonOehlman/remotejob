# remotejob

This is a package that allows you to request the execution of remote jobs
through the use of AWS S3 and SQS for job coordination.  It's an opinionated
approach to getting remote work done, but also pragmatic.


[![NPM](https://nodei.co/npm/remotejob.png)](https://nodei.co/npm/remotejob/)

[![Build Status](https://img.shields.io/travis/DamonOehlman/remotejob.svg?branch=master)](https://travis-ci.org/DamonOehlman/remotejob) 

## Getting Started

The following code illustrates what a "job requester" would do to request a job
is queued for remote execution.

```js
var fs = require('fs');
var queue = require('remotejob')('testqueue', {
  key: process.env.REMOTEBUILD_TEST_KEY,
  secret: process.env.REMOTEBUILD_TEST_SECRET
});

// cats from: http://commons.wikimedia.org/wiki/Cat#mediaviewer/File:Collage_of_Six_Cats-01.jpg
var data = {
  name: 'Cat Montage',
  body: fs.createReadStream(__dirname + '/cat.jpg')
};

queue.submit(data, function(err, jobno) {
  if (err) {
    return console.error('could not submit job');
  }

  console.log('job ' + jobno + ' submitted for processing');
});

```

On the receiving end, the code would look something similar to this:

```js
var fs = require('fs');
var queue = require('remotejob')('testqueue', {
  key: process.env.REMOTEBUILD_TEST_KEY,
  secret: process.env.REMOTEBUILD_TEST_SECRET
});

queue.next('pending', function(err, job) {
  if (err) {
    return console.error('could not get next job');
  }

  // acknowledge the job
  job.acknowledge();

  // download the file
  job.createReadStream().pipe(fs.createWriteStream(__dirname + '/newcat.jpg'));
});

```

## How it Works

To be completed.

## Reference

#### `download(opts) => ReadableStream`

Create a readable stream for the S3 object details provided.

#### `next(status, callback)`

This function is used to request the next job available for the `status`
processing queue. If the requested `status` does not relate to a known
queue, then the callback will return an error, otherwise, it will
fire once the next

#### `remove(direction, key, callback)`

Remove the specified `key` from the `direction` objects datastore.

#### `retrieve(direction, key, callback)`

Retrieve an object from either the input or the output queue (as
specified byt the `direction` argument).

#### `store(direction, data, callback)`

#### `submit(data, callback)`

The `submit` function performs the `store` and `trigger` operations
one after the other.

#### `trigger(key, callback)`

Add an entry to the queue for processing the input identified by `key`

### "Hidden" functions

The following functions are available for use, but in general aren't that
useful when working with the `remotejob` queue.

#### `_removeJob(status, receiptHandle, callback)`

This function is used to remove jobs from the specified `status` queue.
As required but AWS SQS, this function accepts a `receiptHandle` for a
message and passed that through to remove the message from the queue.

## License(s)

### MIT

Copyright (c) 2014 Damon Oehlman <damon.oehlman@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
