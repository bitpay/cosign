import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { Events, NavParams } from 'ionic-angular';

import { Coin } from '../../providers/wallet/wallet';
import { TestUtils } from '../../test';
import { WalletTabsChild } from '../wallet-tabs/wallet-tabs-child';
import { WalletTabsProvider } from '../wallet-tabs/wallet-tabs.provider';

// pages
import { AddressbookAddPage } from '../settings/addressbook/add/add';
import { AmountPage } from './amount/amount';
import { SendPage } from './send';

describe('SendPage', () => {
  let fixture: ComponentFixture<SendPage>;
  let instance;
  let testBed: typeof TestBed;

  const wallet = {
    coin: 'bch',
    status: {
      totalBalanceStr: '1.000000'
    }
  };

  beforeEach(async(() => {
    spyOn(WalletTabsChild.prototype, 'getParentWallet').and.returnValue(wallet);
    TestUtils.configurePageTestingModule([SendPage]).then(testEnv => {
      fixture = testEnv.fixture;
      instance = testEnv.instance;
      instance.wallet = wallet;
      testBed = testEnv.testBed;
      fixture.detectChanges();
    });
  }));
  afterEach(() => {
    fixture.destroy();
  });

  describe('Lifecycle Hooks', () => {
    describe('ionViewDidLoad', () => {
      it('should not break', () => {
        instance.ionViewDidLoad();
      });
    });

    describe('ionViewWillEnter', () => {
      it('should call get functions and subscribe to events', () => {
        const profileProviderSpy = spyOn(
          instance.profileProvider,
          'getWallets'
        );
        const getBtcWalletsListSpy = spyOn(instance, 'getBtcWalletsList');
        const subscribeSpy = spyOn(instance.events, 'subscribe');
        instance.ionViewWillEnter();
        expect(profileProviderSpy).toHaveBeenCalledWith({ coin: 'btc' });
        expect(profileProviderSpy).toHaveBeenCalledWith({ coin: 'bch' });
        expect(subscribeSpy).toHaveBeenCalledTimes(1);
        expect(getBtcWalletsListSpy).toHaveBeenCalled();
      });
    });
    describe('ionViewDidEnter', () => {
      it('should clear search input', () => {
        instance.ionViewDidEnter();
        expect(instance.search).toBe('');
      });
    });
    describe('ionViewWillLeave', () => {
      it('should unsubscribe from events', () => {
        const spy = spyOn(instance.events, 'unsubscribe');
        instance.ionViewWillLeave();
        expect(spy).toHaveBeenCalledWith('finishIncomingDataMenuEvent');
      });
    });
  });

  describe('goToUrl', () => {
    it('should call external link provider with the provided url', () => {
      const openSpy = spyOn(instance.externalLinkProvider, 'open');
      instance.goToUrl('https://bitpay.com/');
      expect(openSpy).toHaveBeenCalledWith('https://bitpay.com/');
    });
  });

  describe('sendPaymentToAddress', () => {
    it('should go to amount page with correct params', () => {
      instance.sendPaymentToAddress(
        'mirvQBSEktFGQ7TEK1UAifqjyewZsRou88',
        'btc'
      );
      expect(instance.navCtrl.push).toHaveBeenCalledWith(AmountPage, {
        toAddress: 'mirvQBSEktFGQ7TEK1UAifqjyewZsRou88',
        coin: 'btc'
      });
    });
  });

  describe('addToAddressBook', () => {
    it('should go to address book page with correct params', () => {
      instance.addToAddressBook('mirvQBSEktFGQ7TEK1UAifqjyewZsRou88');
      expect(instance.navCtrl.push).toHaveBeenCalledWith(AddressbookAddPage, {
        addressbookEntry: 'mirvQBSEktFGQ7TEK1UAifqjyewZsRou88'
      });
    });
  });

  describe('openScanner', () => {
    it('should pass the pre-selected amount, coin, and sendMax values to the scanner', () => {
      const walletTabsProvider: WalletTabsProvider = testBed.get(
        WalletTabsProvider
      );
      const events: Events = testBed.get(Events);
      const navParams: NavParams = testBed.get(NavParams);
      const amount = '1.00000';
      const coin = Coin.BCH;
      instance.useSendMax = false;
      spyOn(navParams, 'get').and.returnValues(amount, coin);
      const sendParamsSpy = spyOn(walletTabsProvider, 'setSendParams');
      const publishSpy = spyOn(events, 'publish');
      instance.openScanner();
      expect(sendParamsSpy).toHaveBeenCalledWith({
        amount,
        coin,
        useSendMax: false
      });
      expect(publishSpy).toHaveBeenCalledWith('ScanFromWallet');
    });
  });

  describe('searchWallets', () => {
    beforeEach(() => {
      instance.walletBtcList = [
        {
          name: 'test1',
          coin: 'btc'
        },
        {
          name: 'test2',
          coin: 'btc'
        }
      ];

      instance.walletBchList = [
        {
          name: 'test3',
          coin: 'bch'
        },
        {
          name: 'test4',
          coin: 'bch'
        }
      ];
    });

    it('should filter BTC wallets when search by wallet name', () => {
      instance.hasBtcWallets = true;
      instance.wallet.coin = 'btc';

      instance.search = 'test';
      instance.searchWallets();
      expect(instance.filteredWallets).toEqual(instance.walletBtcList);

      instance.search = 'TEST1';
      instance.searchWallets();
      expect(instance.filteredWallets).toEqual([instance.walletBtcList[0]]);

      instance.search = 'test3';
      instance.searchWallets();
      expect(instance.filteredWallets).toEqual([]);
    });

    it('should filter BCH wallets when search by wallet name', () => {
      instance.hasBchWallets = true;
      instance.wallet.coin = 'bch';

      instance.search = 'test';
      instance.searchWallets();
      expect(instance.filteredWallets).toEqual(instance.walletBchList);

      instance.search = 'TEST3';
      instance.searchWallets();
      expect(instance.filteredWallets).toEqual([instance.walletBchList[0]]);

      instance.search = 'test1';
      instance.searchWallets();
      expect(instance.filteredWallets).toEqual([]);
    });
  });

  describe('processInput', () => {
    beforeEach(() => {
      instance.walletBtcList = [
        {
          name: 'test1',
          coin: 'btc'
        },
        {
          name: 'test2',
          coin: 'btc'
        },
        {
          name: 'differentWalletName',
          coin: 'btc'
        }
      ];

      instance.walletBchList = [
        {
          name: 'test3',
          coin: 'bch'
        },
        {
          name: 'test4',
          coin: 'bch'
        }
      ];

      instance.contactsList = [
        {
          name: 'test contact'
        },
        {
          name: 'contact2'
        }
      ];
    });
    it('should filter BTC wallets and Contacts when search something', () => {
      instance.hasBtcWallets = true;
      instance.wallet.coin = 'btc';
      instance.search = 'test';
      instance.processInput();
      expect(instance.filteredWallets.length).toEqual(2);
      expect(instance.filteredContactsList.length).toEqual(1);
      expect(instance.invalidAddress).toBeFalsy();
    });

    it('should check address coin and network and set invalid address with true', () => {
      instance.hasBtcWallets = true;
      instance.wallet.coin = 'btc';
      instance.wallet.network = 'testnet';
      instance.search = 'qqycye950l689c98l7z5j43n4484ssnp4y3uu4ramr'; // bch testnet address
      instance.processInput();
      expect(instance.filteredWallets.length).toEqual(0);
      expect(instance.filteredContactsList.length).toEqual(0);
      expect(instance.invalidAddress).toBeTruthy();
    });

    it('should check address coin and network, set invalid address with false and run redir function', () => {
      const redirSpy = spyOn(instance.incomingDataProvider, 'redir');
      instance.hasBtcWallets = true;
      instance.wallet.coin = 'btc';
      instance.wallet.network = 'testnet';
      instance.search = 'mirvQBSEktFGQ7TEK1UAifqjyewZsRou88'; // btc testnet address
      instance.navParams.data.amount = 11111111;
      instance.navParams.data.coin = 'btc';
      instance.useSendMax = false;

      instance.processInput();
      expect(redirSpy).toHaveBeenCalledWith(
        'mirvQBSEktFGQ7TEK1UAifqjyewZsRou88',
        {
          amount: 11111111,
          coin: 'btc',
          useSendMax: false
        }
      );
      expect(instance.invalidAddress).toBeFalsy();
    });

    it('should reset values to default when search input is empty', () => {
      const updateContactsListSpy = spyOn(instance, 'updateContactsList');
      instance.search = '';
      instance.processInput();
      expect(updateContactsListSpy).toHaveBeenCalled();
      expect(instance.filteredWallets).toEqual([]);
    });
  });
});
