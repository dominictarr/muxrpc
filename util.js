'use strict'
const pull = require('pull-stream')

function isString (s) {
  return typeof s === 'string'
}

function isEmpty (obj) {
  if (!obj) return true
  return Object.keys(obj).length === 0
}

// I wrote set as part of permissions.js
// and then later mount, they do nearly the same thing
// but not quite. this should be refactored sometime.
// what differs is that set updates the last key in the path
// to the new value, but mount merges the last value
// which makes sense if it's an object, and set makes sense if it's
// a string/number/boolean.

exports.set = function (obj, path, value) {
  let _obj, _k
  for (let i = 0; i < path.length; i++) {
    const k = path[i]
    obj[k] = obj[k] || {}
    _obj = obj
    _k = k
    obj = obj[k]
  }
  _obj[_k] = value
}

exports.get = function (obj, path) {
  if (isString(path)) return obj[path]
  let value
  for (let i = 0; i < path.length; i++) {
    const k = path[i]
    value = obj = obj[k]
    if (obj == null) return obj
  }
  return value
}

exports.prefix = function (obj, path) {
  let value

  for (let i = 0; i < path.length; i++) {
    const k = path[i]
    value = obj = obj[k]
    if (typeof obj !== 'object') {
      return obj
    }
  }
  return typeof value !== 'object' ? !!value : false
}

function mkPath (obj, path) {
  for (const i in path) {
    const key = path[i]
    if (!obj[key]) obj[key] = {}
    obj = obj[key]
  }

  return obj
}

function rmPath (obj, path) {
  (function r (obj, i) {
    const key = path[i]
    if (!obj) return
    else if (path.length - 1 === i) {
      delete obj[key]
    } else if (i < path.length) r(obj[key], i + 1)
    if (isEmpty(obj[key])) delete obj[key]
  })(obj, 0)
}

function merge (obj, _obj) {
  for (const k in _obj) {
    obj[k] = _obj[k]
  }
  return obj
}

exports.mount = function (obj, path, _obj) {
  if (!Array.isArray(path)) {
    throw new Error('path must be array of strings')
  }
  return merge(mkPath(obj, path), _obj)
}

exports.unmount = function (obj, path) {
  return rmPath(obj, path)
}

function isSource (t) {
  return t === 'source'
}
function isSink (t) {
  return t === 'sink'
}
function isDuplex (t) {
  return t === 'duplex'
}
function isSync (t) {
  return t === 'sync'
}
function isAsync (t) {
  return t === 'async'
}
function isRequest (t) {
  return isSync(t) || isAsync(t)
}

function abortSink (err) {
  return function (read) {
    read(err || true, function () {})
  }
}

function abortDuplex (err) {
  return { source: pull.error(err), sink: abortSink(err) }
}

exports.errorAsStream = function (type, err) {
  return isSource(type)
    ? pull.error(err)
    : isSink(type)
      ? abortSink(err)
      : abortDuplex(err)
}

exports.errorAsStreamOrCb = function (type, err, cb) {
  return (
    isRequest(type)
      ? cb(err)
      : isSource(type)
        ? pull.error(err)
        : isSink(type)
          ? abortSink(err)
          : cb(err),
    abortDuplex(err)
  )
}

exports.pipeToStream = function (type, _stream, stream) {
  if (isSource(type)) {
    _stream(stream)
  } else if (isSink(type)) {
    stream(_stream)
  } else if (isDuplex(type)) {
    pull(_stream, stream, _stream)
  }
}
