/** @type {import('stylelint').Config} */
const config = {
  extends: [
    'stylelint-config-standard-scss',
    'stylelint-config-clean-order/error',
    'stylelint-prettier/recommended',
    'stylelint-config-prettier-scss',
  ],
  rules: {
    'prettier/prettier': true,
  },
};

export default config;
