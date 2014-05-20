var _ = require('lodash');
var async = require('async');
var domain = require('domain');

function createSourceInvoker(source) {
	return function sourceInvoker(cb) {
		var cbCtx = this;

		var parentDomain, invokeDomain;

		if (process.domain) {
			//Save the parent domain so we can restore it. Tried using nested
			//domains rather than tracking explicitly but they don't appear
			//to work as expected currently - exiting the domain clears the
			//entire domain stack rather than popping.
			parentDomain = process.domain;
		}

		invokeDomain = domain.create();

		function wrappedCb() {
			//Restore the parent domain (if there was one)
			//before calling userland callback
			var args = arguments;
			invokeDomain.exit();

			if (parentDomain) {
				parentDomain.run(function () {
					cb.apply(cbCtx, args);
				});
			} else {
				cb.apply(cbCtx, args);
			}
		}

		invokeDomain.on('error', function (err) {
			invokeDomain.dispose();
			cb(err);
		});

		invokeDomain.run(function () {
			source.invoke(function handleSourceResponse(err, res) {

				var result;

				if (err) {
					if (!source.onerror) {
						return wrappedCb(err);
					}

					try {
						result = source.onerror(err);
					} catch (e) {
						return wrappedCb(e);
					}
				} else {
					if (source.onsuccess) {
						result = source.onsuccess(res);
					} else {
						result = res;
					}
				}

				return wrappedCb(null, {
					name: source.name,
					value: result
				});
			});
		});
	};
}

function createAggregateProperties(manifest, aggregateResult) {
	_.each(_.keys(manifest), function createAggregateProperties(key) {
		if (_.isArray(manifest[key])) {
			aggregateResult[key] = [];
		} else {
			aggregateResult[key] = {};
		}
	});

	return aggregateResult;
}

function populateAggregateResultFromResults(aggregateResult, resultArr) {
	_.each(resultArr, function mapResultForCallee(result) {
		if (_.isArray(aggregateResult[result.name])) {
			if (result.value !== undefined) {
				aggregateResult[result.name].push(result.value);
			}
		} else {
			aggregateResult[result.name] = result.value;
		}
	});

	return aggregateResult;
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

		aggregateResult = createAggregateProperties(manifest, aggregateResult);
		aggregateResult = populateAggregateResultFromResults(aggregateResult,
			resultArr);

		return cb(null, aggregateResult);
	});
}

module.exports = exports = aggregate;
