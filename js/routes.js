'use strict';

//Setting up route
angular
  .module('copayApp')
  .config(function($routeProvider) {

    $routeProvider
      .when('/', {
        templateUrl: 'views/home.html',
        validate: false
      })
      .when('/open', {
        templateUrl: 'views/open.html',
        validate: false
      })
      .when('/join', {
        templateUrl: 'views/join.html',
        validate: false
      })
      .when('/import', {
        templateUrl: 'views/import.html',
        validate: false
      })
      .when('/setup', {
        templateUrl: 'views/setup.html',
        validate: false
      })
      .when('/copayers', {
        templateUrl: 'views/copayers.html',
        validate: true
      })
      .when('/receive', {
        templateUrl: 'views/addresses.html',
        validate: true
      })
      .when('/history', {
        templateUrl: 'views/transactions.html',
        validate: true
      })
      .when('/send', {
        templateUrl: 'views/send.html',
        validate: true
      })
      .when('/backup', {
        templateUrl: 'views/backup.html',
        validate: true
      })
      .when('/settings', {
        templateUrl: 'views/settings.html',
        validate: false
      })
      .when('/unsupported', {
        templateUrl: 'views/unsupported.html'
      })
      .when('/uri-payment/:data', {
        templateUrl: 'views/uri-payment.html'
      })
      .when('/warning', {
        templateUrl: 'views/warning.html',
        validate: true
      })
      .otherwise({
        templateUrl: 'views/errors/404.html',
        title: 'Error'
      });
  });

//Setting HTML5 Location Mode
angular
  .module('copayApp')
  .config(function($locationProvider, $idleProvider) {
    $locationProvider
      .html5Mode(false)
      .hashPrefix('!');
    // IDLE timeout
    $idleProvider.idleDuration(15 * 60); // in seconds
    $idleProvider.warningDuration(10); // in seconds
  })
  .run(function($rootScope, $location, $idle) {
    $idle.watch();
    $rootScope.$on('$routeChangeStart', function(event, next, current) {
      if (!util.supports.data) {
        $location.path('unsupported');
      } else {
        if ((!$rootScope.wallet || !$rootScope.wallet.id) && next.validate) {
          $idle.unwatch();
          $location.path('/');
        }
        if ($rootScope.wallet && !$rootScope.wallet.isReady()) {
          $location.path('/copayers');
        }
        if ($rootScope.wallet && $rootScope.wallet.isLocked) {
          $location.path('/warning');
        }
      }
    });
  })
  .config(function($compileProvider) {
    $compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|ftp|mailto|file|tel|chrome-extension|resource):/);
  });
