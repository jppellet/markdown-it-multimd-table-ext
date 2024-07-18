.PHONY: lint test coverage report-coveralls browserify

MODULE_PATH := ./node_modules/.bin
export PATH := ${MODULE_PATH}:$(PATH)


${MODULE_PATH}: package.json
	npm install --save-dev
	touch $@  # update timestamp


lint: ${MODULE_PATH}
	npx eslint . --ignore-pattern support

test: ${MODULE_PATH} lint
	npx nyc mocha

coverage: ${MODULE_PATH} lint
	npx nyc report --reporter html

report-coveralls: ${MODULE_PATH} lint
	# For coverage test. You can use `make coverage` on local.
	npx nyc --reporter=lcov mocha

browserify: ${MODULE_PATH} lint test
	npx rollup -c support/rollup.config.js
