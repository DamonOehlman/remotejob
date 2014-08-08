# remotejob

This is a package that allows you to request the execution of remote jobs
through the use of AWS S3 and SQS for job coordination.  It's an opinionated
approach to getting remote work done, but also pragmatic.


[![NPM](https://nodei.co/npm/remotejob.png)](https://nodei.co/npm/remotejob/)

[![Build Status](https://img.shields.io/travis/DamonOehlman/remotejob.svg?branch=master)](https://travis-ci.org/DamonOehlman/remotejob) 

## How it Works

To be completed.

## Reference

#### `retrieve(direction, key, callback)`

Retrieve an object from either the input or the output queue (as
specified byt the `direction` argument).

#### `status(callback)`

#### `store(direction, data, callback)`

#### `submit(data, callback)`

The `submit` function performs the `store` and `schedule` operations
one after the other.

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