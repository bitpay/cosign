'use strict';

var chai = chai || require('chai');
var should = chai.should();
var sinon = require('sinon');
try {
  var copay = require('copay'); //browser
} catch (e) {
  var copay = require('../copay'); //node
}
var copayConfig = require('../config');
var Wallet = require('../js/models/core/Wallet');
var Structure = copay.Structure;
var Storage = require('./mocks/FakeStorage');
var Network = require('./mocks/FakeNetwork');
var Blockchain = require('./mocks/FakeBlockchain');
var bitcore = bitcore || require('bitcore');
var TransactionBuilder = bitcore.TransactionBuilder;

var addCopayers = function(w) {
  for (var i = 0; i < 4; i++) {
    w.publicKeyRing.addCopayer();
  }
};

describe('Wallet model', function() {

  var config = {
    requiredCopayers: 3,
    totalCopayers: 5,
    spendUnconfirmed: true,
    reconnectDelay: 100,
    networkName: 'testnet',
  };

  it('should fail to create an instance', function() {
    (function() {
      new Wallet(config)
    }).should.
    throw();
  });
  it('should getNetworkName', function() {
    var w = cachedCreateW();
    w.getNetworkName().should.equal('testnet');
  });


  var createW = function(netKey, N, conf) {

    var c = JSON.parse(JSON.stringify(conf || config));
    if (!N) N = c.totalCopayers;

    if (netKey) c.netKey = netKey;
    var mainPrivateKey = new copay.PrivateKey({
      networkName: config.networkName
    });
    var mainCopayerEPK = mainPrivateKey.deriveBIP45Branch().extendedPublicKeyString();
    c.privateKey = mainPrivateKey;

    c.publicKeyRing = new copay.PublicKeyRing({
      networkName: c.networkName,
      requiredCopayers: Math.min(N, c.requiredCopayers),
      totalCopayers: N,
    });
    c.publicKeyRing.addCopayer(mainCopayerEPK);

    c.txProposals = new copay.TxProposals({
      networkName: c.networkName,
    });

    var storage = new Storage(config.storage);
    var network = new Network(config.network);
    var blockchain = new Blockchain(config.blockchain);
    c.storage = storage;
    c.network = network;
    c.blockchain = blockchain;

    c.addressBook = {
      '2NFR2kzH9NUdp8vsXTB4wWQtTtzhpKxsyoJ': {
        label: 'John',
        copayerId: '026a55261b7c898fff760ebe14fd22a71892295f3b49e0ca66727bc0a0d7f94d03',
        createdTs: 1403102115,
        hidden: false
      },
      '2MtP8WyiwG7ZdVWM96CVsk2M1N8zyfiVQsY': {
        label: 'Jennifer',
        copayerId: '032991f836543a492bd6d0bb112552bfc7c5f3b7d5388fcbcbf2fbb893b44770d7',
        createdTs: 1403103115,
        hidden: false
      }
    };

    c.networkName = config.networkName;
    c.verbose = config.verbose;
    c.version = '0.0.1';

    return new Wallet(c);
  }

  var cachedW = null;
  var cachedWobj = null;
  var cachedCreateW = function() {
    if (!cachedW) {
      cachedW = createW();
      cachedWobj = cachedW.toObj();
      cachedWobj.opts.reconnectDelay = 100;
    }
    var w = Wallet.fromObj(cachedWobj, cachedW.storage, cachedW.network, cachedW.blockchain);
    return w;
  };

  it('should create an instance', function() {
    var w = cachedCreateW();
    should.exist(w);
    w.publicKeyRing.walletId.should.equal(w.id);
    w.txProposals.walletId.should.equal(w.id);
    w.requiredCopayers.should.equal(3);
    should.exist(w.id);
    should.exist(w.publicKeyRing);
    should.exist(w.privateKey);
    should.exist(w.txProposals);
    should.exist(w.addressBook);
  });

  it('should provide some basic features', function(done) {
    var opts = {};
    var w = cachedCreateW();
    addCopayers(w);
    w.publicKeyRing.generateAddress(false, w.publicKey);
    w.publicKeyRing.isComplete().should.equal(true);
    w.generateAddress(true).isValid().should.equal(true);
    w.generateAddress(true, function(addr) {
      addr.isValid().should.equal(true);
      done();
    });
  });

  var unspentTest = [{
    "address": "dummy",
    "scriptPubKey": "dummy",
    "txid": "2ac165fa7a3a2b535d106a0041c7568d03b531e58aeccdd3199d7289ab12cfc1",
    "vout": 1,
    "amount": 10,
    "confirmations": 7
  }];

  var createW2 = function(privateKeys, N, conf) {
    if (!N) N = 3;
    var netKey = 'T0FbU2JLby0=';
    var w = createW(netKey, N, conf);
    should.exist(w);

    var pkr = w.publicKeyRing;

    for (var i = 0; i < N - 1; i++) {
      if (privateKeys) {
        var k = privateKeys[i];
        pkr.addCopayer(k ? k.deriveBIP45Branch().extendedPublicKeyString() : null);
      } else {
        pkr.addCopayer();
      }
    }

    return w;
  };

  var cachedW2 = null;
  var cachedW2obj = null;
  var cachedCreateW2 = function() {
    if (!cachedW2) {
      cachedW2 = createW2();
      cachedW2obj = cachedW2.toObj();
      cachedW2obj.opts.reconnectDelay = 100;
    }
    var w = Wallet.fromObj(cachedW2obj, cachedW2.storage, cachedW2.network, cachedW2.blockchain);
    return w;
  };

  it('#create, fail for network', function() {

    var w = cachedCreateW2();

    unspentTest[0].address = w.publicKeyRing.getAddress(1, true).toString();
    unspentTest[0].scriptPubKey = w.publicKeyRing.getScriptPubKeyHex(1, true);

    var f = function() {
      var ntxid = w.createTxSync(
        '15q6HKjWHAksHcH91JW23BJEuzZgFwydBt',
        '123456789',
        null,
        unspentTest
      );
    };
    f.should.throw(Error);
  });

  it('#create, 1 sign', function() {

    var w = cachedCreateW2();

    unspentTest[0].address = w.publicKeyRing.getAddress(1, true, w.publicKey).toString();
    unspentTest[0].scriptPubKey = w.publicKeyRing.getScriptPubKeyHex(1, true, w.publicKey);

    var ntxid = w.createTxSync(
      'mgGJEugdPnvhmRuFdbdQcFfoFLc1XXeB79',
      '123456789',
      null,
      unspentTest
    );

    var t = w.txProposals;
    var txp = t.txps[ntxid];
    var tx = txp.builder.build();
    should.exist(tx);
    chai.expect(txp.comment).to.be.null;
    tx.isComplete().should.equal(false);
    Object.keys(txp.seenBy).length.should.equal(1);
    Object.keys(txp.signedBy).length.should.equal(1);
  });

  it('#create with comment', function() {

    var w = cachedCreateW2();
    var comment = 'This is a comment';

    unspentTest[0].address = w.publicKeyRing.getAddress(1, true, w.publicKey).toString();
    unspentTest[0].scriptPubKey = w.publicKeyRing.getScriptPubKeyHex(1, true, w.publicKey);

    var ntxid = w.createTxSync(
      'mgGJEugdPnvhmRuFdbdQcFfoFLc1XXeB79',
      '123456789',
      comment,
      unspentTest
    );

    var t = w.txProposals;
    var txp = t.txps[ntxid];
    var tx = txp.builder.build();
    should.exist(tx);
    txp.comment.should.equal(comment);
  });

  it('#create throw exception on long comment', function() {

    var w = cachedCreateW2();
    var comment = 'Lorem ipsum dolor sit amet, suas euismod vis te, velit deleniti vix an. Pri ex suscipit similique, inermis per';

    unspentTest[0].address = w.publicKeyRing.getAddress(1, true, w.publicKey).toString();
    unspentTest[0].scriptPubKey = w.publicKeyRing.getScriptPubKeyHex(1, true, w.publicKey);

    var badCreate = function() {
      w.createTxSync(
        'mgGJEugdPnvhmRuFdbdQcFfoFLc1XXeB79',
        '123456789',
        comment,
        unspentTest
      );
    }

    chai.expect(badCreate).to.throw(Error);
  });

  it('#addressIsOwn', function() {
    var w = cachedCreateW2();
    var l = w.getAddressesStr();
    for (var i = 0; i < l.length; i++)
      w.addressIsOwn(l[i]).should.equal(true);

    w.addressIsOwn(l[0], {
      excludeMain: true
    }).should.equal(false);

    w.addressIsOwn('mmHqhvTVbxgJTnePa7cfweSRjBCy9bQQXJ').should.equal(false);
    w.addressIsOwn('mgtUfP9sTJ6vPLoBxZLPEccGpcjNVryaCX').should.equal(false);
  });

  it('#create. Signing with derivate keys', function() {

    var w = cachedCreateW2();

    var ts = Date.now();
    for (var isChange = false; !isChange; isChange = true) {
      for (var index = 0; index < 3; index++) {
        unspentTest[0].address = w.publicKeyRing.getAddress(index, isChange, w.publicKey).toString();
        unspentTest[0].scriptPubKey = w.publicKeyRing.getScriptPubKeyHex(index, isChange, w.publicKey);
        w.createTxSync(
          'mgGJEugdPnvhmRuFdbdQcFfoFLc1XXeB79',
          '123456789',
          null,
          unspentTest
        );
        var t = w.txProposals;
        var k = Object.keys(t.txps)[0];
        var tx = t.txps[k].builder.build();
        should.exist(tx);
        tx.isComplete().should.equal(false);
        tx.countInputMissingSignatures(0).should.equal(2);

        (t.txps[k].signedBy[w.privateKey.getId()] - ts > 0).should.equal(true);
        (t.txps[k].seenBy[w.privateKey.getId()] - ts > 0).should.equal(true);
      }
    }
  });

  it('#fromObj #toObj round trip', function() {

    var w = cachedCreateW2();

    var o = w.toObj();
    o = JSON.parse(JSON.stringify(o));

    // non stored options
    o.opts.reconnectDelay = 100;

    var w2 = Wallet.fromObj(o,
      new Storage(config.storage),
      new Network(config.network),
      new Blockchain(config.blockchain));
    should.exist(w2);
    w2.publicKeyRing.requiredCopayers.should.equal(w.publicKeyRing.requiredCopayers);
    should.exist(w2.publicKeyRing.getCopayerId);
    should.exist(w2.txProposals.toObj);
    should.exist(w2.privateKey.toObj);
  });

  it('#getSecret decodeSecret', function() {
    var w = cachedCreateW2();
    var id = w.getMyCopayerId();

    var sb = w.getSecret();
    should.exist(sb);
    var s = Wallet.decodeSecret(sb);
    s.pubKey.should.equal(id);

  });
  it('decodeSecret check', function() {
    (function() {
      Wallet.decodeSecret('4fp61K187CsYmjoRQC5iAdC5eGmbCRsAAXfwEwetSQgHvZs27eWKaLaNHRoKM');
    }).should.not.
    throw();
    (function() {
      Wallet.decodeSecret('4fp61K187CsYmjoRQC5iAdC5eGmbCRsAAXfwEwetSQgHvZs27eWKaLaNHRoK');
    }).should.
    throw();
    (function() {
      Wallet.decodeSecret('12345');
    }).should.
    throw();
  });

  //this test fails randomly
  it.skip('call reconnect after interval', function(done) {
    this.timeout(10000);
    var w = cachedCreateW2();
    var spy = sinon.spy(w, 'scheduleConnect');
    var callCount = 3;
    w.netStart();
    setTimeout(function() {
      sinon.assert.callCount(spy, callCount);
      done();
    }, w.reconnectDelay * callCount * (callCount + 1) / 2);
  });

  it('#isReady', function() {
    var w = createW();
    w.publicKeyRing.isComplete().should.equal(false);
    w.isReady().should.equal(false);

    var w2 = createW2();
    w2.publicKeyRing.isComplete().should.equal(true);
    w2.isReady().should.equal(false);

    w2.publicKeyRing.copayersBackup = ["a", "b", "c"];
    w2.publicKeyRing.isFullyBackup().should.equal(true);
    w2.isReady().should.equal(true);
  });

  it('handle network indexes correctly', function() {
    var w = createW();
    var aiObj = {
      indexes: [{
        cosigner: 0,
        changeIndex: 3,
        receiveIndex: 2
      }]
    };
    w._handleIndexes('senderID', aiObj, true);
    w.publicKeyRing.getIndex(0).getReceiveIndex(2);
    w.publicKeyRing.getIndex(0).getChangeIndex(3);
  });

  it('handle network pubKeyRings correctly', function() {
    var w = createW();
    w.getNetworkName().should.equal('testnet');
    var cepk = [
      w.publicKeyRing.toObj().copayersExtPubKeys[0],
      'tpubDEqHs8LoCB1MDfXs1y2WaLJqPkKsgt8mDoQUFsQ4aKHvho5oFJkF7UrZnfFXKMhA1MuVPwq8a5VhFHvCquYcCVHeCrW4ZCWoDDE9K95e8rP',
      'tpubDEqHs8LoCB1MGGKRyouphPdFNNuay5PBzCuJkgDSiWeAST8m7y4nwPZ7M27mUNWLLPDp6n8kp4P57sd8xHXNnZvap8PxWrUMvXzkxFNgCh7',
    ];
    var pkrObj = {
      walletId: w.id,
      networkName: w.networkName,
      requiredCopayers: w.requiredCopayers,
      totalCopayers: w.totalCopayers,
      indexes: [{
        cosigner: 0,
        changeIndex: 2,
        receiveIndex: 3
      }],
      copayersExtPubKeys: cepk,
      nicknameFor: {},
    };
    w._handlePublicKeyRing('senderID', {
      publicKeyRing: pkrObj
    }, true);
    w.publicKeyRing.getIndex(0).getReceiveIndex(2);
    w.publicKeyRing.getIndex(0).getChangeIndex(3);
    for (var i = 0; i < w.requiredCopayers; i++) {
      w.publicKeyRing.toObj().copayersExtPubKeys[i].should.equal(cepk[i]);
    }
  });

  it('handle network txProposals correctly', function() {
    var w = createW();
    var txp = {
      'txProposal': {
        "seenBy": {
          "undefined": 1402337282806
        },
        "signedBy": {
          "undefined": 1402337282841
        },
        "rejectedBy": {},
        "sentTs": null,
        "sentTxid": null,
        "inputChainPaths": [],
        "builderObj": {
          "valueInSat": "1000000000",
          "valueOutSat": "123456789",
          "feeSat": "10000",
          "remainderSat": "876533211",
          "hashToScriptMap": {
            "3QjgeBsNeiDkoVQxDAw4sSEe9BVaqhmpnd": "5321025c2951a7e94e39f2c3210fb2d71b7d79044f7daa6b007556a6feb4b2059091e921026c56eea4ef632b24c4efe9d5391ea0e15e306450e5b7db26cd1a7a33d9d4e82821026d06e532385186793121633fb365fa2f0c7246b30590db78cba795641c94734521035051d2b742263bc5257c5a4461e1a6fa32c3f1965f5ab5e8b0f0f80c9e28bc702103ddb0d39c1cd88295e7b81050dcab11ca4419bf64fba3ef9d9130ea64d6604ab055ae",
            "365dPtmHPAdUUNvPBcnfidYt2Snyaka7AH": "5321020faaf739abda51e822621d42062470c5743a127186369a67fd3303f71727fb1d210237063d3b27c21767054dad203298bfed90cb08dca371950a08b88aa979c33bd22102a3780cb275b6dcb8b379514679387d4578068745f08c5799e4ee1a90aa3a70922102f4fea0cd5bc2418892278f480682690857f4d963deeb95d88febfa255e4ce0b821035d53fa74fee26873c3f5a4acf4dce53ff9d50db59e1ca4acddb82168dd429a3355ae",
            "372DueknmmjVR3zcWfEfADp8FwJ3ARhGaN": "532102666c2873c9e6f58ca594cd6c8327a1515db32ebadbaff4fe75e63b917560b7d021031ca2d159ae8868a5eef6d67a5a8a5bcc6fb2e8b711669f1c1e8b05327236a3cf2103798a4ce34929cb450bf88557dd90cae538c67f9d0c76314ae18679200be9c17021039624dec23dc1bb628cea55e949ea26225949a3349346a0732fef9def6f1f75292103d1edaadb8555012b752dd7a5c6672c379ce827e4bc0d4e992ee1ab3488b445b255ae",
            "3GLJbHv7RqPeFk2SqWapqJ3XibVibiKi8f": "5321021a33d48b9f5d3adc41004709313277d4c6969268cf41e3f5b695a934c676829a21031b87321307db7a0f6ea22847a538505188f1a2231eba68867e17c5f0e4434c0721035dee0a6e1df66a6c9c7592ef03aa02bba9b06742134d27bd08f356e33f21259c2103768a109d682a76c09f865912e9e64a8689b03c1a231c613d87ec9bd535fd74c22103911038638b9fc52b2d375ce207c8388bd5ee7f2d54ab9b4148bd406c6d7dcad355ae",
            "3E1d1z7gJSFeZM2d3k12MJ1jGwrBRy1YTw": "5321027da98ce0407138461f4ad803a1fb67afa4246f06ad0e1256a087daeffd82a8642102e7f87f2b094ec322be2fb99d3ca81fd6ac0ab26ce081e51ab18c507f8b6d1d162102ed5d256036e10568c33e0a15021cc1806e04d7d24c8f020aaae23ec2deecb4302103b6f88231bb5a5f4629e4d097492321f86968c6aeb012196a1fe3b217fe4ae0ac2103f6b5e2c1db3124a5058a0e3e83d5d0c412b9a5b50e2ef97e2b7e1c0af57ab3e355ae",
            "3QYueyPXq2QDRQCDo7agTimz9673NKV25E": "5321021543292c2942708ccc83354ebf507044b310ed0d33a19e2327a49be53e0f314221024a1a83f8c50f6cad7c134b9cded509dabf196ae49eca157a39ad95798943dc95210292698fbb97e8f6e67296b22b36367ba85c8101fcbc27bb4b00b43623639212ac2102d86980796027a00ba7aa9b53671762c908962654f969f5dec340071bb30e8d7621038fb3fa5e77dafd24c09d819dbdc7c11dca55b350511bf3bc499c09316a89286e55ae",
            "372BzC1GGjziT8zGYbryja3kF2KaTeobRK": "53210214ec25e5cb42e51883d4e615316748feefe91133fcfc0f93f0b5a24a55e0a347210262336210b3173aa4ca90d292990f463e42bdeb2e73112925dc712c5a2e749bcb210277517855f512564f225e63c650dad7720565aa563901d50743be4b0f0267dcc72102d2777a9faf5d2e2b2363e1270d61021bc2e36e8cb19ca9d29dedbba9a0348b532103a57db80b6ae573e5cef2115e36e73e5ef41f8a099bfb5087d80320c04a7db72e55ae"
          },
          "selectedUtxos": [{
            "address": "3E1d1z7gJSFeZM2d3k12MJ1jGwrBRy1YTw",
            "scriptPubKey": "a91487264aa41e3df76f3156c7fa587fd7d5b1f7b96b87",
            "txid": "2ac165fa7a3a2b535d106a0041c7568d03b531e58aeccdd3199d7289ab12cfc1",
            "vout": 1,
            "amount": 10,
            "confirmations": 7
          }],
          "inputsSigned": 0,
          "signaturesAdded": 1,
          "signhash": 1,
          "spendUnconfirmed": false,
          "tx": "0100000001c1cf12ab89729d19d3cdec8ae531b5038d56c741006a105d532b3a7afa65c12a01000000fd40010047304402201aad0ea92f929be21d60afb741b76bfcf2aa9614079cb9da76b15b3a1210f07b02205bc5c1895105da3ee682e532d2d49dfd1214fa6123fb9c9d552336f135c77eff0147304402203f02f15bb4ad4bc7d0ca4612fd9e9ae05a1331f3d62f302cf08dba56695f5dcf0220700110562fe228ebba324b120de64a7bbaddf049d67a313f749e9b32ee88787d014cad5321027da98ce0407138461f4ad803a1fb67afa4246f06ad0e1256a087daeffd82a8642102e7f87f2b094ec322be2fb99d3ca81fd6ac0ab26ce081e51ab18c507f8b6d1d162102ed5d256036e10568c33e0a15021cc1806e04d7d24c8f020aaae23ec2deecb4302103b6f88231bb5a5f4629e4d097492321f86968c6aeb012196a1fe3b217fe4ae0ac2103f6b5e2c1db3124a5058a0e3e83d5d0c412b9a5b50e2ef97e2b7e1c0af57ab3e355aeffffffff0215cd5b07000000001976a91434f8e0c5be216025a52addf18a987543cad23f7a88acdbd53e340000000017a914a09f10bc42b61ecf9d3d09550765c228f1cb808a8700000000"
        }
      }
    };
    w._handleTxProposal('senderID', txp, true);
    Object.keys(w.txProposals.txps).length.should.equal(1);
    w.getTxProposals().length.should.equal(1);
  });

  var newId = '00bacacafe';
  it('handle new connections', function(done) {
    var w = createW();
    w.on('connect', function(id) {
      id.should.equal(newId);
      done();
    });
    w._handleConnect(newId);
  });

  it('handle disconnections', function(done) {
    var w = createW();
    w.on('disconnect', function(id) {
      id.should.equal(newId);
      done();
    });
    w._handleDisconnect(newId);
  });

  it('should register new copayers correctly', function() {
    var w = createW();
    var r = w.getRegisteredCopayerIds();
    r.length.should.equal(1);
    w.publicKeyRing.addCopayer();
    r = w.getRegisteredCopayerIds();
    r.length.should.equal(2);
    r[0].should.not.equal(r[1]);
  });

  it('should register new peers correctly', function() {
    var w = createW();
    var r = w.getRegisteredPeerIds();
    r.length.should.equal(1);
    w.publicKeyRing.addCopayer();
    r = w.getRegisteredPeerIds();
    r.length.should.equal(2);
    r[0].should.not.equal(r[1]);
  });

  it('#getBalance should call #getUnspent', function(done) {
    var w = cachedCreateW2();
    var spy = sinon.spy(w.blockchain, 'getUnspent');
    w.generateAddress();
    w.getBalance(function(err, balance, balanceByAddr, safeBalance) {
      sinon.assert.callCount(spy, 1);
      done();
    });
  });
  it('#getBalance should return values in satoshis', function(done) {
    var w = cachedCreateW2();
    w.generateAddress();
    w.getBalance(function(err, balance, balanceByAddr, safeBalance) {
      balance.should.equal(2500010000);
      safeBalance.should.equal(2500010000);
      balanceByAddr.mji7zocy8QzYywQakwWf99w9bCT6orY1C1.should.equal(2500010000);
      Object.keys(balanceByAddr).length.should.equal(1);
      done();
    });
  });

  it('#getUnspent should honor spendUnconfirmed = false', function(done) {
    var conf = JSON.parse(JSON.stringify(config));
    conf.spendUnconfirmed = false;
    var w = createW2(null, null, conf);
    w.getBalance(function(err, balance, balanceByAddr, safeBalance) {
      balance.should.equal(2500010000);
      safeBalance.should.equal(0);
      balanceByAddr.mji7zocy8QzYywQakwWf99w9bCT6orY1C1.should.equal(2500010000);
      done();
    });
  });

  it('#getUnspent and spendUnconfirmed should count transactions with 1 confirmations', function(done) {
    var conf = JSON.parse(JSON.stringify(config));
    conf.spendUnconfirmed = false;
    var w = cachedCreateW2(null, null, conf);
    w.blockchain.getUnspent = w.blockchain.getUnspent2;
    w.getBalance(function(err, balance, balanceByAddr, safeBalance) {
      balance.should.equal(2500010000);
      safeBalance.should.equal(2500010000);
      balanceByAddr.mji7zocy8QzYywQakwWf99w9bCT6orY1C1.should.equal(2500010000);
      done();
    });
  });

  var roundErrorChecks = [{
      unspent: [1.0001],
      balance: 100010000
    }, {
      unspent: [1.0002, 1.0003, 1.0004],
      balance: 300090000
    }, {
      unspent: [0.000002, 1.000003, 2.000004],
      balance: 300000900
    }, {
      unspent: [0.0001, 0.0003],
      balance: 40000
    }, {
      unspent: [0.0001, 0.0003, 0.0001, 0.0001, 0.0001, 0.0001, 0.0001, 0.0002],
      balance: 110000
    },

  ];
  var roundWallet = cachedCreateW2();

  roundErrorChecks.forEach(function(c) {
    it('#getBalance should handle rounding errors: ' + c.unspent[0], function(done) {
      var w = roundWallet;
      //w.generateAddress();
      w.blockchain.fixUnspent(c.unspent.map(function(u) {
        return {
          amount: u
        }
      }));
      w.getBalance(function(err, balance, balanceByAddr, safeBalance) {
        balance.should.equal(c.balance);
        done();
      });
    });
  });


  it('should get balance', function(done) {
    var w = createW();
    var spy = sinon.spy(w.blockchain, 'getUnspent');
    w.blockchain.fixUnspent([]);
    w.getBalance(function(err, balance, balanceByAddr, safeBalance) {
      sinon.assert.callCount(spy, 1);
      balance.should.equal(0);
      done();
    });
  });


  // tx handling

  var createUTXO = function(w) {
    var utxo = [{
      'txid': '0be0fb4579911be829e3077202e1ab47fcc12cf3ab8f8487ccceae768e1f95fa',
      'vout': 0,
      'ts': 1402323949,
      'amount': 25.0001,
      'confirmations': 10,
      'confirmationsFromCache': false
    }];
    var addr = w.generateAddress().toString();
    utxo[0].address = addr;
    utxo[0].scriptPubKey = (new bitcore.Address(addr)).getScriptPubKey().serialize().toString('hex');
    return utxo;
  };
  var toAddress = 'mjfAe7YrzFujFf8ub5aUrCaN5GfSABdqjh';
  var amountSatStr = '1000';

  it('should create transaction', function(done) {
    var w = cachedCreateW2();
    var utxo = createUTXO(w);
    w.blockchain.fixUnspent(utxo);
    w.createTx(toAddress, amountSatStr, null, function(ntxid) {
      ntxid.length.should.equal(64);
      done();
    });
  });
  it('should create & sign transaction from received funds', function(done) {
    this.timeout(10000);
    var w = cachedCreateW2();
    var pk = w.privateKey;
    w.privateKey = null;
    var utxo = createUTXO(w);
    w.blockchain.fixUnspent(utxo);
    w.createTx(toAddress, amountSatStr, null, function(ntxid) {
      w.on('txProposalsUpdated', function() {
        w.getTxProposals()[0].signedByUs.should.equal(true);
        w.getTxProposals()[0].rejectedByUs.should.equal(false);
        done();
      });
      w.privateKey = pk;
      w.sign(ntxid, function(success) {
        success.should.equal(true);
      });
    });
  });
  it('should create & reject transaction', function(done) {
    var w = cachedCreateW2();
    w.privateKey = null;
    var utxo = createUTXO(w);
    w.blockchain.fixUnspent(utxo);
    w.createTx(toAddress, amountSatStr, null, function(ntxid) {
      w.on('txProposalsUpdated', function() {
        w.getTxProposals()[0].signedByUs.should.equal(false);
        w.getTxProposals()[0].rejectedByUs.should.equal(true);
        done();
      });
      w.reject(ntxid);
    });
  });
  it('should create & sign & send a transaction', function(done) {
    var w = createW2(null, 1);
    var utxo = createUTXO(w);
    w.blockchain.fixUnspent(utxo);
    w.createTx(toAddress, amountSatStr, null, function(ntxid) {
      w.sendTx(ntxid, function(txid) {
        txid.length.should.equal(64);
        done();
      });
    });
  });
  it('should send TxProposal', function(done) {
    var w = cachedCreateW2();
    var utxo = createUTXO(w);
    w.blockchain.fixUnspent(utxo);
    w.createTx(toAddress, amountSatStr, null, function(ntxid) {
      w.sendTxProposal.bind(w).should.throw('Illegal Argument.');
      (function() {
        w.sendTxProposal(ntxid);
      }).should.not.throw();
      done();
    });
  });

  it('should send all TxProposal', function(done) {
    var w = cachedCreateW2();
    var utxo = createUTXO(w);
    w.blockchain.fixUnspent(utxo);
    w.createTx(toAddress, amountSatStr, null, function(ntxid) {
      w.sendAllTxProposals.bind(w).should.not.throw();
      (function() {
        w.sendAllTxProposals();
      }).should.not.throw();
      done();
    });
  });

  describe('#send', function() {
    it('should call this.network.send', function() {
      var w = cachedCreateW2();
      var save = w.network.send;
      w.network.send = sinon.spy();
      w.send();
      w.network.send.calledOnce.should.equal(true);
      w.network.send = save;
    });
  });

  describe('#indexDiscovery', function() {
    var ADDRESSES_CHANGE, ADDRESSES_RECEIVE, w;

    before(function() {
      w = cachedCreateW2();
      ADDRESSES_CHANGE = w.deriveAddresses(0, 20, true, 0);
      ADDRESSES_RECEIVE = w.deriveAddresses(0, 20, false, 0);
    });

    var mockFakeActivity = function(f) {
      w.blockchain.checkActivity = function(addresses, cb) {
        var activity = new Array(addresses.length);
        for (var i = 0; i < addresses.length; i++) {
          var a1 = ADDRESSES_CHANGE.indexOf(addresses[i]);
          var a2 = ADDRESSES_RECEIVE.indexOf(addresses[i]);
          activity[i] = f(Math.max(a1, a2));
        }
        cb(null, activity);
      }
    }

    it('#indexDiscovery should work without found activities', function(done) {
      mockFakeActivity(function(index) {
        return false;
      });
      w.indexDiscovery(0, false, 0, 5, function(e, lastActive) {
        lastActive.should.equal(-1);
        done();
      });
    });

    it('#indexDiscovery should continue scanning', function(done) {
      mockFakeActivity(function(index) {
        return index <= 7;
      });
      w.indexDiscovery(0, false, 0, 5, function(e, lastActive) {
        lastActive.should.equal(7);
        done();
      });
    });

    it('#indexDiscovery should not found beyond the scannWindow', function(done) {
      mockFakeActivity(function(index) {
        return index <= 10 || index == 17;
      });
      w.indexDiscovery(0, false, 0, 5, function(e, lastActive) {
        lastActive.should.equal(10);
        done();
      });
    });

    it('#indexDiscovery should look for activity along the scannWindow', function(done) {
      mockFakeActivity(function(index) {
        return index <= 14 && index % 2 == 0;
      });
      w.indexDiscovery(0, false, 0, 5, function(e, lastActive) {
        lastActive.should.equal(14);
        done();
      });
    });

    it('#updateIndexes should update correctly', function(done) {
      mockFakeActivity(function(index) {
        return index <= 14 && index % 2 == 0;
      });

      var updateIndex = sinon.stub(w, 'updateIndex', function(i, cb) {
        cb();
      });

      w.updateIndexes(function(err) {
        // check updated all indexes
        var cosignersChecked = []
        updateIndex.args.forEach(function(i) {
          cosignersChecked.indexOf(i[0].cosigner).should.equal(-1);
          cosignersChecked.push(i[0].cosigner);
        });

        sinon.assert.callCount(updateIndex, 4);
        w.updateIndex.restore();
        done();
      });
    });

    it('#updateIndex should update correctly', function(done) {
      mockFakeActivity(function(index) {
        return index <= 14 && index % 2 == 0;
      });


      var indexDiscovery = sinon.stub(w, 'indexDiscovery', function(a, b, c, d, cb) {
        cb(null, 8);
      });
      var index = {
        changeIndex: 1,
        receiveIndex: 2,
        cosigner: 2,
      }
      w.updateIndex(index, function(err) {
        index.receiveIndex.should.equal(9);
        index.changeIndex.should.equal(9);
        indexDiscovery.callCount.should.equal(2);
        w.indexDiscovery.restore();
        done();
      });
    });


    it('#updateIndexes should store wallet', function(done) {
      mockFakeActivity(function(index) {
        return index <= 14 && index % 2 == 0;
      });
      var indexDiscovery = sinon.stub(w, 'indexDiscovery', function(a, b, c, d, cb) {
        cb(null, 8);
      });
      var spyStore = sinon.spy(w, 'store');
      w.updateIndexes(function(err) {
        sinon.assert.callCount(spyStore, 1);
        done();
      });
    });

  });

  it('#deriveAddresses', function(done) {
    var w = cachedCreateW2();
    var addresses1 = w.deriveAddresses(0, 5, false, 0);
    var addresses2 = w.deriveAddresses(4, 5, false, 0);

    addresses1.length.should.equal(5);
    addresses2.length.should.equal(5);

    addresses1[4].should.equal(addresses2[0]);
    done();
  });

  describe('#AddressBook', function() {
    var contacts = [{
      label: 'Charles',
      address: '2N8pJWpXCAxmNLHKVEhz3TtTcYCtHd43xWU ',
    }, {
      label: 'Linda',
      address: '2N4Zq92goYGrf5J4F4SZZq7jnPYbCiyRYT2 ',
    }];

    it('should create new entry for address book', function() {
      var w = createW();
      contacts.forEach(function(c) {
        w.setAddressBook(c.address, c.label);
      });
      Object.keys(w.addressBook).length.should.equal(4);
    });

    it('should fail if create a duplicate address', function() {
      var w = createW();
      w.setAddressBook(contacts[0].address, contacts[0].label);
      (function() {
        w.setAddressBook(contacts[0].address, contacts[0].label);
      }).should.
      throw();
    });

    it('should show/hide everywhere', function() {
      var w = createW();
      var key = '2NFR2kzH9NUdp8vsXTB4wWQtTtzhpKxsyoJ';
      w.toggleAddressBookEntry(key);
      w.addressBook[key].hidden.should.equal(true);
      w.toggleAddressBookEntry(key);
      w.addressBook[key].hidden.should.equal(false);
      (function() {
        w.toggleAddressBookEntry();
      }).should.throw();
    });

    it('handle network addressBook correctly', function() {
      var w = createW();

      var data = {
        type: "addressbook",
        addressBook: {
          "3Ae1ieAYNXznm7NkowoFTu5MkzgrTfDz8Z": {
            copayerId: "03baa45498fee1045fa8f91a2913f638dc3979b455498924d3cf1a11303c679cdb",
            createdTs: 1404769393509,
            hidden: false,
            label: "adsf",
            signature: "3046022100d4cdefef66ab8cea26031d5df03a38fc9ec9b09b0fb31d3a26b6e204918e9e78022100ecdbbd889ec99ea1bfd471253487af07a7fa7c0ac6012ca56e10e66f335e4586"
          }
        },
        walletId: "11d23e638ed84c06",
        isBroadcast: 1
      };

      var senderId = "03baa45498fee1045fa8f91a2913f638dc3979b455498924d3cf1a11303c679cdb";

      Object.keys(w.addressBook).length.should.equal(2);
      w._handleAddressBook(senderId, data, true);
      Object.keys(w.addressBook).length.should.equal(3);
    });

    it('should return signed object', function() {
      var w = createW();
      var payload = {
        address: 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx',
        label: 'Faucet',
        copayerId: '026a55261b7c898fff760ebe14fd22a71892295f3b49e0ca66727bc0a0d7f94d03',
        createdTs: 1403102115
      };
      should.exist(w.signJson(payload));
    });

    it('should verify signed object', function() {
      var w = createW();

      var payload = {
        address: "3Ae1ieAYNXznm7NkowoFTu5MkzgrTfDz8Z",
        label: "adsf",
        copayerId: "03baa45498fee1045fa8f91a2913f638dc3979b455498924d3cf1a11303c679cdb",
        createdTs: 1404769393509
      }

      var signature = "3046022100d4cdefef66ab8cea26031d5df03a38fc9ec9b09b0fb31d3a26b6e204918e9e78022100ecdbbd889ec99ea1bfd471253487af07a7fa7c0ac6012ca56e10e66f335e4586";

      var pubKey = "03baa45498fee1045fa8f91a2913f638dc3979b455498924d3cf1a11303c679cdb";

      w.verifySignedJson(pubKey, payload, signature).should.equal(true);
      payload.label = 'Another';
      w.verifySignedJson(pubKey, payload, signature).should.equal(false);
    });

    it('should verify signed addressbook entry', function() {
      var w = createW();
      var key = "3Ae1ieAYNXznm7NkowoFTu5MkzgrTfDz8Z";
      var pubKey = "03baa45498fee1045fa8f91a2913f638dc3979b455498924d3cf1a11303c679cdb";
      w.addressBook[key] = {
        copayerId: pubKey,
        createdTs: 1404769393509,
        hidden: false,
        label: "adsf",
        signature: "3046022100d4cdefef66ab8cea26031d5df03a38fc9ec9b09b0fb31d3a26b6e204918e9e78022100ecdbbd889ec99ea1bfd471253487af07a7fa7c0ac6012ca56e10e66f335e4586"
      };

      w.verifyAddressbookEntry(w.addressBook[key], pubKey, key).should.equal(true);
      w.addressBook[key].label = 'Another';
      w.verifyAddressbookEntry(w.addressBook[key], pubKey, key).should.equal(false);
      (function() {
        w.verifyAddressbookEntry();
      }).should.throw();
    });

  });

  it('#getNetworkName', function() {
    var w = createW();
    w.getNetworkName().should.equal('testnet');
  });

  describe('#getMyCopayerId', function() {
    it('should call getCopayerId', function() {
      var w = cachedCreateW2();
      w.getCopayerId = sinon.spy();
      w.getMyCopayerId();
      w.getCopayerId.calledOnce.should.equal(true);
    });
  });

  describe('#getMyCopayerIdPriv', function() {
    it('should call privateKey.getIdPriv', function() {
      var w = cachedCreateW2();
      w.privateKey.getIdPriv = sinon.spy();
      w.getMyCopayerIdPriv();
      w.privateKey.getIdPriv.calledOnce.should.equal(true);
    });
  });

  describe('#netStart', function() {
    it('should call Network.start', function() {
      var w = cachedCreateW2();
      w.network.start = sinon.spy();
      w.netStart();
      w.network.start.calledOnce.should.equal(true);
    });

    it('should call Network.start with a private key', function() {
      var w = cachedCreateW2();
      w.network.start = sinon.spy();
      w.netStart();
      w.network.start.getCall(0).args[0].privkey.length.should.equal(64);
    });
  });

  describe('#forceNetwork in config', function() {
    it('should throw if network is different', function() {
      cachedW2 = null;
      var backup = copayConfig.forceNetwork;
      copayConfig.forceNetwork = true;
      config.networkName = copayConfig.networkName == 'livenet' ? 'testnet' : 'livenet';
      cachedCreateW2.should.throw(Error);
      copayConfig.forceNetwork = backup;
    });
  });
});
