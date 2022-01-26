'use strict';

var chalk = require('chalk');
var path = require('path');
var lodash = require('lodash');
var vite = require('vite');
var module$1 = require('module');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var chalk__default = /*#__PURE__*/_interopDefaultLegacy(chalk);
var path__default = /*#__PURE__*/_interopDefaultLegacy(path);
var lodash__default = /*#__PURE__*/_interopDefaultLegacy(lodash);

const require$1 = module$1.createRequire((typeof document === 'undefined' ? new (require('u' + 'rl').URL)('file:' + __filename).href : (document.currentScript && document.currentScript.src || new URL('index.cjs.js', document.baseURI).href)));

var index = new class {
    get plugin() {
        return {
            // middleware to translate paths from /page to /public/page.html
            middleware: {
                name: 'middleware',
                apply: 'serve',
                configureServer: (viteDevServer) => {
                    return () => {
                        viteDevServer.middlewares.use(async(context, res, next) => {
                            if (!context.originalUrl.endsWith('.html') && context.originalUrl !== '/') {
                                context.url = `/${this.options.output}` + context.originalUrl + '.html';
                            } else if (context.url === '/index.html') {
                                context.url = `/${this.options.output}` + context.url;
                            }

                            next();
                        });
                    }
                }
            },
            // reload page if there is change in public directory (it doesn't work with vite by default)
            reload: {
                name: 'reload',
                handleHotUpdate: ({ file }) => {
                    if ((!this.options.reloadPublic && !file.includes('.json') && !file.includes('.html') && file.includes(`/${this.options.output}/`)) ||
                        (this.options.reloadPublic && file.includes(`/${this.options.output}/`)) || this.options.reloadFiles(file)) {
                        this.reload(file);
                    }
                }
            }
        }
    }

    reload(file) {
        // you can use this function to reload page in any gulp task you want, or anywhere in generally
        if (typeof this.server !== 'undefined') {
            this.server.ws.send({
                type: 'full-reload',
                path: '*'
            });
            this.server.config.logger.info(
                chalk__default["default"].green('page reload ') + chalk__default["default"].dim(typeof file !== 'undefined' ? file.replace(`${this.options.root}/`, '') : '*.html'),
                { clear: true, timestamp: true }
            );
        }
    }

    init(userOptions = {}) {
        const options = {
            output: 'public',
            root: process.cwd(),
            ignored: [],
            reloadPublic: true,
            reloadFiles: () => false
        };

        lodash__default["default"].merge(options, userOptions);

        const viteOptions = {
            vite: {
                plugins: [this.plugin.middleware, this.plugin.reload],
                publicDir: path__default["default"].join(options.root, options.output),
                server: {
                    open: '/',
                    host: true,
                    fsServe: {
                        strict: false
                    },
                    watch: {
                        // default vite watch ignore files and additional files to ignore, reload for templates files is handled manually
                        ignored: options.ignored.concat(['**/node_modules/**', '**/.git/**'])
                    }
                },
                root: options.root
            }
        };

        if (!options.reloadPublic) {
            viteOptions.vite.server.watch.ignored.push(`**/${options.output}/*.html`);
        }

        lodash__default["default"].merge(options, viteOptions);

        this.options = options;

        return new Promise(async resolve => {
            // defines server instance in the Serve class
            this.server = await vite.createServer(this.options.vite);

            // starts the server
            await this.server.listen();

            console.log(chalk__default["default"].cyan(`\n  vite v${require$1('vite/package.json').version}`) + chalk__default["default"].green(' dev server running at:\n'));
            this.server.printUrls();
            console.log('');

            resolve();
        })
    }
}();

module.exports = index;
