export default {
  extends: ["stylelint-config-recommended"],
  rules: {
    // The stylesheet groups related selectors for readability; source order
    // does not affect the cascade here.
    "no-descending-specificity": null,
  },
};
