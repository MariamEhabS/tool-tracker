// babel.config.js
const ReactCompilerConfig = {
  /* ... */
};

module.exports = function () {
  return {
    plugins: [["babel-plugin-react-compiler", ReactCompilerConfig]],
  };
};
