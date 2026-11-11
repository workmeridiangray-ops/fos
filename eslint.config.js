import globals from "globals";
export default [
  { ignores: ["node_modules/**", "dist/**", "data/**"] },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node,
    },
    rules: {
      "no-undef": "error",
      "no-unreachable": "error",
      "no-dupe-args": "error",
      "no-dupe-keys": "error",
      "constructor-super": "error",
    },
  },
  { files: ["public/*.js"], languageOptions: { globals: globals.browser } },
];
