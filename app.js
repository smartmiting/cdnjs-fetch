#!/usr/bin/env node

// deps
var colog   = require('colog');
var Q       = require('q');
var argv    = require('yargs').argv;
// lib
var store   = require('./lib/store');
var dl      = require('./lib/downloader');
var prompt  = require('./lib/prompt');
var extract = require('./lib/helpers/extract');
var link    = require('./lib/helpers/link');

var app = {

  /*
   * Shows a help pane
   */
  showHelp: function(argv) {
    console.log("Usage: fletch <packageName> [options]");
    console.log();
    console.log("Options:");
    console.log();
    console.log("-o, --options\tSpecify the ouput directory.");
    console.log("-v, --version\tSpecify a version (semver support)");
    console.log("-h, --help\tShow help page");
    console.log("-s, --silent\tDiscrete output. Will only show prompts.");
    console.log("-m, --minimal\tDownload only the main file (e.g.: jquery.min.js)");
    console.log("-t, --tag\tPrints out html script/link tags instead of downloading");
    console.log();
    console.log("Example usage:");
    console.log();
    console.log("fletch jquery\t\t\t# Downloads latest version of jQuery");
    console.log("fletch jquery -o lib/deps\t# Downloads latest version of jQuery to the lib/deps/ directory");
    console.log("fletch jquery -v \"<2\"\t\t# Downloads a version of jQuery that's lower than 2.0.0");
    console.log("fletch jquery -mt \"1.x\"\t\t# Prints out a jQuery.min.js script tag for the latest version of jQuery 1");
  },

  /*
   * Storing args in app.params hash
   */
  parseArgs: function(argv) {
    this.params = {
      query: argv._[0],
      showHelp:    argv.h || argv.help    || false,
      destination: argv.o || argv.output  || "",
      version:     argv.v || argv.version,
      silent:      argv.s || argv.silent  || false,
      minimal:     argv.m || argv.minimal || false,
      printHTML:   argv.t || argv.tag     || false
    }
  },

  /*
   * The main code entrypoint
   */
  run: function(argv) {

    this.parseArgs(argv);
    if (this.params.showHelp || !this.params.query) {
      this.showHelp();
      return;
    }
    if (this.params.silent) colog.silent(true);

    // The main call to the store
    store.findMatching(this.params.query).then(function (results) {
      this.parseMatches(results);
    }.bind(this)).catch(console.error);
  },

  /*
   * This guy takes in an array of package objects. If empty, it prints
   * out a message. If 1 packages, it executes the processRequest method
   * on it. If mutltiple, it prompts the user to make a choice, and then
   * execute process request on it.
   */
  parseMatches: function(matches) {

    // No matches
    if (matches.length == 0) console.log("No matches found for " + this.params.query);

    // Multiple matches
    else if (matches.length > 1){
      // Log options
      colog.warning("Found many packages! Which one do you want?");
      var itemNames = matches.map(function(item) { return item.name });
      return prompt.options(itemNames).then(function(ans) {
        this._processRequest(matches[ans]);
      }.bind(this)).catch(console.error);
    }

    // Single match
    else this._processRequest(matches[0]);
  },

  /*
   * Processes a request for a lib. Spits out HTML tags or
   * launches the install process depending on app.params
   */
  _processRequest: function(lib) {
    if (this.params.printHTML) this._printTags(lib);
    else this._install(lib);
  },

  /*
   * Prints HTML script tags to stdout of all files in extract asset
   */
  _printTags: function(lib) {
    var semVersion = this.params.version || lib.version;
    if (this.params.minimal) {
      var fileName = lib.latest.split('/').slice(-1)[0];
      var version = extract.matchingVersion(lib, semVersion);
      var tag = link.HTML(lib.name, version, fileName);
      if (tag) console.log(tag);
    } else {
      var asset = extract.asset(lib, semVersion);
      for (var i in asset.files) {
        var tag = link.HTML(lib.name, asset.version, asset.files[i]);
        if (tag) console.log(tag);
      }
    }
  },

  /*
   * This function finishes the process by launching the dependency
   * checker and the download.
   */
  _install: function(lib) {
    colog.info("Will install " + lib.name);
    store.getDependentPackages(lib)
    .then(function(dependentPackages) {
      dl.download(lib, this.params.version, this.params.destination, this.params.minimal);
      dependentPackages.forEach( function(dependency) {
        dl.download(dependency, dependency.depVersion, this.params.destination, this.params.minimal);
      }.bind(this));
    }.bind(this)).catch(console.error);
  }

}

module.exports = app;

if (require.main == module) {
  app.run(argv);
}
