module.exports = {
  testEnvironment: "node",
  transform: { "^.+\\.(ts|tsx|js|jsx)$": "babel-jest" },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  testMatch: ["**/*.spec.ts", "**/*.spec.tsx", "**/*.test.ts", "**/*.test.tsx"],
  testPathIgnorePatterns: ["<rootDir>/e2e/"],
  moduleNameMapper: {
    "^@design/(.*)$": "<rootDir>/src/design/$1",
    "^@ui/(.*)$": "<rootDir>/src/components/ui/$1",
    "^@services/(.*)$": "<rootDir>/src/services/$1",
    "^@hooks/(.*)$": "<rootDir>/src/hooks/$1",
    "^@stores/(.*)$": "<rootDir>/src/stores/$1",
  },
};
