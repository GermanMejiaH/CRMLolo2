export default [
  {
    files: ["src/**/*.{js,jsx}", "tests/**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly",
        fetch: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        Blob: "readonly",
        URL: "readonly",
        confirm: "readonly",
        isNaN: "readonly",
        parseFloat: "readonly",
        parseInt: "readonly"
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      }
    },
    rules: {
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }]
    }
  }
]
