
var imports     = require('soop').imports();
var EventEmitter= imports.EventEmitter || require('events').EventEmitter;
var bitcore     = require('bitcore');
var util        = bitcore.util;
var Key         = bitcore.Key;
/*
 * Emits
 *  'networkChange'
 *    when network layout has change (new/lost peers, etc)
 *
 *  'data'
 *    when an unknown data type arrives
 *
 * Provides
 *
 */

function Network(opts) {
  var self = this;
  opts                = opts || {};
  this.peerId         = opts.peerId;
  this.apiKey         = opts.apiKey || 'lwjd5qra8257b9';
  this.debug          = opts.debug || 3;
  this.maxPeers       = opts.maxPeers || 10;
  this.opts = { key: opts.key };
  this.connections = {};
  this.copayerForPeer = {};

  // For using your own peerJs server
  ['port', 'host', 'path', 'debug'].forEach(function(k) {
    if (opts[k]) self.opts[k]=opts[k];
  });
  this.connectedPeers = [];
  this.started = false;
}

Network.parent=EventEmitter;

// Array helpers
Network._arrayDiff = function(a, b) {
  var seen = [];
  var diff = [];

  for (var i = 0; i < b.length; i++)
    seen[b[i]] = true;

  for (var j = 0; j < a.length; j++)
    if (!seen[a[j]])
      diff.push(a[j]);

  return diff;
};

Network._inArray = function(el, array) {
  return array.indexOf(el) > -1;
};

Network._arrayPushOnce = function(el, array) {
  var ret = false;
  if (!Network._inArray(el, array)) {
    array.push(el);
    ret = true;
  }
  return ret;
};

Network._arrayRemove = function(el, array) {
  var pos = array.indexOf(el);
  if (pos >= 0) array.splice(pos, 1);
  return array;
};


Network.prototype.connectedCopayers = function() {
  var ret =[];
  for(var i in this.connectedPeers){
    var copayerId =this.copayerForPeer[this.connectedPeers[i]];
    if (copayerId) ret.push(copayerId);
  }
  return ret;
};

Network.prototype._onClose = function(peerId) {
  delete this.connections[peerId];
  this.connectedPeers = Network._arrayRemove(peerId, this.connectedPeers);
  this._notifyNetworkChange();
};

Network.prototype._connectToCopayers = function(copayerIds) {
  var self = this;
  var arrayDiff= Network._arrayDiff(copayerIds, this.connectedCopayers());
  arrayDiff.forEach(function(copayerId) {
    console.log('### CONNECTING TO:', copayerId);
    self.connectTo(copayerId);
  });
};

Network.prototype._sendHello = function(copayerId) {
  console.log('#### SENDING HELLO TO ', copayerId);
  this.send(copayerId, {
    type: 'hello',
    copayerId: this.copayerId,
  });
};

Network.prototype._sendCopayers = function(copayerIds) {
  console.log('#### SENDING PEER LIST: ', this.connectedPeers,this.connectedCopayers(), ' TO ', copayerIds?copayerIds: 'ALL');
  this.send(copayerIds, {
    type: 'copayers',
    copayers: this.connectedCopayers(),
  });
};

Network.prototype._addCopayer = function(copayerId, isInbound) {
  var peerId = this.peerFromCopayer(copayerId);
  this._addCopayerMap(peerId,copayerId);
  var hasChanged = Network._arrayPushOnce(peerId, this.connectedPeers);
  if (isInbound && hasChanged) {
    this._sendCopayers();              //broadcast peer list
  }
  else {
    if (isInbound) {
      this._sendCopayers(copayerId);
    }
  }
};

Network.prototype._onData = function(data, isInbound, peerId) {
  var sig, payload;
  try { 
    var dataObj = JSON.parse(data);
    sig = dataObj.sig;
    payload= dataObj.payload;

  } catch (e) {
    console.log('### ERROR ON DATA: "%s" ', data, isInbound, e); 
    return;
  };

  console.log('### RECEIVED INBOUND?:%s TYPE: %s FROM %s: sig:%s', 
              isInbound, payload.type, peerId, sig, payload); 
  var self=this;

  // TODO _func
  if(payload.type === 'hello') {
    var thisSig = this._sign(payload, this.copayerId);
    if (thisSig !== sig) {
      console.log('#### Peer sent WRONG hello. Closing connection.');
      return;
    }
    console.log('#### Peer sent signed hello. Setting it up.'); //TODO
    this._addCopayer(payload.copayerId, isInbound);
    this._notifyNetworkChange( isInbound ? payload.copayerId : null);
    this.emit('open');
    return;
  }

  if (!this.copayerForPeer[peerId]) {
    console.log('### Discarting message from unknow peer: ', peerId); //TODO
    return;
  }

  // check sig
  if (this.copayerForPeer[peerId]) {
    var copayerIdBuf = new Buffer(this.copayerForPeer[peerId],'hex');
    if (!bitcore.Message.verifyWithPubKey( copayerIdBuf, JSON.stringify(payload), 
      new Buffer(sig,'hex'))) {

      console.log('[WebRTC.js.152] SIGNATURE VERIFICATION FAILED!!'); //TODO
      // TODO close connection
      return;
    }
  }
  
  switch(payload.type) {
    case 'copayers':
      this._addCopayer(this.copayerForPeer[peerId], false);
      this._connectToCopayers(payload.copayers);
      this._notifyNetworkChange();
      break;
    case 'disconnect':
      this._onClose(peerId);
      break;
    default:
      this.emit('data', self.copayerForPeer[peerId], payload, isInbound);
  }
};



Network.prototype._checkAnyPeer = function() {
  if (!this.connectedPeers.length) {
    console.log('EMIT openError: no more peers, not even you!'); 
    this._cleanUp();
    this.emit('openError');
  }
}

Network.prototype._setupConnectionHandlers = function(dataConn, isInbound) {
  var self=this;

  dataConn.on('open', function() {
    if (!Network._inArray(dataConn.peer, self.connectedPeers)
        && !  self.connections[dataConn.peer]) {

      self.connections[dataConn.peer] = dataConn;

      console.log('### DATA CONNECTION READY: %s (inbound: %s) AUTHENTICATING...',
        dataConn.peer, isInbound);

      // The connection peer send hello (with signature)
      if(!isInbound) 
        self._sendHello(self.copayerForPeer[dataConn.peer]);      
    }
  });

  dataConn.on('data', function(data) { 
    self._onData(data, isInbound, dataConn.peer);
  });

  dataConn.on('error', function(e) {
    console.log('### DATA ERROR',e ); //TODO
    self._onClose(dataConn.peer);
    self._checkAnyPeer();
    self.emit('dataError');
  });

  dataConn.on('close', function() {
    if (self.closing) return;

    console.log('### CLOSE RECV FROM:', dataConn.peer); 
    self._onClose(dataConn.peer);
    self._checkAnyPeer();
  });
};

Network.prototype._notifyNetworkChange = function(newCopayerId) {
  console.log('[WebRTC.js.164:_notifyNetworkChange:]', newCopayerId); //TODO
  this.emit('networkChange', newCopayerId);
};

Network.prototype._setupPeerHandlers = function(openCallback) {
  var self=this;
  var p = this.peer;

  p.on('open', function() {
    self.connectedPeers = [self.peerId];
    self.copayerForPeer[self.peerId]= self.copayerId;

    return openCallback();
  });

  p.on('error', function(err) {
    if (!err.message.match(/Could\snot\sconnect\sto peer/)) {
      console.log('### PEER ERROR:', err);
    }
    self._checkAnyPeer();
  });


  p.on('connection', function(dataConn) {
    console.log('### NEW INBOUND CONNECTION %d/%d', self.connectedPeers.length, self.maxPeers);
    if (self.connectedPeers.length >= self.maxPeers) {
      console.log('### PEER REJECTED. PEER MAX LIMIT REACHED');
      dataConn.on('open', function() {
        console.log('###  CLOSING CONN FROM:' + dataConn.peer);
        dataConn.close();
      });
    }
    else {
      self._setupConnectionHandlers(dataConn, true);
    }
  });
};


Network.prototype._addCopayerMap = function(peerId, copayerId) {
  if (!this.copayerForPeer[peerId]) {
    console.log('ADDING COPAYER MAPPING: %s => %s', peerId, copayerId); //TODO
    this.copayerForPeer[peerId]=copayerId;
  }
};

Network.prototype.setCopayerId = function(copayerId) {
  if (this.started) {
    throw new Error ('network already started: can not change peerId')
  }
  this.copayerId = copayerId;
  this.copayerIdBuf = new Buffer(copayerId,'hex');
  this.peerId = this.peerFromCopayer(this.copayerId);
  this._addCopayerMap(this.peerId,copayerId);
};


Network.prototype.setSigningKey = function(keyHex) {
  if (this.started || this.signingKey) {
    throw new Error ('network already started or key assigned: can not change key')
  }
  var k = new Key();
  k.private = new Buffer(keyHex,'hex');
  k.regenerateSync();
  this.signingKey = k;
};

Network.prototype.peerFromCopayer = function(hex) {
  return util.sha256(new Buffer(hex,'hex')).toString('hex');
};

Network.prototype.start = function(opts, openCallback) {
  opts = opts || {};
  var self = this;
  if (this.started)  return openCallback();
  opts.connectedPeers = opts.connectedPeers || [];

  if (!this.copayerId)
    this.setCopayerId(opts.copayerId);
  if (!this.signingKey)
    this.setSigningKey(opts.signingKeyHex);

  console.log('CREATING PEER INSTANCE:', this.peerId); //TODO
  this.peer = new Peer(this.peerId, this.opts);
  this._setupPeerHandlers(openCallback);
  for (var i = 0; i<opts.connectedPeers.length; i++) {
    var otherPeerId = opts.connectedPeers[i];
    this.connectTo(otherPeerId);
  }
  this.started = true;
};


Network.prototype._sign = function(payload, copayerId) {
  var ret='';
  var str = JSON.stringify(payload);
  if (payload.type ==='hello') {
    ret = (
      util.sha512hmac(
      new Buffer(str), 
      new Buffer(copayerId,'hex')
    )).toString('hex');
  }
  else {
    if (!this.signingKey)
      throw new Error ('no key to sign messages :(');
    ret = bitcore.Message.sign(
      str, 
      this.signingKey
    ).toString('hex');
  }
  return ret;
};

Network.prototype._sendToOne = function(copayerId, payload, cb) {
  var peerId = this.peerFromCopayer(copayerId);
  if (peerId !== this.peerId) {
    var dataConn = this.connections[peerId];
    if (dataConn) {
      var str = JSON.stringify({
        sig: this._sign(payload, copayerId),
        payload: payload 
      });
      dataConn.send(str);
    }
    else {
      console.log('[WebRTC.js.255] WARN: NO CONNECTION TO:', peerId); //TODO
    }
  }
  if (typeof cb === 'function') cb();
};

Network.prototype.send = function(copayerIds, payload, cb) {
  var self=this;
  if (!copayerIds) {
    copayerIds = this.connectedCopayers();
    payload.isBroadcast = 1;
  }

  if (Array.isArray(copayerIds)) {
    var l = copayerIds.length;
    var i = 0;
    copayerIds.forEach(function(copayerId) {
      self._sendToOne(copayerId, payload, function () {
        if (++i === l && typeof cb === 'function') cb();
      });
    });
  }
  else if (typeof copayerIds === 'string')
    self._sendToOne(copayerIds, payload, cb);
};

Network.prototype.connectTo = function(copayerId) {
  var self = this;
  var peerId = this.peerFromCopayer(copayerId);
  this._addCopayerMap(peerId,copayerId);

  console.log('### STARTING CONNECTION TO:', peerId, copayerId);
  var dataConn = this.peer.connect(peerId, {
    serialization: 'none',
    reliable: true,
  });

  self._setupConnectionHandlers(dataConn, false);
};

Network.prototype._cleanUp = function() {
  var self = this;
  self.connectedPeers = [];
  self.started = false;
  self.peerId = null;
  self.copayerId = null;
  self.signingKey = null;
  if (self.peer) {
    console.log('## DESTROYING PEER INSTANCE'); //TODO
    self.peer.disconnect();
    self.peer.destroy();
    self.peer = null;
  }
  self.closing = 0;
};


Network.prototype.disconnect = function(cb, forced) {
  var self = this;
  self.closing = 1;
  self.send(null, { type: 'disconnect' }, function(){
    self._cleanUp();
    if (typeof cb === 'function') cb();
  });
};

module.exports = require('soop')(Network);
