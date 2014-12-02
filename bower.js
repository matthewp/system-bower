"format cjs";

// Add @loader, for SystemJS
if(!System.has("@loader")) {
	System.set('@loader', System.newModule({'default':System, __useDefault: true}));
}

// Don't bother loading these dependencies
var excludedDeps = {
	steal: true,
	systemjs: true,
	"system-bower": true
};

var loadedDev = false;
// Combines together dependencies and devDependencies (if bowerDev option is enabled)
var getDeps = function(loader, bower){
	var deps = {};
	var addDeps = function(dependencies){
		for(var name in dependencies) {
			if(!excludedDeps[name]) {
				deps[name] = dependencies[name];
			}
		}
	};
	addDeps(bower.dependencies || {});
	// Only get the devDependencies if this is the root bower and the 
	// `bowerDev` option is enabled
	if(loader.bowerDev && !loadedDev) {
		addDeps(bower.devDependencies || {});
		loadedDev = true;
	}
	return deps;
};

// Get the directory where the main is located, including the bowerPath
var getMainDir = function(bowerPath, name, main){
	var parts = main.split('/');
	parts.pop();

	// Remove . if it starts with that
	if(parts[0] === '.') {
		parts.shift();
	}
	parts.unshift.apply(parts, [bowerPath, name]);
	return parts.join('/');
};

// Set paths for this dependency
var setPaths = function(config, bowerPath, name, main) {
	// Get the main directory, that is the directory including the 
	// bowerPath, the package name, and the path to the main file.
	var mainDir = bowerPath + "/" + name + "/";
	if(!config.paths[name] && main) {
		var mainDir = getMainDir(bowerPath, name, main);
	}

	// Set the path to the `main` and the path to the wildcard.
	config.paths[name] = [bowerPath, name, main].join('/');
	config.paths[name + "/*"] = mainDir + "/*.js";
};

/**
 * @function fetch
 * @description Implement fetch so that we can warn the user in case of a 404.
 * @signature `fetch(load)`
 * @param {Object} load Load object
 * @return {Promise} a promise to resolve with the load's source
 */
exports.fetch = function(load){
	var loader = this;
	return Promise.resolve(this.fetch(load)).then(null, function(msg){
		if(/Not Found/.test(msg)) {
			var packageName = /\/(.+?)\/bower\.json/.exec(load.name)[1];
			console.log("Unable to load the bower.json for", packageName);
		}
		return "";
	});
};

/**
 * @function translate
 * @description Convert the bower.json file into a System.config call.
 * @signature `translate(load)`
 * @param {Object} load Load object
 * @return {Promise} a promise to resolve with the load's new source.
 */
exports.translate = function(load){
	// This could be an empty string if the fetch failed.
	if(load.source == "") {
		return "define([]);";
	}

	var loader = this;
	var bowerPath = loader.bowerPath || "bower_components";

	// Get bower dependencies
	var bower = JSON.parse(load.source);
	var deps = getDeps(loader, bower);
	
	// Get the AMD dependencies
	var amdDeps = [];
	for(var dep in deps) {
		amdDeps.push(
			bowerPath + "/" + dep + "/bower.json!bower"
		);
	}
	// Add in the loader so these will be buildable in parallel.
	amdDeps.unshift("@loader");

	// Creates the configuration object. If the library provides a `system`
	// object on its bower, use that as the base, otherwise we'll create our own.
	var name = bower.name.toLowerCase();
	var config = bower.system || {};
	config.paths = config.paths || {};

	// Set the paths to the wildcard and main modules.
	var main = bower.main && ((typeof bower.main === "string")
								? bower.main : bower.main[0]);
	setPaths(config, bowerPath, name, main);

	return "define(" + JSON.stringify(amdDeps) + ", function(loader){\n" +
		"loader.config(" +JSON.stringify(config, null, " ") + ");" + "\n});";
};
