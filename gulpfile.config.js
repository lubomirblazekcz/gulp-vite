import postcssImport from 'postcss-import'
import postcssNesting from 'postcss-nesting'
import autoprefixer from 'autoprefixer'
import tailwindcss from 'tailwindcss'
import tailwindcssNesting from 'tailwindcss/nesting/index.js'

export default {
    styles: {
        postcss: [postcssImport, tailwindcssNesting(postcssNesting), tailwindcss, autoprefixer]
    }
}
