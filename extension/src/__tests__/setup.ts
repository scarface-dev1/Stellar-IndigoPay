/**
 * Jest setup file for extension tests
 * Mocks Chrome extension APIs
 */

// Mock Chrome storage API
const mockStorage: Record<string, any> = {};

const mockChrome = {
  storage: {
    sync: {
      get: jest.fn((defaults, callback) => {
        const result = { ...defaults };
        Object.keys(defaults).forEach((key) => {
          if (mockStorage[key] !== undefined) {
            result[key] = mockStorage[key];
          }
        });
        callback(result);
      }),
      set: jest.fn((items, callback) => {
        Object.assign(mockStorage, items);
        callback?.();
      }),
    },
    local: {
      get: jest.fn((keys, callback) => {
        const result: Record<string, any> = {};
        const keyList = Array.isArray(keys) ? keys : [keys];
        keyList.forEach((key) => {
          if (mockStorage[key] !== undefined) {
            result[key] = mockStorage[key];
          }
        });
        callback(result);
      }),
      set: jest.fn((items, callback) => {
        Object.assign(mockStorage, items);
        callback?.();
      }),
      remove: jest.fn((keys, callback) => {
        const keyList = Array.isArray(keys) ? keys : [keys];
        keyList.forEach((key) => {
          delete mockStorage[key];
        });
        callback?.();
      }),
    },
    onChanged: {
      addListener: jest.fn(),
    },
  },
  runtime: {
    sendMessage: jest.fn((message, callback) => {
      callback?.({ success: true });
    }),
    onMessage: {
      addListener: jest.fn(),
    },
    lastError: null,
  },
  action: {
    setBadgeText: jest.fn().mockResolvedValue(undefined),
    setBadgeBackgroundColor: jest.fn().mockResolvedValue(undefined),
  },
  tabs: {
    query: jest.fn((options, callback) => {
      callback([{ id: 1 }]);
    }),
    sendMessage: jest.fn((tabId, message, callback) => {
      callback?.({ publicKey: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW' });
    }),
  },
  contextMenus: {
    create: jest.fn(),
    update: jest.fn((id, options, callback) => callback?.()),
    onClicked: {
      addListener: jest.fn(),
    },
  },
};

// @ts-ignore
global.chrome = mockChrome;

// Reset storage between tests
beforeEach(() => {
  Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
  jest.clearAllMocks();
});

export { mockChrome, mockStorage };
