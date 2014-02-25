var aggregate = require('../');
var assert = require('chai').assert;

function wontError(cb) {
	process.nextTick(function () {
		cb(null, { original: 'result' });
	});
}

function willError(cb) {
	process.nextTick(function simulateError() {
		cb(new Error('Oh noes!'));
	});
}

function returnMapped(res) {
	return 'mapped';
}

function returnDefault(err) {
	return 'defaulted';
}

function returnUndefined(err) {
	return void 0;
}

describe('aggregate', function () {

	it('should map and ignore', function (done) {
		aggregate({
			foo: {
				invoke: wontError,
				onsuccess: returnMapped
			},
			bar: {
				invoke: willError,
				onerror: returnDefault
			}
		}, function (err, res) {
			assert.deepEqual(res, { foo: 'mapped', bar: 'defaulted' });
			done(err);
		});
	});

	it('should handle arrays', function (done) {
		aggregate({
			foo: [{
				invoke: wontError,
				onsuccess: returnMapped
			},{
				invoke: wontError,
				onsuccess: returnMapped
			}]
		}, function (err, res) {
			assert.deepEqual(res, { foo: ['mapped', 'mapped'] });
			done(err);
		});
	});

	it('should remove undefined items from arrays', function (done) {
		aggregate({
			foo: [{
				invoke: wontError,
				onsuccess: returnMapped
			},{
				invoke: willError,
				onerror: returnUndefined
			},{
				invoke: willError,
				onerror: returnDefault
			},{
				invoke: willError,
				onerror: returnUndefined
			},{
				invoke: wontError,
				onsuccess: returnDefault
			}]
		}, function (err, res) {
			assert.deepEqual(res, { foo: ['mapped', 'defaulted', 'defaulted'] });
			done(err);
		});
	});

	it('should create properties for all manifest items regardless of ' +
		'whether they receive results', function (done) {
		aggregate({
			foo: [{
				invoke: wontError,
				onsuccess: returnUndefined
			}],
			bar: {
				invoke: wontError,
				onsuccess: returnUndefined
			}
		}, function (err, res) {
			assert.deepEqual(res, { foo: [], bar: undefined });
			done(err);
		});
	});

	it('should always return an array', function (done) {
		aggregate({
			foo: [{
				invoke: willError,
				onerror: returnUndefined
			},{
				invoke: willError,
				onerror: returnUndefined
			},{
				invoke: wontError,
				onsuccess: returnUndefined
			}]
		}, function (err, res) {
			assert.deepEqual(res, { foo: [] });
			done(err);
		});
	});

	it('should handle arrays of one item', function (done) {
		aggregate({
			foo: [{
				invoke: wontError,
				onsuccess: returnMapped
			}]
		}, function (err, res) {
			assert.deepEqual(res, { foo: ['mapped'] });
			done(err);
		});
	});

	it('should propagate unmapped results', function (done) {
		aggregate({
			foo: {
				invoke: wontError,
				onerror: returnDefault
			},
			bar: {
				invoke: willError,
				onerror: returnDefault
			}
		}, function (err, res) {
			assert.deepEqual(res, { foo: { original: 'result' }, bar: 'defaulted' });
			done(err);
		});
	});

	it('should propagate unhandled errors', function (done) {
		aggregate({
			foo: {
				invoke: wontError,
				onerror: returnDefault
			},
			bar: {
				invoke: willError,
				onsuccess: returnMapped
			}
		}, function (err, res) {
			assert.ok(err);
			done();
		});
	});

	it('should catch and propagate errors thrown in onerror', function (done) {
		aggregate({
			foo: {
				invoke: wontError,
				onsuccess: returnMapped
			},
			bar: {
				invoke: willError,
				onerror: function (err) { throw err; }
			}
		}, function (err, res) {
			assert.ok(err);
			done();
		});
	});
});

