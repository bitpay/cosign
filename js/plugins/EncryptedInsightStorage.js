var cryptoUtil = require('../util/crypto');
var InsightStorage = require('./InsightStorage');
var inherits = require('inherits');

function EncryptedInsightStorage(config) {
  InsightStorage.apply(this, [config]);
}
inherits(EncryptedInsightStorage, InsightStorage);

EncryptedInsightStorage.prototype.getItem = function(name, callback) {
  var key = cryptoUtil.kdf(this.password + this.email,null, 100);
  InsightStorage.prototype.getItem.apply(this, [name,
    function(err, body) {
      if (err) {
        return callback(err);
      }
      var decryptedJson = cryptoUtil.decrypt(key, body);
      if (!decryptedJson) {
        return callback('PNOTFOUND');
      }
      return callback(null, decryptedJson);
    }
  ]);
};

EncryptedInsightStorage.prototype.setItem = function(name, value, callback) {
  var key = cryptoUtil.kdf(this.password + this.email, null, 100);
  var record = cryptoUtil.encrypt(key, value);
  InsightStorage.prototype.setItem.apply(this, [name, record, callback]);
};

EncryptedInsightStorage.prototype.removeItem = function(name, callback) {
  var key = cryptoUtil.kdf(this.password + this.email, null,100);
  InsightStorage.prototype.removeItem.apply(this, [name, callback]);
};

module.exports = EncryptedInsightStorage;
