const path = require('path');
module.exports = {
    webpack: (config, options, webpack) => {
        config.entry.main = [
            path.join(__dirname, './src/index.ts'),
        ];
        // config.devtool = process.env.NODE_ENV === 'development';
        config.mode = process.env.NODE_ENV === 'development' ? 'development' : 'production';
        config.resolve = {
            extensions: [".ts", ".js", ".json"]
        };
        config.module.rules.push({
            test: /\.ts$/,
            loader: 'awesome-typescript-loader',
            options: {
                sourceMap: true,
                productionSourceMap: false,
            }
        });
        if (process.env.NODE_ENV === 'production') {
            //config.productionSourceMap = false;
            config.plugins.slice(1, 1);
        }
        return config
    }
};