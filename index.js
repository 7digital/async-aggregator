var _ = require('lodash');
var async = require('async');

function createSourceInvoker(source) {
	return function sourceInvoker(cb) {
		source.invoke(function handleSourceResponse(err, res) {
			var result;

			if (err) {
				if (!source.onerror) {
					return cb(err);
				}

				try {
					result = source.onerror(err);
				} catch (e) {
					return cb(e);
				}
			} else {
				if (source.onsuccess) {
					result = source.onsuccess(res);
				} else {
					result = res;
				}
			}

			return cb(null, {
				name: source.name,
				value: result
			});
		});
	};
}

// Make a bunch of async calls in parallel and specify handlers for error or
// success conditions that map onto an aggregate result object.
//
// `manifest` @object - A manifest of calls to make wth their mappings, the
// property names will hold the results of their async calls mapped or handled
// by the specified handlers on the aggregate results.  Handlers should *return*
// the mutated error or result.  You may specify an array of items which will
// result in an array of results on the aggregate result.
// {
//     'prop': {
//         invoke: function (cb) where cb : function (err, res)
//         onerror: function (err) -> value (e.g. a default value)
//         onsuccess: function (res) -> value (mappedValue)
//    }
// }
//
// `callback` @function - A callback function with either an unhandled error
// or the aggregate result.
//
function aggregate(manifest, cb) {
	var invokers = [];

	function registerInvoker(val, key) {
		var source = _.clone(val);
		source.name = key;

		invokers.push(createSourceInvoker(source));
	}

	_.forOwn(manifest, function (val, key) {
		if (_.isArray(val)) {
			_.each(val, function (item) {
				registerInvoker(item, key);
			});
		} else {
			registerInvoker(val, key);
		}
	});

	async.parallel(invokers, function  handleResults(err, resultArr) {
		var aggregateResult = {};
		if (err) {
			return cb(err);
		}

		_.each(resultArr, function mapResultForCallee(result) {
			if (aggregateResult[result.name]) {
				if (!_.isArray(aggregateResult[result.name])) {
					aggregateResult[result.name] =
						[aggregateResult[result.name]];
				}

				return aggregateResult[result.name].push(result.value);
			}

			aggregateResult[result.name] = result.value;
		});

		return cb(null, aggregateResult);
	});
}

module.exports = exports = aggregate;
