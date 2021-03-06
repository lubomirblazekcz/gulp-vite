import gulp from 'gulp'
import esbuild from 'gulp-esbuild'
import twig from 'gulp-twig2html'
import rename from 'gulp-rename'
import fs from 'fs'
import path from 'path'
import lodash from 'lodash'
import postCssPlugin from 'esbuild-plugin-postcss2'
import Serve from './index.mjs'

const mergeConfig = async (config, path) => {
    if (fs.existsSync(path)) {
        lodash.merge(config, (await import(path)).default)
    }
}

const configPath = path.join(process.cwd(), "gulpfile.config.js")

const config = {
    root: process.cwd(),
    output: {
        dir: 'public',
        scripts: 'public/assets',
        styles: 'public/assets',
        templates: 'public'
    },
    input: {
        dir: 'src',
        main: 'src/main.json',
        scripts: 'src/scripts',
        styles: 'src/styles',
        templates: 'src/templates'
    },
    serve: {
        mode: ''
    },
    scripts: {
        esbuild: {
            plugins: []
        }
    },
    styles: {
        esbuild: {
            plugins: []
        },
        postcss: []
    }
}

await mergeConfig(config, configPath)

const serve = {
    ignored: [`**/${config.input.templates}/**`],
    output: config.output.templates,
    reloadPublic: false,
    reloadFiles: (file) => file.endsWith('.php'),
    vite: {
        css: {
            postcss: {
                plugins: config.styles.postcss
            }
        }
    }
}

lodash.merge( config, { serve })

await mergeConfig(config, configPath)

const exists = {
    scripts: fs.existsSync(path.join(config.root, config.input.scripts)),
    styles: fs.existsSync(path.join(config.root, config.input.styles)),
    templates: fs.existsSync(path.join(config.root, config.input.templates))
}

const Scripts = new class {
    build() {
        // scripts are being build with esbuild so you can use javascript or typescript
        // you can apply any other transformation in the pipe, hash revision can be done with gulp-rev-all or directly in esbuild with esbuild-plugin-manifest
        return gulp.src(config.root + `/${config.input.scripts}/*.{js,ts,tsx}`)
            .pipe(esbuild(lodash.merge({
                format: 'esm',
                splitting: true,
                bundle: true,
                minify: true,
                assetNames: '[name].[hash]',
                chunkNames: '[name].[hash]'
                // entryNames: '[name].[hash]'
            }, config.scripts.esbuild)))
            .pipe(gulp.dest(path.join(config.root, config.output.scripts)))
    }
}()

const Styles = new class {
    build() {
        // styles are being build with esbuild and esbuild-plugin-postcss2 so you can use postcss or any preprocessor
        // you can apply any other transformation in the pipe (cleancss, purgecss etc.), hash revision can be done with gulp-rev-all or directly in esbuild with esbuild-plugin-manifest
        return gulp.src(config.root + `/${config.input.styles}/*.{css,sass,scss,less, stylus}`)
            .pipe(esbuild(lodash.merge({
                plugins: [
                    postCssPlugin.default({
                        plugins: config.styles.postcss
                    })
                ],
                minify: true
                // entryNames: '[name].[hash]'
            }, config.styles.esbuild)))
            .pipe(gulp.dest(path.join(config.root, config.output.styles)))
    }
}()

const Templates = new class {
    get filters() {
        return {
            asset: (url) => {
                if (config.serve.mode === 'dev' && url.indexOf('/' + config.input.dir) === 0 || url.includes('https://') || url.includes('http://')) {
                    return url
                }

                if (config.serve.mode !== 'dev' && url.indexOf('/' + config.input.dir) === 0) {
                    url = url
                        .replace(`/${config.input.styles}`, `/${config.output.styles}`)
                        .replace(`/${config.input.scripts}`, `/${config.output.scripts}`)
                }

                url = url.replace(`/${config.output.dir}`, '')

                return url
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
            .on('end', () => Serve.reload(`${config.output.templates}/*.html`))
    }
}()

// Everything is loaded from input path with vite, only templates are being build from sources
gulp.task('serve', resolve => {
    const tasks = []

    config.serve.mode = 'dev'

    exists.templates && tasks.push('templates')

    tasks.push(() => Serve.init(config.serve), 'watch')

    gulp.series(tasks)(resolve)
})

// Everything is loaded from output path with vite, styles, scripts and templates are being build from sources
gulp.task('serve:build', resolve => {
    const tasks = []

    config.serve.mode = 'build'

    exists.scripts && tasks.push('scripts:build')
    exists.styles && tasks.push('styles:build')
    exists.templates && tasks.push('templates')

    tasks.push(() => Serve.init(config.serve), 'watch:build')

    gulp.series(tasks)(resolve)
})

gulp.task('scripts:build', () => Scripts.build())

gulp.task('styles:build', () => Styles.build())

gulp.task('templates', () => Templates.build())

gulp.task('watch', () => {
    if (exists.templates) {
        gulp.watch(`${config.root}/${config.input.templates}/**`, gulp.series('templates'))
    }
})

gulp.task('watch:build', () => {
    if (exists.scripts) {
        gulp.watch(`${config.root}/${config.input.scripts}/**`, gulp.series('scripts:build'))
    }

    if (exists.styles) {
        gulp.watch(`${config.root}/${config.input.styles}/**`, gulp.series('styles:build'))
    }

    if (exists.templates && exists.styles) {
        gulp.watch(`${config.root}/${config.input.templates}/**`, gulp.series('templates', 'styles:build'))
    } else {
        gulp.watch(`${config.root}/${config.input.templates}/**`, gulp.series('templates'))
    }
})
