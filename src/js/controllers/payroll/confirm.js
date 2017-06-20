'use strict';

angular.module('copayApp.controllers').controller('payrollConfirmController', function($scope, $log, $state, $timeout, $ionicScrollDelegate, lodash, ongoingProcess, bitpayPayrollService, txFormatService, profileService, configService, walletService, gettextCatalog, rateService, popupService, moment, addressbookService, platformInfo) {

  var BITPAY_API_URL = 'https://bitpay.com';
  var config = configService.getSync().wallet.settings;

  $scope.isChromeApp = platformInfo.isChromeApp;

  $scope.$on("$ionicView.beforeEnter", function(event, data) {
    if (data.stateParams && data.stateParams.id) {
      bitpayPayrollService.getPayrollRecordById(data.stateParams.id, function(err, record) {
        if (err) {
          return showError(err);
        }

        if (!record) {
          return showError(
            'No payroll record found when loading payrollConfirmController',
            gettextCatalog.getString('Error'),
            gettextCatalog.getString('No payroll settings specified.'));
        }

        $scope.payrollRecord = record;
        $scope.effectiveDate = formatDate(record.employer.nextEffectiveDate);

        // Deposit amount is in fiat (alternative) currency.
        var depositAmount = parseFloat(data.stateParams.amount);
        var btcEstimate = rateService.fromFiat(depositAmount, config.alternativeIsoCode);
        var btcEstimateStr = txFormatService.formatAmountStr(btcEstimate);

        $scope.depositAmount = depositAmount.toFixed(2);
        $scope.depositDisplayUnit = config.alternativeIsoCode;
        $scope.btcEstimate = getDisplayAmount(btcEstimateStr);
        $scope.btcDisplayUnit = getDisplayUnit(btcEstimateStr);

        if ($scope.payrollRecord.deduction) {
          // Use existing record deduction info
          $scope.walletName = $scope.payrollRecord.deduction.walletName;
          $scope.label = $scope.payrollRecord.deduction.label;
        } else {
          // Initialize from an eligibility record
          $scope.walletName = data.stateParams.toName || gettextCatalog.getString('My Wallet');
          $scope.label = gettextCatalog.getString('My bitcoin pay');
        }

        $scope.recipientType = data.stateParams.recipientType;
        switch ($scope.recipientType) {
          case 'address':
            setRecipientAddress(data.stateParams.toAddress);
            break;
          case 'contact':
            setRecipientContact(data.stateParams.toAddress);
            break;
          case 'wallet':
            $scope.wallets = profileService.getWallets({
              onlyComplete: true,
              network: 'livenet'
            });

            var wallet = lodash.find($scope.wallets, function(w) {
              return w.name == data.stateParams.toName;
            });
            setRecipientWallet(wallet);
            break;
        }

        rateService.whenAvailable(function() {
          $scope.exchangeRate = getCurrentRateStr();
        });
      });
    } else {
      return showError(
        'No payroll record id specified when loading payrollConfirmController',
        gettextCatalog.getString('Error'),
        gettextCatalog.getString('No payroll settings specified.'));
    }
  });

  $scope.showContactSelector = function() {
    $scope.contactSelectorTitle = gettextCatalog.getString('Deposit to');
    $scope.showContacts = true;
  };

  $scope.onContactSelect = function(contact) {
    setRecipientContact(contact.address);
  };

  $scope.showWalletSelector = function() {
    $scope.walletSelectorTitle = gettextCatalog.getString('Deposit to');
    $scope.showWallets = true;
  };

  $scope.onWalletSelect = function(wallet) {
    setRecipientWallet(wallet);
  };

  $scope.renameWallet = function() {
    var opts = {
      defaultText: $scope.walletName
    };
    var title = gettextCatalog.getString('Wallet Name');
    var message = gettextCatalog.getString('Enter a name for the bitcoin address you have entered. This name is used only to remind you of your bitcoin deposit destination.');
    popupService.showPrompt(title, message, opts, function(str) {
      if (typeof str != 'undefined') {
        $scope.walletName = str;
      }
    });
  };

  $scope.editLabel = function() {
    var opts = {
      defaultText: $scope.label
    };
    var title = gettextCatalog.getString('Label');
    var message = gettextCatalog.getString('Enter a friendly name for this payroll deposit. This name is used to help you identify these payroll settings.');
    popupService.showPrompt(title, message, opts, function(str) {
      if (typeof str != 'undefined') {
        $scope.label = str;
      }
    });
  };

  $scope.startPayroll = function() {
    // Store what we show the user ($scope).
    $scope.payrollRecord.deduction = {
      address: $scope.address,
      amount: parseFloat($scope.depositAmount),
      currency: $scope.depositDisplayUnit,
      walletId: ($scope.wallet ? $scope.wallet.id : ''),
      walletName: ($scope.wallet ? $scope.wallet.name : $scope.walletName),
      label: $scope.label
    };

    ongoingProcess.set('savingPayrollRecord', true);
    bitpayPayrollService.startPayroll($scope.payrollRecord, function(err, record) {
      ongoingProcess.set('savingPayrollRecord', false);
      if (err) {
        return showError(err);
      }
      $state.transitionTo('tabs.payroll.details', {
        id: record.eid
      });
    });
  };

  function getDisplayAmount(amountStr) {
    return amountStr.split(' ')[0];
  };

  function getDisplayUnit(amountStr) {
    return amountStr.split(' ')[1];
  };

  function setRecipientAddress(address) {
    $scope.address = address;
  };

  function setRecipientContact(address) {
    $scope.address = address;
    addressbookService.get(address, function(err, contact) {
      if (err || !contact) {
        $log.error(err);
        return;
      }      
      $scope.contact = contact;
    });
  };

  function setRecipientWallet(wallet) {
    $scope.address = '';
    $scope.wallet = wallet;

    walletService.getAddress(wallet, false, function(err, addr) {
      if (err || !addr) {
        $log.error(err);
        return;
      }
      $log.debug('Got payroll deposit address:' + addr + ' | ' + wallet.name);
	    $scope.address = addr;
		
		  $timeout(function() {
		    $ionicScrollDelegate.resize();
		    $scope.$apply();
		  }, 10);
    });
  };

  function getCurrentRateStr() {    
    var str = '';
    var config = configService.getSync().wallet.settings;
    var rate = rateService.getRate(config.alternativeIsoCode);

    if (config.unitName == 'bits') {
      str = '1,000,000 bits ~ ' + rate + ' ' + config.alternativeIsoCode;
    } else {
      str = '1 BTC ~ ' + rate + ' ' + config.alternativeIsoCode;
    }
    return str;
  };

  function formatDate(date) {
    return moment(date).format('D MMMM YYYY');
  };

  function showError(err, title, message) {
    var title = title || gettextCatalog.getString('Error');
    var message = message || gettextCatalog.getString('Could not save payroll settings.');
    $log.error(err);
    return popupService.showAlert(title, message);
  };

});
