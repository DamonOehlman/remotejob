# remotejob

This is a package that allows you to request the execution of remote jobs
through the use of AWS S3 and SQS for job coordination.  It's an opinionated
approach to getting remote work done, but also pragmatic.


[![NPM](https://nodei.co/npm/remotejob.png)](https://nodei.co/npm/remotejob/)

[![unstable](https://img.shields.io/badge/stability-unstable-yellowgreen.svg)](https://github.com/dominictarr/stability#unstable) [![Build Status](https://img.shields.io/travis/DamonOehlman/remotejob.svg?branch=master)](https://travis-ci.org/DamonOehlman/remotejob) 

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
  filename: 'cat.jpg',
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
var uuid = require('uuid');
var gm = require('gm');
var queue = require('remotejob')('testqueue', {
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

```

__NOTE:__ While the `remotejob` module allows you to provide `Stream` objects
as the body to various functions, the same limitations that apply when using
the [AWS SDK apply](https://github.com/aws/aws-sdk-js/issues/94), where a
stream length is needed to upload the file to S3.  In most cases it is simpler
to work with a `Buffer` instead as has been done in the example above.

## Reference

### `remotejob(name, opts?)`

This creates a new queue that provides a number of helper functions that can be
used to manage the remote job queue.  The `name` argument is used to generate
the appropriate S3 bucket and SQS queues, though it is not used without
modification.

Additionally, the following options can be passed through:

- `region` (default: `us-west-1`)

  The AWS region in which SQS queues are created.

- `queues` (default: `[ 'pending' ]`)

  The names of the queues that will be used when triggering jobs. In general,
  if you are using the `submit` function then you will not need to change this
  but if you are customising behaviour through using `store` and `trigger`
  individually you may want to customise this to fit with the names of the
  jobs you are triggering jobs against.

#### `download(opts) => ReadableStream`

Create a readable stream for the S3 object details provided.

#### `next(status, callback)`

This function is used to request the next job available for the `status`
processing queue. If the requested `status` does not relate to a known
queue, then the callback will return an error, otherwise, it will
fire once the next

#### `remove(key, callback)`

Remove the specified `key` from the objects datastore.

#### `retrieve(key, callback)`

Retrieve an object from with the specified `key`

#### `store(data, callback)`

The store function is used to store metadata and an optional `body` to
S3 storage for the queue bucket.

The remotejob system uses two buckets to track the inbound and outbound
data for objects being processed by the system.

#### `storeRaw(key, metadata, body, callback)`

A simple wrapper to the raw S3 store operation (`s3.putObject`).

#### `submit(data, callback)`

The `submit` function performs the `store` and `trigger` operations
one after the other.  This operation places items in the default
`pending` queue.

#### `trigger(queueName, key, callback)`

Add an entry to the queue for processing the input identified by `key`.

### "Hidden" functions

The following functions are available for use, but in general aren't that
useful when working with the `remotejob` queue.

#### `_removeJob(status, receiptHandle, callback)`

This function is used to remove jobs from the specified `status` queue.
As required but AWS SQS, this function accepts a `receiptHandle` for a
message and passed that through to remove the message from the queue.

#### `_storeAsset(job, data, callback)`

This is an internal function used to assist with storing assets associated
with the result of a job.

### `Job` prototype

A `Job` is a helper layer for working with the underlying queue. The exposed
methods are provided as a convenience, and do generally make working with
the queue a little more terse than it would be otherwise.

#### `Job#acknowledge(callback)`

Remove the job from the `pending` queue.

#### `Job#createReadStream(name?)` => `ReadableStream`

Initiate a download of the resource associated with the job. If
`name` is not specified this will be the input file associated with
the job request.

#### `Job#complete(err, assets, callback)`

When the job processing has been completed, the `complete` method is
used to pass back the job status and any assets that have been created
during the procesing.

In the event that an error has occurred during processing, then an
`Error` should be passed back through the `err` argument and the job
status will be updated to reflect this.

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
