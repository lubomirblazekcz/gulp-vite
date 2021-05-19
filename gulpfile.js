import gulp from "gulp";
import {createServer} from "vite";
import postcss from "gulp-postcss";
import esbuild from "gulp-esbuild";
import twig from "gulp-twig2html";
import rename from "gulp-rename";
import fs from "fs";
import lodash from "lodash";
import chalk from "chalk";
import postcssImport from "postcss-import";
import postcssNesting from "postcss-nesting";

let root = process.cwd();

let config = {
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
    }
}

let exists = {
    scripts: fs.existsSync(root + "/src/scripts"),
    styles: fs.existsSync(root + "/src/styles"),
    templates: fs.existsSync(root + "/src/templates")
}

let postcssPlugins = [postcssImport, postcssNesting];

const Serve = new class {
    reload() {
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
        return new Promise(async (resolve) => {
            const middleware = {
                name: 'middleware',
                apply: 'serve',
                configureServer(viteDevServer) {
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
            }

            const reload = {
                name: 'reload',
                handleHotUpdate: ({ file, server }) => {
                    if (!file.includes('.json') && !file.includes('.html') && file.includes(`/public/`)) {
                        this.reload();
                    }
                }
            }

            let viteConfig = {
                plugins: [middleware, reload],
                publicDir: config.output.dir,
                server: {
                    open: "/",
                    host: true,
                    fsServe: {
                        strict: false
                    },
                    watch: {
                        ignored: ['**/node_modules/**', '**/.git/**', `**/${config.input.templates}/**`, `**/${config.output.dir}/*.html`]
                    }
                },
                root: root,
            };

            let css = {
                css: {
                    postcss: {
                        plugins: postcssPlugins
                    }
                }
            }

            if (config.serve.mode === "dev") {
                viteConfig = lodash.merge(viteConfig, css)
            }

            this.server = await createServer(viteConfig)

            await this.server.listen()

            console.log(" ");

            resolve();
        })
    }
}

const Scripts = new class {
    build() {
        return gulp.src(root + `/${config.input.scripts}/*.{js,ts,tsx}`)
            .pipe(esbuild({
                format: 'esm',
                bundle: true
            }))
            .pipe(gulp.dest(root + `/${config.output.scripts}`));
    }
}

const Styles = new class {
    build() {
        return gulp.src(root + `/${config.input.styles}/*.css`)
            .pipe(postcss(postcssPlugins))
            .pipe(gulp.dest(root + `/${config.output.styles}`));
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
        return gulp.src(root + `/${config.input.templates}/*.twig`)
            .pipe(twig({
                filters: this.filters,
                context: {
                    outputPath: `/${config.output.dir}`,
                    inputPath: `/${config.input.dir}`
                },
                globals: `${root}/${config.input.main}`
            }))
            .pipe(rename({ extname: '.html' }))
            .pipe(gulp.dest(config.output.dir))
            .on("end", () => Serve.reload())
    }
}


gulp.task("templates", () => {
    return Templates.build()
});

gulp.task("scripts:build", () => {
    return Scripts.build()
});

gulp.task("styles:build", () => {
    return Styles.build()
});

gulp.task("serve", resolve => {
    let tasks = ["templates"];

    config.serve.mode = "dev";

    exists.templates && tasks.push("templates")

    tasks.push(() => Serve.init(), "watch")

    gulp.series(tasks)(resolve)
});

gulp.task("serve:build", resolve => {
    let tasks = ["scripts:build", "styles:build", "templates"];

    config.serve.mode = "build";

    exists.templates && tasks.push("templates")

    tasks.push(() => Serve.init(), "watch:build")

    gulp.series(tasks)(resolve)
});

gulp.task("watch", () => {
    if (exists.templates) {
        gulp.watch(`${config.input.templates}/**`, gulp.series("templates"))
    }
})

gulp.task("watch:build", () => {
    if (exists.scripts) {
        gulp.watch(`${config.input.scripts}/**`, gulp.series("scripts:build"))
    }

    if (exists.styles) {
        gulp.watch(`${config.input.styles}/**`, gulp.series("styles:build"))
    }

    if (exists.templates) {
        gulp.watch(`${config.input.templates}/**`, gulp.series("templates"))
    }
})