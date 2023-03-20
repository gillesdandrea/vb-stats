module.exports = {
  printWidth: 120,
  singleQuote: true,
  trailingComma: 'all',
  overrides: [
    {
      files: '.*rc',
      options: {
        parser: 'json',
      },
    },
  ],
};
