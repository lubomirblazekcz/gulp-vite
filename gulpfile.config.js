import postcssImport from "postcss-import";
import postcssNesting from "postcss-nesting";
import autoprefixer from "autoprefixer";

export default {
    styles: {
        postcss: [postcssImport, postcssNesting, autoprefixer]
    }
}