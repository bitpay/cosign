
'use strict';


var imports     = require('soop').imports();
var bitcore     = require('bitcore');
var BIP32       = bitcore.BIP32;
var Address     = bitcore.Address;
var Script      = bitcore.Script;
var coinUtil    = bitcore.util;
var Transaction = bitcore.Transaction;
var buffertools = bitcore.buffertools;

var Storage     = imports.Storage || require('./Storage');
var storage     = Storage.default();


function PublicKeyRing(opts) {
  opts = opts || {};

  this.network = opts.networkName === 'livenet' ? 
      bitcore.networks.livenet : bitcore.networks.testnet;

  this.requiredCopayers = opts.requiredCopayers || 3;
  this.totalCopayers = opts.totalCopayers || 5;

  this.id = opts.id || PublicKeyRing.getRandomId();

  this.copayersBIP32 = [];

  this.changeAddressIndex=0;
  this.addressIndex=0;
}

/*
 * This follow Electrum convetion, as described in
 * https://bitcointalk.org/index.php?topic=274182.0
 *
 * We should probably adopt the next standard once it's ready, as discussed in:
 * http://sourceforge.net/p/bitcoin/mailman/message/32148600/
 *
 */

PublicKeyRing.PublicBranch = function (index) {
  return 'm/0/'+index;
};

PublicKeyRing.ChangeBranch = function (index) {
  return 'm/1/'+index;
};

PublicKeyRing.getRandomId = function () {
  var r = buffertools.toHex(coinUtil.generateNonce());
  return r;
};

PublicKeyRing.decrypt = function (passphrase, encPayload) {
  console.log('[wallet.js.35] TODO READ: passphrase IGNORED');
  return encPayload;
};

PublicKeyRing.encrypt = function (passphrase, payload) {
  console.log('[wallet.js.92] TODO: passphrase IGNORED');
  return payload;
};

PublicKeyRing.fromObj = function (data) {
  if (!data.ts) {
    throw new Error('bad data format: Did you use .toObj()?');
  }
  var config = { networkName: data.networkName || 'livenet' };

  var w = new PublicKeyRing(config);

  w.id               = data.id;
  w.requiredCopayers = data.requiredCopayers;
  w.totalCopayers = data.totalCopayers;
  w.addressIndex = data.addressIndex;
  w.changeAddressIndex = data.changeAddressIndex;

  w.copayersBIP32 = data.copayersExtPubKeys.map( function (pk) { 
    return new BIP32(pk);
  });

  w.ts = data.ts;
  return w;
};

PublicKeyRing.read = function (encPayload, id, passphrase) {
  if (!encPayload) 
    throw new Error('Could not find wallet data');
  var data;
  try {
    data = JSON.parse( PublicKeyRing.decrypt( passphrase, encPayload ));
  } catch (e) {
    throw new Error('error in read: '+ e.toString());
  }

  if (data.id !== id) 
    throw new Error('Wrong id in data');
  return PublicKeyRing.fromObj(data);
};

PublicKeyRing.prototype.toObj = function() {
  return {
    id: this.id,
    networkName: this.network.name,
    requiredCopayers: this.requiredCopayers,
    totalCopayers: this.totalCopayers,

    changeAddressIndex: this.changeAddressIndex,
    addressIndex: this.addressIndex,
    copayersExtPubKeys: this.copayersBIP32.map( function (b) { 
      return b.extendedPublicKeyString(); 
    }),
    ts: parseInt(Date.now() / 1000),
  };
};

PublicKeyRing.prototype.serialize = function () {
  return JSON.stringify(this.toObj());
};


PublicKeyRing.prototype.toStore = function (passphrase) {
  if (!this.id) 
      throw new Error('wallet has no id');

  return PublicKeyRing.encrypt(passphrase,this.serialize());
};

PublicKeyRing.prototype.registeredCopayers = function () {
  return this.copayersBIP32.length;
};



PublicKeyRing.prototype.isComplete = function () {
  return this.registeredCopayers() >= this.totalCopayers;
};

PublicKeyRing.prototype._checkKeys = function() {

  if (!this.isComplete())
      throw new Error('dont have required keys yet');
};


PublicKeyRing.prototype._newExtendedPublicKey = function () {
  return new BIP32(this.network.name)
    .extendedPublicKeyString();
};

PublicKeyRing.prototype.addCopayer = function (newEpk) {

  if (this.isComplete())
      throw new Error('already have all required key:' + this.totalCopayers);

  if (!newEpk) {
    newEpk = this._newExtendedPublicKey();
  }

  this.copayersBIP32.forEach(function(b){
    if (b.extendedPublicKeyString() === newEpk)
      throw new Error('already have that key');
  });

  this.copayersBIP32.push(new BIP32(newEpk));
  return newEpk;
};


PublicKeyRing.prototype.getPubKeys = function (index, isChange) {
  this._checkKeys();

  var pubKeys = [];
  var l = this.copayersBIP32.length;
  for(var i=0; i<l; i++) {
    var path = isChange ? PublicKeyRing.ChangeBranch(index) : PublicKeyRing.PublicBranch(index); 
    var bip32 = this.copayersBIP32[i].derive(path);
    pubKeys[i] = bip32.eckey.public;
  }

  return pubKeys;
};

PublicKeyRing.prototype._checkIndexRange = function (index, isChange) {
  if ( (isChange && index > this.changeAddressIndex) ||
      (!isChange && index > this.addressIndex)) {
    console.log('Out of bounds at getAddress: Index %d isChange: %d', index, isChange);
    throw new Error('index out of bound');
  }
};

PublicKeyRing.prototype.getRedeemScript = function (index, isChange) {
  this._checkIndexRange(index, isChange);

  var pubKeys = this.getPubKeys(index, isChange);
  var script  = Script.createMultisig(this.requiredCopayers, pubKeys);
  return script;
};


PublicKeyRing.prototype.getAddress = function (index, isChange) {
  this._checkIndexRange(index, isChange);

  var script  = this.getRedeemScript(index,isChange);
  var hash    = coinUtil.sha256ripe160(script.getBuffer());
  var version = this.network.P2SHVersion;
  var addr    = new Address(version, hash);
  return addr;
};

PublicKeyRing.prototype.getScriptPubKeyHex = function (index, isChange) {
  this._checkIndexRange(index, isChange);
  var addr  = this.getAddress(index,isChange);
  return Script.createP2SH(addr.payload()).getBuffer().toString('hex');
};



//generate a new address, update index.
PublicKeyRing.prototype.generateAddress = function(isChange) {

  var ret =  
    this.getAddress(isChange ? this.changeAddressIndex : this.addressIndex, isChange);
  if (isChange) 
    this.changeAddressIndex++;
  else 
    this.addressIndex++;

  return ret;

};

PublicKeyRing.prototype.getAddresses = function() {
  var ret = [];

  for (var i=0; i<this.changeAddressIndex; i++) {
    ret.push(this.getAddress(i,true));
  }

  for (var i=0; i<this.addressIndex; i++) {
    ret.push(this.getAddress(i,false));
  }
  return ret;
};

PublicKeyRing.prototype.getRedeemScriptMap = function () {
  var ret = {};

  for (var i=0; i<this.changeAddressIndex; i++) {
    ret[this.getAddress(i,true)] = this.getRedeemScript(i,true).getBuffer().toString('hex');
  }

  for (var i=0; i<this.addressIndex; i++) {
    ret[this.getAddress(i)] = this.getRedeemScript(i).getBuffer().toString('hex');
  }
  return ret;
};



PublicKeyRing.prototype._checkInPRK = function(inPKR, ignoreId) {

  if (!ignoreId  && this.id !== inPKR.id) {
    throw new Error('inPRK id mismatch');
  }

  if (this.network.name !== inPKR.network.name)
    throw new Error('inPRK network mismatch');

  if (
    this.requiredCopayers && inPKR.requiredCopayers &&
    (this.requiredCopayers !== inPKR.requiredCopayers))
    throw new Error('inPRK requiredCopayers mismatch');

  if (
    this.totalCopayers && inPKR.totalCopayers &&
    (this.totalCopayers !== inPKR.totalCopayers))
    throw new Error('inPRK requiredCopayers mismatch');
};


PublicKeyRing.prototype._mergeIndexes = function(inPKR) {
  var hasChanged = false;

  // Indexes
  if (inPKR.changeAddressIndex > this.changeAddressIndex) {
    this.changeAddressIndex = inPKR.changeAddressIndex;
    hasChanged = true;
  }

  if (inPKR.addressIndex > this.addressIndex) {
    this.addressIndex = inPKR.addressIndex;
    hasChanged = true;
  }
  return hasChanged;
};

PublicKeyRing.prototype._mergePubkeys = function(inPKR) {
  var self = this;
  var hasChanged = false;
  var l= self.copayersBIP32.length;

  inPKR.copayersBIP32.forEach( function(b) {
    var haveIt = false;
    var epk = b.extendedPublicKeyString(); 
    for(var j=0; j<l; j++) {
      if (self.copayersBIP32[j].extendedPublicKeyString() === epk) {
        haveIt=true;
        break;
      }
    }
    if (!haveIt) {
      if (self.isComplete()) {
        console.log('[PublicKeyRing.js.318] REPEATED KEY', epk); //TODO
        throw new Error('trying to add more pubkeys, when PKR isComplete at merge');
      }
      self.copayersBIP32.push(new BIP32(epk));
      hasChanged=true;
    }
  });
  return hasChanged;
};

PublicKeyRing.prototype.merge = function(inPKR, ignoreId) {
  var hasChanged = false;

  this._checkInPRK(inPKR, ignoreId);

  if (this._mergeIndexes(inPKR))
    hasChanged = true;

  if (this._mergePubkeys(inPKR))
    hasChanged = true;

  return hasChanged;
};

module.exports = require('soop')(PublicKeyRing);
