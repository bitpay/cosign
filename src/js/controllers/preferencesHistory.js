'use strict';

angular.module('copayApp.controllers').controller('preferencesHistory',
  function($scope, $log, $timeout, storageService, go, profileService, lodash) {
    var fc = profileService.focusedClient;
    var c = fc.credentials;
    this.csvReady = false;


    this.csvHistory = function(cb) {

      function formatDate(date) {
        var dateObj = new Date(date);
        if (!dateObj) {
          $log.debug('Error formating a date');
          return 'DateError'
        }
        if (!dateObj.toJSON()) {
          return '';
        }

        return dateObj.toJSON();
      }

      var step = 6;
      var unique = {};
      function getHistory(cb) {
        storageService.getTxHistory(c.walletId, function(err, txs) {
          if (err) return cb(err);

          var txsFromLocal = [];
          try {
            txsFromLocal = JSON.parse(txs);
          } catch (ex) {
            $log.warn(ex);
          }

          allTxs.push(txsFromLocal);
          return cb(null, lodash.flatten(allTxs));
        });
      }

      var fc = profileService.focusedClient;
      var c = fc.credentials;

      if (!fc.isComplete())
        return;

      var self = this;
      var allTxs = [];

      $log.debug('Generating CSV from History');
      getHistory(function(err, txs) {
        if (err || !txs || !txs[0]) {
          $log.warn('Failed to generate CSV:', err);
          if (cb) return cb(err);
          return;
        }

        $log.debug('Wallet Transaction History Length:', txs.length);

        self.satToUnit = 1 / self.unitToSatoshi;
        var data = txs;
        var satToBtc = 1 / 100000000;
        self.csvContent = [];
        self.csvFilename = 'Copay-' + (self.alias || self.walletName) + '.csv';
        self.csvHeader = ['Date', 'Destination', 'Description', 'Amount', 'Currency', 'Txid', 'Creator', 'Copayers'];

        var _amount, _note, _copayers, _creator, _comment;
        data.forEach(function(it, index) {
          var amount = it.amount;

          if (it.action == 'moved')
            amount = 0;

          _copayers = '';
          _creator = '';

          if (it.actions && it.actions.length > 1) {
            for (var i = 0; i < it.actions.length; i++) {
              _copayers += it.actions[i].copayerName + ':' + it.actions[i].type + ' - ';
            }
            _creator = (it.creatorName && it.creatorName != 'undefined') ? it.creatorName : '';
          }
          _amount = (it.action == 'sent' ? '-' : '') + (amount * satToBtc).toFixed(8);
          _note = it.message || '';
          _comment = it.note ? it.note.body : '';

          if (it.action == 'moved')
            _note += ' Moved:' + (it.amount * satToBtc).toFixed(8)

          self.csvContent.push({
            'Date': formatDate(it.time * 1000),
            'Destination': it.addressTo || '',
            'Description': _note,
            'Amount': _amount,
            'Currency': 'BTC',
            'Txid': it.txid,
            'Creator': _creator,
            'Copayers': _copayers,
            'Comment': _comment
          });

          if (it.fees && (it.action == 'moved' || it.action == 'sent')) {
            var _fee = (it.fees * satToBtc).toFixed(8)
            self.csvContent.push({
              'Date': formatDate(it.time * 1000),
              'Destination': 'Bitcoin Network Fees',
              'Description': '',
              'Amount': '-' + _fee,
              'Currency': 'BTC',
              'Txid': '',
              'Creator': '',
              'Copayers': ''
            });
          }
        });

        self.csvReady = true;
        if (cb)
          return cb();
        return;

      });
    };


    this.clearTransactionHistory = function() {
      storageService.removeTxHistory(c.walletId, function(err) {
        if (err) {
          $log.error(err);
          return;
        }
        $scope.$emit('Local/ClearHistory');

        $timeout(function() {
          go.walletHome();
        }, 100);
      });
    }
  });
