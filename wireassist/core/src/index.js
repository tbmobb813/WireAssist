'use strict';
// @lai/core/src/index.ts
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __exportStar =
  (this && this.__exportStar) ||
  function (m, exports) {
    for (var p in m)
      if (p !== 'default' && !Object.prototype.hasOwnProperty.call(exports, p))
        __createBinding(exports, m, p);
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.StreamParser =
  exports.ResponseBuffer =
  exports.StreamHandler =
  exports.ProviderFactory =
  exports.ConversationEncryption =
  exports.AuditLogger =
  exports.PrivacyController =
  exports.ContextBuilder =
  exports.SearchEngine =
  exports.SettingsStore =
  exports.MessageStore =
  exports.ConversationStore =
  exports.AIClient =
    void 0;
// Main client
var client_1 = require('./client');
Object.defineProperty(exports, 'AIClient', {
  enumerable: true,
  get: function () {
    return client_1.AIClient;
  },
});
// Storage
var storage_1 = require('./storage');
Object.defineProperty(exports, 'ConversationStore', {
  enumerable: true,
  get: function () {
    return storage_1.ConversationStore;
  },
});
Object.defineProperty(exports, 'MessageStore', {
  enumerable: true,
  get: function () {
    return storage_1.MessageStore;
  },
});
Object.defineProperty(exports, 'SettingsStore', {
  enumerable: true,
  get: function () {
    return storage_1.SettingsStore;
  },
});
Object.defineProperty(exports, 'SearchEngine', {
  enumerable: true,
  get: function () {
    return storage_1.SearchEngine;
  },
});
// Context building
var context_1 = require('./context');
Object.defineProperty(exports, 'ContextBuilder', {
  enumerable: true,
  get: function () {
    return context_1.ContextBuilder;
  },
});
// Privacy controls
var privacy_1 = require('./privacy');
Object.defineProperty(exports, 'PrivacyController', {
  enumerable: true,
  get: function () {
    return privacy_1.PrivacyController;
  },
});
Object.defineProperty(exports, 'AuditLogger', {
  enumerable: true,
  get: function () {
    return privacy_1.AuditLogger;
  },
});
Object.defineProperty(exports, 'ConversationEncryption', {
  enumerable: true,
  get: function () {
    return privacy_1.ConversationEncryption;
  },
});
// Provider types
var providers_1 = require('./providers');
Object.defineProperty(exports, 'ProviderFactory', {
  enumerable: true,
  get: function () {
    return providers_1.ProviderFactory;
  },
});
// Streaming
var streaming_1 = require('./streaming');
Object.defineProperty(exports, 'StreamHandler', {
  enumerable: true,
  get: function () {
    return streaming_1.StreamHandler;
  },
});
Object.defineProperty(exports, 'ResponseBuffer', {
  enumerable: true,
  get: function () {
    return streaming_1.ResponseBuffer;
  },
});
Object.defineProperty(exports, 'StreamParser', {
  enumerable: true,
  get: function () {
    return streaming_1.StreamParser;
  },
});
// NEW — WireAssist agent platform additions
__exportStar(require('./agents'), exports);
__exportStar(require('./memory'), exports);
__exportStar(require('./approval'), exports);
__exportStar(require('./mcp'), exports);
__exportStar(require('./events'), exports);
