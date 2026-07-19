import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '..',
  testRegex: '.e2e-spec\\.ts$',
  testTimeout: 120000,
};

export default config;
