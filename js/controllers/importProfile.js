'use strict';

angular.module('copayApp.controllers').controller('ImportProfileController',
  function($scope, $rootScope, $location, controllerUtils, notification, isMobile, pluginManager) {
    controllerUtils.redirIfLogged();

    $scope.title = 'Import a backup';
    $scope.importStatus = 'Importing wallet - Reading backup...';
    $scope.hideAdv = true;
    $scope.is_iOS = isMobile.iOS();

    var reader = new FileReader();

    var updateStatus = function(status) {
      $scope.importStatus = status;
      $scope.$digest();
    }

    var _importBackup = function(str) {
      var password = $scope.password;
      updateStatus('Importing profile - Setting things up...');

      copay.Identity.importFromEncryptedFullJson(str, password, {
        pluginManager: pluginManager,
        network: config.network,
        networkName: config.networkName,
        walletDefaults: config.wallet,
        passphraseConfig: config.passphraseConfig,
      }, function(err, iden) {
        if (err && !iden) {
          $scope.error = (err.toString() || '').match('BADSTR') ? 'Bad password or corrupt profile file' : 'Unknown error';
        } else {
          notification.info('Success', 'Profile imported successfully');
          $location.path('/');
        }
      });
    };

    $scope.openFileDialog = function() {
      if (window.cshell) {
        return cshell.send('backup:import');
      }
      $scope.choosefile = !$scope.choosefile;
    };

    $scope.getFile = function() {
      // If we use onloadend, we need to check the readyState.
      reader.onloadend = function(evt) {
        if (evt.target.readyState == FileReader.DONE) { // DONE == 2
          var encryptedObj = evt.target.result;
          _importBackup(encryptedObj);
        }
      };
    };

    $scope.import = function(form) {

      if (form.$invalid) {
        $scope.loading = false;
        $scope.error = 'Please enter the required fields';
        return;
      }
      $rootScope.starting = true;

      var backupFile = $scope.file;
      var backupText = form.backupText.$modelValue;
      var password = form.password.$modelValue;

      if (!backupFile && !backupText) {
        $scope.loading = false;
        $scope.error = 'Please, select your backup file';
        return;
      }

      if (backupFile) {
        reader.readAsBinaryString(backupFile);
      } else {
        _importBackup(backupText);
      }
    };
  });
