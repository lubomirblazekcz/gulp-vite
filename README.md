<a href="https://npmjs.com/package/gulp-vite"><img src="https://img.shields.io/npm/v/gulp-vite.svg" alt="npm package"></a>
<a href="https://nodejs.org/en/about/releases/"><img src="https://img.shields.io/node/v/gulp-vite.svg" alt="node compatility"></a>

# 🥤 gulp-vite

Vite build system may not suit everyone, because of limiting entry options

As an alternative approach you can build assets with gulp and use Vite as a powerful dev server

## Install into your project
```sh
npm i gulp-vite -D
```

```js
import vite from "gulp-vite";

gulp.task("serve", () => vite.init({
    output: "public", // default output path, from where your html files are served
    root: process.cwd(), // default root path
    ignored: [`**/src/templates/**`], // files to ignore with vite watch
    vite: {
        // your vite config goes here
        css: {
            postcss: {
                plugins: []
            }
        }
    }
}));
```

```js
// default vite configuration with gulp-vite, can be overwritten
{
    plugins: [this.plugin.middleware, this.plugin.reload],
        publicDir: path.join(options.root, options.output),
        server: {
        open: "/",
            host: true,
            fsServe: {
            strict: false
        },
        watch: {
            // default vite watch ignore files and additional files to ignore, reload for templates files is handled manually
            ignored: options.ignored.concat(['**/node_modules/**', '**/.git/**', `**/${options.output}/*.html`])
        }
    },
    root: options.root
}
```

```js
import vite from "gulp-vite";

vite.server // server instance
vite.options // vite options
vite.reload // force browser reload
vite.plugin.middleware // included plugin for middleware to translate paths from /page to /public/page.html
vite.plugin.reload // included plugin for publicDir reload
```

## Minimal example

On [Github](https://github.com/evromalarkey/gulp-vite) is minimal example where [Vite](https://vitejs.dev/) is used as web server and gulp for build with [Esbuild](https://esbuild.github.io/)

Vite and Esbuild can run any format you want - javascript, typescript, postcss, sass, less, stylus

This is a minimal starting example that can be extended as needed

```sh
npm i && npx gulp serve
```

```sh
npx gulp --tasks
```

### Requirements

- [Node.js LTS (14.x)](https://nodejs.org/en/download/) or current
- [NPM](https://www.npmjs.com/package/npm) or [Yarn](https://yarnpkg.com/)

## Licence
MIT