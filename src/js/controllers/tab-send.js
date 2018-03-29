'use strict';

angular.module('copayApp.controllers').controller('tabSendController', function($scope, $rootScope, $log, $timeout,
  $ionicScrollDelegate, addressbookService, profileService, lodash, $state, walletService, incomingData, popupService,
   platformInfo, bwcError, gettextCatalog, scannerService, $window, externalLinkService, bitcore, navTechService) {

  var originalList;
  var CONTACTS_SHOW_LIMIT;
  var currentContactsPage;
  $scope.isSweeping = false;
  $scope.isChromeApp = platformInfo.isChromeApp;
  $scope.isIOS = platformInfo.isIOS;
  $scope.privatePayment = false;
  $scope.privateToggleOn = false;

  $scope.sweepBtnDisabled = function() {
    var isDisabled = true;

    if ($scope.checkPrivateKey($scope.formData.search)) {
      isDisabled = false;
    }
    return isDisabled;
  };


  var hasWallets = function() {
    $scope.wallets = profileService.getWallets({
      onlyComplete: true
    });
    $scope.hasWallets = lodash.isEmpty($scope.wallets) ? false : true;
  };

  // THIS is ONLY to show the 'buy bitcoins' message
  // does not has any other function.

  var updateHasFunds = function() {
    $scope.nextDisabled = true;

    if ($rootScope.everHasFunds) {
      $scope.hasFunds = true;
      return;
    }

    $scope.hasFunds = false;
    var index = 0;
    lodash.each($scope.wallets, function(w) {
      walletService.getStatus(w, {}, function(err, status) {

        ++index;
        if (err && !status) {
          $log.error(err);
          // error updating the wallet. Probably a network error, do not show
          // the 'buy bitcoins' message.

          $scope.hasFunds = true;
        } else if (status.availableBalanceSat > 0) {
          $scope.hasFunds = true;
          $rootScope.everHasFunds = true;
        }

        if (index == $scope.wallets.length) {
          $scope.checkingBalance = false;
          $timeout(function() {
            $scope.$apply();
          });
        }
      });
    });
  };

  var updateWalletsList = function() {

    var networkResult = lodash.countBy($scope.wallets, 'network');

    $scope.showTransferCard = $scope.hasWallets && (networkResult.livenet > 1 || networkResult.testnet > 1);

    if ($scope.showTransferCard) {
      var walletsToTransfer = $scope.wallets;
      if (!(networkResult.livenet > 1)) {
        walletsToTransfer = lodash.filter(walletsToTransfer, function(item) {
          return item.network == 'testnet';
        });
      }
      if (!(networkResult.testnet > 1)) {
        walletsToTransfer = lodash.filter(walletsToTransfer, function(item) {
          return item.network == 'livenet';
        });
      }
      var walletList = [];
      lodash.each(walletsToTransfer, function(v) {
        walletList.push({
          color: v.color,
          name: v.name,
          recipientType: 'wallet',
          getAddress: function(cb) {
            walletService.getAddress(v, false, cb);
          },
        });
      });
      originalList = originalList.concat(walletList);
    }
  }

  var updateContactsList = function(cb) {
    addressbookService.list(function(err, ab) {
      if (err) $log.error(err);

      $scope.hasContacts = lodash.isEmpty(ab) ? false : true;
      if (!$scope.hasContacts) return cb();

      var completeContacts = [];
      lodash.each(ab, function(v, k) {
        completeContacts.push({
          name: lodash.isObject(v) ? v.name : v,
          address: k,
          email: lodash.isObject(v) ? v.email : null,
          recipientType: 'contact',
          getAddress: function(cb) {
            return cb(null, k);
          },
        });
      });
      var contacts = completeContacts.slice(0, (currentContactsPage + 1) * CONTACTS_SHOW_LIMIT);
      $scope.contactsShowMore = completeContacts.length > contacts.length;
      originalList = originalList.concat(contacts);
      return cb();
    });
  };

  var updateList = function() {
    $scope.list = lodash.clone(originalList);
    $timeout(function() {
      $ionicScrollDelegate.resize();
      $scope.$apply();
    }, 10);
  };

  var isValidTransaction = function() {
    return incomingData.redir($scope.formData.search, $scope.privatePayment, true)
  }

  $scope.openBuyLink = function() {
    $state.go('tabs.changelly-send');
  };

  $scope.openScanner = function() {
    var isWindowsPhoneApp = platformInfo.isCordova && platformInfo.isWP;

    if (!isWindowsPhoneApp) {
      $state.go('tabs.scan', { returnRoute: 'tabs.send' });
      return;
    }

    scannerService.useOldScanner(function(err, contents) {
      if (err) {
        popupService.showAlert(gettextCatalog.getString('Error'), err);
        return;
      }
      incomingData.redir(contents);
    });
  };

  $scope.showMore = function() {
    currentContactsPage++;
    updateWalletsList();
  };

  $scope.searchInFocus = function() {
    $scope.searchFocus = true;
  };

  $scope.togglePrivatePayment = function() {
    $scope.privateToggleOn = !$scope.privateToggleOn

    // If toggle is now off
    if (!$scope.privateToggleOn) {
      $scope.showAddNavTech = false
      $scope.nextDisabled = true
      $scope.privatePayment = false

      // Check if they they have a valid transaciotn
      // if so let them press next
      if (isValidTransaction()) {
        $scope.nextDisabled = false
      }
    }

    // if toggle is now on
    if ($scope.privateToggleOn) {
      navTechService.getNavTechServers(function(error, servers) {
        $log.debug('NavTech Servers Found:', servers)
        if (error) { return $log.error(error) }

        if (!servers || servers.length === 0) {
          $scope.nextDisabled = true
          $scope.showAddNavTech = true
        } else {
          // Aleady have servers. Just let them do private payment
          $scope.privatePayment = true
        }
      })
    }
  }

  $scope.saveNavTechAddress = function(address) {
    navTechService.addNode(address, function(error, result) {
      if (error) { return $log.error(error) }
      $scope.navTechAddressSuccess = true
      $scope.privatePayment = true
      if (isValidTransaction()) { $scope.nextDisabled = false }
    })
  }

  $scope.searchBlurred = function() {
    if ($scope.formData.search == null || $scope.formData.search.length == 0) {
      $scope.searchFocus = false;
    }
    if (isValidTransaction()) {
      $scope.nextDisabled = false;
      return;
    } else {
      $scope.nextDisabled = true;
      return;
    }
  };

  $scope.nextClicked = function(search) {
    var privatePayment = $scope.privatePayment || false;
    if (incomingData.redir(search, privatePayment, false)) {
      return;
    } else if (search) {
      $scope.nextDisabled = true;
      return;
    }
  }

  $scope.findContact = function(search) {
    var privatePayment = $scope.privatePayment || false;
    if (incomingData.redir(search, privatePayment, true)) {
      $scope.nextDisabled = false;
      return;
    } else if (search) {
      $scope.nextDisabled = true;
      return;
    }

    if (!search || search.length < 2) {
      $scope.list = originalList;
      $timeout(function() {
        $scope.$apply();
      });
      return;
    }
    var result = lodash.filter(originalList, function(item) {
      var val = item.name;
      return lodash.includes(val.toLowerCase(), search.toLowerCase());
    });

    $scope.list = result;
  };

  $scope.goToAmount = function(item) {
    $log.debug('goToAmount');
    $timeout(function() {
      item.getAddress(function(err, addr) {
        if (err || !addr) {
          //Error is already formated
          return popupService.showAlert(err);
        }
        $log.debug('Got toAddress:' + addr + ' | ' + item.name);
        return $state.transitionTo('tabs.send.amount', {
          recipientType: item.recipientType,
          toAddress: addr,
          toName: item.name,
          toEmail: item.email,
          toColor: item.color
        })
      });
    });
  };

  // This could probably be enhanced refactoring the routes abstract states
  $scope.createWallet = function() {
    $state.go('tabs.home').then(function() {
      $state.go('tabs.add.create-personal');
    });
  };

  $scope.buyBitcoin = function() {
    $state.go('tabs.home').then(function() {
      $state.go('tabs.buyandsell');
    });
  };

  $scope.sweepAddressClickHandler = function(privateKey) {
    $log.debug('privateKey', privateKey);

    $state.go('tabs.home').then(function() {
      $timeout(function() {
        $state.transitionTo('tabs.home.paperWallet', {
          privateKey: privateKey
        });
        }, 50);
    });
  };


  $scope.checkPrivateKey = function(privateKey) {
    try {
      new bitcore.PrivateKey(privateKey, 'livenet');
    } catch (err) {
      return false;
    }
    return true;
  }

  $scope.$on("$ionicView.beforeEnter", function(event, data) {

    $scope.checkingBalance = true;
    $scope.formData = {
      search: null
    };

    originalList = [];
    CONTACTS_SHOW_LIMIT = 10;
    currentContactsPage = 0;
    hasWallets();
  });

  $scope.$on("$ionicView.enter", function(event, data) {
    if (!$scope.hasWallets) {
      $scope.checkingBalance = false;
      return;
    }
    updateHasFunds();

    if (data.stateParams.address) {
      if (data.stateParams.address === 'sweep') {
        $scope.isSweeping = true;
      } else {
        $scope.formData.search = data.stateParams.address;
      }
      $timeout(function() {
        $scope.searchFocus = true;
        var element = $window.document.getElementById('tab-send-address');
        if(element) element.focus();
        $scope.searchBlurred();
      });
    }

    updateWalletsList();
    updateContactsList(function() {
      updateList();
    });
  });
});
