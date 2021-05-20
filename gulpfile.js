import gulp from "gulp";
import {createServer} from "vite";
import esbuild from "gulp-esbuild";
import twig from "gulp-twig2html";
import rename from "gulp-rename";
import fs from "fs";
import path from "path";
import lodash from "lodash";
import chalk from "chalk";
import postCssPlugin from "esbuild-plugin-postcss2";

let config = {
    root: process.cwd(),
    output: {
        dir: "public",
        scripts: "public/assets",
        styles: "public/assets",
        templates: "public"
    },
    input: {
        dir: "src",
        main: "src/main.json",
        scripts: "src/scripts",
        styles: "src/styles",
        templates: "src/templates"
    },
    serve: {
        mode: ""
    },
    styles: {
        postcss: []
    }
}

let userConfig = {};

if (fs.existsSync(path.join(process.cwd(), "gulpfile.config.js"))) {
    userConfig = (await import(path.join(process.cwd(), "gulpfile.config.js"))).default;
}

lodash.merge(config, userConfig);

const exists = {
    scripts: fs.existsSync(path.join(config.root, config.input.scripts)),
    styles: fs.existsSync(path.join(config.root, config.input.styles)),
    templates: fs.existsSync(path.join(config.root, config.input.templates))
}

const Serve = new class {
    get plugin() {
        return {
            // middleware to translate paths from /page to /public/page.html
            middleware: {
                name: 'middleware',
                apply: 'serve',
                "configureServer": (viteDevServer) => {
                    return () => {
                        viteDevServer.middlewares.use(async (context, res, next) => {
                            if (!context.originalUrl.endsWith(".html") && context.originalUrl !== "/") {
                                context.url = `/${config.output.dir}` + context.originalUrl + ".html";
                            } else if (context.url === "/index.html") {
                                context.url = `/${config.output.dir}` + context.url;
                            }

                            next();
                        });
                    };
                }
            },
            // reload page if there is change in public directory (doesn't work with vite by default)
            reload: {
                name: 'reload',
                "handleHotUpdate": ({ file }) => {
                    if (!file.includes('.json') && !file.includes('.html') && file.includes(`/public/`)) {
                        this.reload();
                    }
                }
            }
        }
    }
    reload() {
        // you can use this function to reload page in any gulp task you want, or anywhere in generally
        if (typeof this.server !== "undefined") {
            this.server.ws.send({
                type: 'full-reload',
                path: '*',
            });
            this.server.config.logger.info(
                chalk.green(`page reload `) + chalk.dim(`${config.output.templates}/*.html`),
                { clear: true, timestamp: true }
            )
        }
    }
    init() {
        return new Promise(async resolve => {
            let viteConfig = {
                plugins: [this.plugin.middleware, this.plugin.reload],
                publicDir: path.join(config.root, config.output.dir),
                server: {
                    open: "/",
                    host: true,
                    fsServe: {
                        strict: false
                    },
                    watch: {
                        // default vite watch ignore files and additional files to ignore, reload for templates files is handled manually
                        ignored: ['**/node_modules/**', '**/.git/**', `**/${config.input.templates}/**`, `**/${config.output.dir}/*.html`]
                    }
                },
                root: config.root,
            };

            let css = {
                css: {
                    postcss: {
                        plugins: config.styles.postcss
                    }
                }
            }

            // skip adding postcss plugins in serve:build mode
            if (config.serve.mode === "dev") {
                viteConfig = lodash.merge(viteConfig, css)
            }

            // defines server instance in the Serve class
            this.server = await createServer(viteConfig)


            // starts the server
            await this.server.listen()

            console.log(" ");

            resolve();
        })
    }
}

const Scripts = new class {
    build() {
        // scripts are being build with esbuild so you can use javascript or typescript
        // you can apply any other transformation in the pipe, hash revision can be done with gulp-rev-all or directly in esbuild with esbuild-plugin-manifest
        return gulp.src(config.root + `/${config.input.scripts}/*.{js,ts,tsx}`)
            .pipe(esbuild({
                format: 'esm',
                splitting: true,
                bundle: true,
                minify: true,
                assetNames: '[name].[hash]',
                chunkNames: '[name].[hash]',
                // entryNames: '[name].[hash]'
            }))
            .pipe(gulp.dest(path.join(config.root, config.output.scripts)));
    }
}

const Styles = new class {
    build() {
        // styles are being build with esbuild and esbuild-plugin-postcss2 so you can use postcss or any preprocessor
        // you can apply any other transformation in the pipe (cleancss, purgecss etc.), hash revision can be done with gulp-rev-all or directly in esbuild with esbuild-plugin-manifest
        return gulp.src(config.root + `/${config.input.styles}/*.{css,sass,scss,less, stylus}`)
            .pipe(esbuild({
                plugins: [
                    postCssPlugin.default({
                        plugins: config.styles.postcss
                    })
                ],
                minify: true,
                // entryNames: '[name].[hash]'
            }))
            .pipe(gulp.dest(path.join(config.root, config.output.styles)));
    }
}

const Templates = new class {
    get filters() {
        return {
            "asset": (url) => {
                if (config.serve.mode === "dev" && url.indexOf("/" + config.input.dir) === 0 || url.includes("https://") || url.includes("http://")) {
                    return url;
                }

                if (config.serve.mode !== "dev" && url.indexOf("/" + config.input.dir) === 0) {
                    url = url
                        .replace(`/${config.input.styles}`, `/${config.output.styles}`)
                        .replace(`/${config.input.scripts}`, `/${config.output.scripts}`)
                }

                url = url.replace(`/${config.output.dir}`, "")

                return url;
            }
        }
    }
    build() {
        return gulp.src(config.root + `/${config.input.templates}/*.twig`)
            .pipe(twig({
                filters: this.filters,
                context: {
                    outputPath: `/${config.output.dir}`,
                    inputPath: `/${config.input.dir}`
                },
                globals: `${config.root}/${config.input.main}`
            }))
            .pipe(rename({ extname: '.html' }))
            .pipe(gulp.dest(path.join(config.root, config.output.templates)))
            .on("end", () => Serve.reload())
    }
}

// Everything is loaded from input path with vite, only templates are being build from sources
gulp.task("serve", resolve => {
    let tasks = [];

    config.serve.mode = "dev";

    exists.templates && tasks.push("templates")

    tasks.push(() => Serve.init(), "watch")

    gulp.series(tasks)(resolve)
});

// Everything is loaded from output path with vite, styles, scripts and templates are being build from sources
gulp.task("serve:build", resolve => {
    let tasks = [];

    config.serve.mode = "build";

    exists.scripts && tasks.push("scripts:build")
    exists.styles && tasks.push("styles:build")
    exists.templates && tasks.push("templates")

    tasks.push(() => Serve.init(), "watch:build")

    gulp.series(tasks)(resolve)
});

gulp.task("scripts:build", () => Scripts.build());

gulp.task("styles:build", () => Styles.build());

gulp.task("templates", () => Templates.build());

gulp.task("watch", () => {
    if (exists.templates) {
        gulp.watch(`${config.root}/${config.input.templates}/**`, gulp.series("templates"))
    }
})

gulp.task("watch:build", () => {
    if (exists.scripts) {
        gulp.watch(`${config.root}/${config.input.scripts}/**`, gulp.series("scripts:build"))
    }

    if (exists.styles) {
        gulp.watch(`${config.root}/${config.input.styles}/**`, gulp.series("styles:build"))
    }

    if (exists.templates) {
        gulp.watch(`${config.root}/${config.input.templates}/**`, gulp.series("templates"))
    }
})