'use strict';
angular.module('copayApp.controllers').controller('ProfileController', function($scope, $rootScope, $location, $modal, $filter, $timeout, backupService, identityService) {
  $scope.username = $rootScope.iden.getName();
  $scope.isSafari = Object.prototype.toString.call(window.HTMLElement).indexOf('Constructor') > 0;

  $rootScope.title = 'Profile';
  $scope.hideAdv = true;

  $scope.downloadProfileBackup = function() {
    backupService.profileDownload($rootScope.iden);
  };

  $scope.viewProfileBackup = function() {
    $scope.backupProfilePlainText = backupService.profileEncrypted($rootScope.iden);
    $scope.hideViewProfileBackup = true;
  };

  $scope.deleteWallet = function(w) {
    if (!w) return;
    identityService.deleteWallet(w, function(err) {
      $scope.loading = false;
      if (err) {
        copay.logger.warn(err);
      }
      $scope.setWallets();
    });
  };


  $scope.init = function() {
    if ($rootScope.quotaPerItem) {
      $scope.perItem = $filter('noFractionNumber')($rootScope.quotaPerItem / 1000, 1);
      $scope.nrWallets = parseInt($rootScope.quotaItems) - 1;
    }
    // no need to add event handlers here. Wallet deletion is handle by callback.
  };

  $scope.setWallets = function() {
    if (!$rootScope.iden) return;

    var wallets = $rootScope.iden.listWallets();
    var max = $rootScope.quotaPerItem;

    _.each(wallets, function(w) {
      var bits = w.sizes().total;
      w.kb = $filter('noFractionNumber')(bits / 1000, 1);
      if (max) {
        w.usage = $filter('noFractionNumber')(bits / max * 100, 0);
      }
    });
    $scope.wallets = wallets;
    $timeout(function(){
      $scope.$digest();
    })
  };

  $scope.downloadWalletBackup = function(w) {
    if (!w) return;
    backupService.walletDownload(w);
  }

  $scope.viewWalletBackup = function(w) {
    var ModalInstanceCtrl = function($scope, $modalInstance) {

      if (!w) return;
      $scope.backupWalletPlainText = backupService.walletEncrypted(w);
      $scope.hideViewWalletBackup = true;
      $scope.cancel = function() {
        $modalInstance.dismiss('cancel');
      };
    };

    $modal.open({
      templateUrl: 'views/modals/backup-text.html',
      windowClass: 'tiny',
      controller: ModalInstanceCtrl
    });
  };

  $scope.deleteProfile = function() {
    identityService.deleteProfile(function(err, res) {
      if (err) {
        log.warn(err);
        notification.error('Error', 'Could not delete profile');
        return;
      }
      $location.path('/');
      setTimeout(function() {
        notification.error('Success', 'Profile successfully deleted');
      }, 1);
    });
  };
});
