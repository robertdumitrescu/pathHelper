const lodashGet = require('lodash/get');
const lodashSet = require('lodash/set');

/**
 * @class ObjectHelper
 * @constructor
 */
class CollectionPathHelper {

    /**
     * Method that returns a boolean (true|false) when
     * an object is a RegExp Javascript object or not
     * This is the simplified, portable version of the objectIsRegExp validator {@link BoolValidator.objectIsRegExp}
     * @param {*} property
     * @return {boolean|String}
     */
    static objectIsRegExp(property) {
        if (!(typeof property === 'object' && property !== null)) {
            return false;
        }

        if (!property.constructor) {
            return false;
        }

        return property.constructor.name === 'RegExp';
    }

    /**
     * Method that returns either a boolean (true|false) either an error message as a string when
     * a string starts with a certain template defined under "needle" argument
     * This is the simplified, portable version of the stringStartsWith validator {@link BoolValidator.stringStartsWith}
     * @param {*} property
     * @param {Object=} options
     * @param {Number=} options.needle - Either a string, either a regex that defines a range. The regex expressions passed to this parameter need to start with the symbol "^"
     * @param {Boolean=} options.failWithMsg
     * @param {String=} options.path
     * @param {String=} options.validator
     * @param {String=} options.varName
     * @return {boolean|String}
     */
    static stringStartsWith(property, options) {
        let defaultOptions = {
            failWithMsg: false,
            path: 'property',
            validator: 'stringStartsWith',
            varName: 'property',
        };

        options = {...defaultOptions, ...options};

        if (!(typeof property || property instanceof String)) {
            return false;
        }

        if (typeof options.needle === 'string' || options.needle instanceof String) {
            if (!property.startsWith(options.needle)) {
                return false;
            }
        } else if (CollectionPathHelper.objectIsRegExp(options.needle)) {
            if (!options.needle.test(property)) {
                return false;
            }
        } else {
            return false;
        }

        return true;

    }

    /**
     * For a given string and a part of the string given under "discardedStrings" property,
     * it will return the difference between initial string and discarded one.
     * This is the simplified, portable version of the getRemainingString method {@link BoolValidator.getRemainingString}
     * @param {String} property
     * @param {Object=} options
     * @param {String[]=} options.discardedStrings
     * @param {Boolean=} options.global
     * @return {boolean|String}
     */
    static getRemainingString(property, options) {
        options = {...{
            discardedStrings: [''],
            global: false
        }, ...options};

        if (typeof property === 'string' || property instanceof String) {
            for (let i = 0; i < options.discardedStrings.length; i++) {
                property = options.global
                    ? property.split(options.discardedStrings[i]).join("")
                    : property.replace(options.discardedStrings[i], "");
            }
        }
        return property;
    }

    /**
     * For a given path string, it will return the type of the first fragment within the path
     * @param {String} path - the path that would be exploded and evaluated
     * @returns {String}
     */
    static getStartType(path) {
        if ((typeof path === 'string' || path instanceof String) && path.length > 0) {
            var endBracket;
            if (path[0] === "[" && (endBracket = path.indexOf("]", 1)) > -1) {
                if (path.substring(0, endBracket).indexOf(",", 2) == -1) return "array";
            }
            return 'object';
        }
        return 'unknown';
    }

    /**
     * This takes a path string according to Lodash specifications for collections and explodes it into multiple path fragments
     * @param {String} path
     * @returns {String[]}
     */
    static explodePath(path) {
        return path.split('.').reduce((result, partial) => {
            var fragmentPartial;
            while ((fragmentPartial = partial.indexOf('[', 1)) !== -1) {
                var newFragment = partial.slice(0, fragmentPartial);
                result.push(newFragment);
                partial = CollectionPathHelper.getRemainingString(partial, { discardedStrings: [newFragment] });
            }
            result.push(partial); return result;
        }, []).reduce((result, q) => {
            if (q.slice(1)) result.push(q); return result;
        }, []);
    }

    /**
     * This implodes an array of pathFragments into a valid path
     * @param {String[]} pathFragments
     * @return {String}
     */
    static implodePath(pathFragments) {
        return pathFragments.reduce((path, fragment) => {
            switch (CollectionPathHelper.getStartType(fragment)) {
                case 'object':
                    path = (path === '') ? `${path}${fragment}` : `${path}.${fragment}`;
                    break;
                case 'array':
                    path = `${path}${fragment}`;
                    break;
            }
            return path;
        }, '');
    }

    /**
     * For a given path, it removes pathFragments from either the start or the end of it.
     * Also you can set how many fragments to remove. By default just one fragment is removed.
     * @param {String} path
     * @param {Object=} options
     * @param {Number=} options.count - Default: 1
     * @param {String=} options.termination Default: 'end' - (Possible options: "start" and "end")
     * @returns {String}
     */
    static removePathLevels(path, options) {
        options = {...{
            count: 1,
            termination: 'end'
        }, ...options };

        let pathFragments = CollectionPathHelper.explodePath(path);

        if (options.termination === 'end') {
            pathFragments.splice(pathFragments.length - options.count, options.count);
        } else if (options.termination === 'start') {
            pathFragments.splice(0, options.count);
        }

        return CollectionPathHelper.implodePath(pathFragments);
    }

    /**
     * This will get the name of the first dynamic variable defined in path
     * Works in both object path definitions and array definitions. For both print interpolators and path ones.
     * @param path
     * @returns {*}
     */
    static getFirstDynamicVariableName(path) {
        let regex = new RegExp(/[^{{\}\}]+(?=\}\})/);
        return path.match(regex)[0];
    }

    /**
     * Returns true or false if the start of the path is dynamic or not
     * This is bound to one fragment at time and should be used accordingly.
     * @param path
     * @returns {boolean}
     */
    static isPathStartDynamic(path) {
        return [0, 1].includes(path.indexOf('{'));
    }

    /**
     * Get By path
     * @param collection
     * @param path
     * @param def
     * @returns {*}
     */
    static get(collection, path, def) {
        if (!(((typeof path === 'string' || path instanceof String) && path.length > 0) || (Array.isArray(path) && path.length > 0))) {
            return collection;
        }
        if ((typeof path === 'string' || path instanceof String) && path.startsWith('.')) {
            path = path.replace('.', '');
        }

        let result = lodashGet(collection, path, 'undefined');

        if (result === 'undefined') {
            path = CollectionPathHelper.explodePath(path);

            result = lodashGet(collection, path, 'undefined');
        }

        return result;
    }

    /**
     * Get By path
     * @param {Array|Object|*} collection
     * @param {String} path
     * @param {*} value
     * @returns {*}
     */
    static set(collection, path, value) {
        if (path.length === 0) {
            return value;
        }
        if (!(((typeof path === 'string' || path instanceof String) && path.length > 0) || (Array.isArray(path) && path.length > 0))) {
            return collection;
        }

        if ((typeof path === 'string' || path instanceof String) && path.startsWith('.')) {
            path = path.replace('.', '');
        }

        return lodashSet(collection, path, value);
    }

    /**
     * This method will get all possible subpaths out of one path
     * For a path like 'lorem.ipsum[2][1].foo' the subpaths would be:
     * ['', 'lorem', 'lorem.ipsum', 'lorem.ipsum[2]', 'lorem.ipsum[2][1]', 'lorem.ipsum[2][1].foo']
     * @param {String} property
     * @param {Object=} options
     * @param {Boolean=} options.ignoreRoot - This would ignore the empty string at the beginning. (Default false)
     * @param {Boolean=} options.ignoreFull - This would ignore the full path and the end. (Default false)
     * @return {String[]}
     */
    static getSubPaths(property, options) {
        options = {...{
            ignoreRoot: false,
            ignoreFull: false
        }, ...options};

        let result = [];

        if (!(typeof property === 'string' || property instanceof String)) return result;
        if (!options.ignoreRoot) result.push('');

        CollectionPathHelper.explodePath(property).reduce((accumulatedPath, path) => {
            accumulatedPath.push(path);
            result.push(CollectionPathHelper.implodePath(accumulatedPath));
            return accumulatedPath;
        }, []);

        if (result.length > 0 && options.ignoreFull) result.pop();
        return result;
    }

    /**
     * This method replaces the array notations within a path with a certain string defined under options.string argument
     * @param {String} property
     * @param {Object=} options
     * @param {String} options.string - the string which would be put in place of arrays
     * @return {String}
     */
    static replacePathArraysWithString(property, options) {
        options = {...{
            string: '',
        }, ...options};

        return CollectionPathHelper.implodePath(CollectionPathHelper.explodePath(property).map(ep => {
            return CollectionPathHelper.getStartType(ep) === 'array' ? options.string : ep;
        }));
    }

    static filterOutPath(options) {
        let defaultOptions = {
            path: '',
            foArrayPath: false,
            foObjectPath: false,
            foInitialDot: false
        };

        options = {...defaultOptions, ...options};

        let convertedPath = path;

        if (options.foArrayPath) {
            convertedPath = convertedPath.replace(/\s*\[.*?\]\s*/gm, '');
        }

        if (options.foObjectPath) {
            convertedPath = convertedPath.replace(/[a-zA-Z.]+/gm, '');
        }

        if (options.foInitialDot && convertedPath.startsWith('.')) {
            convertedPath = convertedPath.replace('.', '');
        }
        return convertedPath;
    }
}

if (typeof module !== 'undefined' && module.exports) { module.exports = CollectionPathHelper; }
