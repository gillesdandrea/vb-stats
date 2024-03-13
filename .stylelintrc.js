/** @type {import('stylelint').Config} */
const config = {
  extends: ['stylelint-config-standard-scss', 'stylelint-config-clean-order/error'],
  plugins: ['stylelint-order'],
};

export default config;
