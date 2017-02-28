'use strict';

angular.module('copayApp.controllers').controller('advancedSettingsController', function($scope, $rootScope, $log, $window, $ionicModal, lodash, configService, uxLanguage, platformInfo, pushNotificationsService, profileService, feeService, storageService, $ionicHistory, $timeout, $ionicScrollDelegate) {

  var updateConfig = function() {
    var config = configService.getSync();

    $scope.spendUnconfirmed = {
      value: config.wallet.spendUnconfirmed
    };
    $scope.recentTransactionsEnabled = {
      value: config.recentTransactions.enabled
    };
    $scope.hideNextSteps = {
      value: config.hideNextSteps.enabled
    };
    $scope.usePincode = {
      value: config.pincode ? config.pincode.enabled : false
    };
  };

  $scope.spendUnconfirmedChange = function() {
    var opts = {
      wallet: {
        spendUnconfirmed: $scope.spendUnconfirmed.value
      }
    };
    configService.set(opts, function(err) {
      if (err) $log.debug(err);
    });
  };

  $scope.nextStepsChange = function() {
    var opts = {
      hideNextSteps: {
        enabled: $scope.hideNextSteps.value
      },
    };
    configService.set(opts, function(err) {
      if (err) $log.debug(err);
    });
  };

  $scope.savePincodeChanges = function(val) {
    if (!val || val.length < 4) {
      $scope.usePincode = {
        value: false
      }
      return;
    }
    var opts = {
      usePincode: {
        enabled: $scope.usePincode.enabled
      },
    };
    configService.set(opts, function(err) {
      if (err) $log.debug(err);
    });
  };

  $scope.recentTransactionsChange = function() {
    var opts = {
      recentTransactions: {
        enabled: $scope.recentTransactionsEnabled.value
      }
    };
    configService.set(opts, function(err) {
      if (err) $log.debug(err);
    });
  };

  $scope.showPincodeModal = function() {
    $scope.fromSettings = true;
    $ionicModal.fromTemplateUrl('views/modals/pincode.html', {
      scope: $scope,
      backdropClickToClose: false,
      hardwareBackButtonClose: false
    }).then(function(modal) {
      $scope.pincodeModal = modal;
      $scope.pincodeModal.show();
    });
  };

  $scope.$on("$ionicView.beforeEnter", function(event, data) {
    updateConfig();
  });

});
