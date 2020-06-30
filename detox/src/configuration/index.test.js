jest.mock('../utils/argparse');

const _ = require('lodash');
const os = require('os');
const path = require('path');
const DetoxConfigErrorBuilder = require('../errors/DetoxConfigErrorBuilder');

describe('composeDetoxConfig', () => {
  let args;
  let configuration;
  let detoxConfig;
  let deviceConfig;
  let userParams;

  /** @type {DetoxConfigErrorBuilder} */
  let errorBuilder;

  beforeEach(() => {
    errorBuilder = new DetoxConfigErrorBuilder();

    args = {};
    detoxConfig = {};
    deviceConfig = {};
    userParams = undefined;

    require('../utils/argparse').getArgValue.mockImplementation(key => args[key]);
    configuration = require('./index');
  });

  describe('composeDetoxConfig', () => {
    it('should throw an error if no config is found in package.json', async () => {
      await expect(configuration.composeDetoxConfig({})).rejects.toThrowError(
        /external .detoxrc.json configuration/
      );
    });

    it('should throw an error if empty config is found at path', async () => {
      await expect(configuration.composeDetoxConfig({
        argv: {
          'config-path': path.join(__dirname, '__mocks__/configuration/priority/empty.js'),
        },
      })).rejects.toThrowError(/no device configurations/);
    });

    it('should throw an error if no config is found at all', async () => {
      await expect(configuration.composeDetoxConfig({
        cwd: os.homedir(),
      })).rejects.toThrowError(errorBuilder.noConfigurationSpecified());
    });

    it('should return a complete Detox config merged with the file configuration', async () => {
      const config = await configuration.composeDetoxConfig({
        cwd: path.join(__dirname, '__mocks__/configuration/packagejson'),
        argv: {
          configuration: 'another',
          'device-name': 'iPhone XS',
          cleanup: true,
          reuse: true,
          'record-logs': 'all',
          'runner-config': 'e2e/.mocharc.js',
        },
        userParams: {
          initGlobals: false,
          launchApp: false,
        },
        override: {
          artifacts: {
            pathBuilder: class {
              constructor() {
                this.testProperty = 42;
              }
            },
            plugins: {
              log: 'none',
              video: 'failing',
            },
          },
          configurations: {
            another: {
              type: 'ios.simulator',
              device: 'iPhone X',
            },
          },
        }
      });

      expect(config).toMatchObject({
        errorBuilder: {
          configurationName: 'another',
          filepath: path.join(__dirname, '__mocks__/configuration/packagejson/package.json'),
        },
        artifactsConfig: {
          pathBuilder: {
            testProperty: 42,
          },
          plugins: {
            log: {
              enabled: true,
              keepOnlyFailedTestsArtifacts: false,
            },
            video: {
              enabled: true,
              keepOnlyFailedTestsArtifacts: true,
            },
          },
        },
        behaviorConfig: {
          init: {
            exposeGlobals: false,
            launchApp: false,
            reinstallApp: false,
          },
          cleanup: {
            shutdownDevice: true,
          }
        },
        cliConfig: {
          configuration: 'another',
          deviceName: 'iPhone XS',
          cleanup: true,
          reuse: true,
          recordLogs: 'all',
          runnerConfig: 'e2e/.mocharc.js',
        },
        deviceConfig: expect.objectContaining({
          type: 'ios.simulator',
          device: 'iPhone XS',
        }),
        runnerConfig: {
          testRunner: 'mocha',
          runnerConfig: 'e2e/.mocharc.js',
        },
        sessionConfig: expect.objectContaining({
          server: 'ws://localhost:9999',
          sessionId: 'external file works',
        }),
      });
    });
  });
});