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

function mapSuccess(res) {
	return 'mapped';
}

function ignoreError(err) {
	return 'defaulted';
}

describe('aggregate', function () {

	it('should map and ignore', function (done) {
		aggregate({
			foo: {
				invoke: wontError,
				onsuccess: mapSuccess
			},
			bar: {
				invoke: willError,
				onerror: ignoreError
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
				onsuccess: mapSuccess
			},{
				invoke: wontError,
				onsuccess: mapSuccess
			}]
		}, function (err, res) {
			assert.deepEqual(res, { foo: ['mapped', 'mapped'] });
			done(err);
		});
	});

	it('should propagate unmapped results', function (done) {
		aggregate({
			foo: {
				invoke: wontError,
				onerror: ignoreError
			},
			bar: {
				invoke: willError,
				onerror: ignoreError
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
				onerror: ignoreError
			},
			bar: {
				invoke: willError,
				onsuccess: mapSuccess
			}
		}, function (err, res) {
			assert.ok(err);
			done();
		});
	});

});

