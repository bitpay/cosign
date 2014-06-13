'use strict';
//
// test/unit/directives/directivesSpec.js
//
describe("Unit: Testing Directives", function() {

  var $scope, form;

  beforeEach(module('copayApp.directives'));

  describe('Validate Address', function() {
    beforeEach(inject(function($compile, $rootScope) {
      $scope = $rootScope;
      var element = angular.element(
        '<form name="form">' +
        '<input type="text" id="address" name="address" placeholder="Send to" ng-model="address" valid-address required>' +
        '</form>'
      );
      $scope.model = {
        address: null
      };
      $compile(element)($scope);
      $scope.$digest();
      form = $scope.form;
    }));

    it('should validate', function() {
      form.address.$setViewValue('mkfTyEk7tfgV611Z4ESwDDSZwhsZdbMpVy');
      expect(form.address.$invalid).to.equal(false);
    });
    it('should not validate', function() {
      form.address.$setViewValue('thisisaninvalidaddress');
      expect(form.address.$invalid).to.equal(true);
    });
  });

  describe('Validate Amount', function() {
    beforeEach(inject(function($compile, $rootScope) {
      $scope = $rootScope;
      $rootScope.availableBalance = 0.101;
      var element = angular.element(
        '<form name="form">' +
        '<input type="number" id="amount" name="amount" placeholder="Amount" ng-model="amount" min="0.0001" max="10000000" enough-amount required>' +
        '</form>'
      );
      $scope.model = {
        amount: null
      };
      $compile(element)($scope);
      $scope.$digest();
      form = $scope.form;
    }));

    it('should validate', function() {
      form.amount.$setViewValue(0.1);
      expect(form.amount.$invalid).to.equal(false);
      form.amount.$setViewValue(0.1009);
      expect(form.amount.$invalid).to.equal(false);
    });
    it('should not validate', function() {
      form.amount.$setViewValue(0);
      expect(form.amount.$invalid).to.equal(true);
      form.amount.$setViewValue(9999999999);
      expect(form.amount.$invalid).to.equal(true);
      form.amount.$setViewValue(2.1);
      expect(form.amount.$invalid).to.equal(true);
      form.amount.$setViewValue(0.10091);
      expect(form.amount.$invalid).to.equal(true);
    });
  });

  describe('Password strength', function() {
    beforeEach(inject(function($compile, $rootScope) {
      $scope = $rootScope;
      var element = angular.element(
        '<input type="password" name="password" ng-model="password" check-strength="passwordStrength" value="asd" required>'
      );
      $compile(element)($scope);
      $scope.$digest();
    }));

    it('should check very weak password', function() {
      $scope.password = 'asd';
      $scope.$digest();
      expect($scope.passwordStrength).to.equal('very weak');
    });

    it('should check weak password', function() {
      $scope.password = 'asdasdASDASD';
      $scope.$digest();
      expect($scope.passwordStrength).to.equal('weak');
    });

    it('should check medium password', function() {
      $scope.password = 'asdasdASDASD1';
      $scope.$digest();
      expect($scope.passwordStrength).to.equal('medium');
    });

    it('should check strong password', function() {
      $scope.password = 'asdasdASDASD1{';
      $scope.$digest();
      expect($scope.passwordStrength).to.equal('strong');
    });

  });
});
