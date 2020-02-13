import { Component } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ActionSheetController, NavController } from 'ionic-angular';

import * as _ from 'lodash';

import { BitPayAccountProvider } from '../../../../../../providers/bitpay-account/bitpay-account';
import { BitPayCardProvider } from '../../../../../../providers/bitpay-card/bitpay-card';
import { ExternalLinkProvider } from '../../../../../../providers/external-link/external-link';
import { PopupProvider } from '../../../../../../providers/popup/popup';


@Component({
  selector: 'page-bitpay-phase-one-card-intro',
  templateUrl: './phase-one-intro-page.html'
})

export class PhaseOneCardIntro {
  public accounts;

  constructor(
    private translate: TranslateService,
    private actionSheetCtrl: ActionSheetController,
    private bitPayAccountProvider: BitPayAccountProvider,
    private bitPayCardProvider: BitPayCardProvider,
    private externalLinkProvider: ExternalLinkProvider,
    public navCtrl: NavController,
    private popupProvider: PopupProvider,
  ) {
  }

  ionViewWillEnter() {
    this.bitPayAccountProvider.getAccounts((err, accounts) => {
      if (err) {
        this.popupProvider.ionicAlert(this.translate.instant('Error'), err);
        return;
      }
      this.accounts = accounts;
    });
  }

  public bitPayCardInfo() {
    let url = 'https://bitpay.com/visa/faq';
    this.externalLinkProvider.open(url);
  }

  public goBack() {
    this.navCtrl.pop();
  }

  public async orderBitPayCard() {
    this.bitPayCardProvider.logEvent('legacycard_order', {});
    let url = 'https://bitpay.com/visa/get-started';
    this.externalLinkProvider.open(url);
  }

  public connectBitPayCard() {
    this.bitPayCardProvider.logEvent('legacycard_connect', {});
    if (this.accounts.length == 0) {
      this.startPairBitPayAccount();
    } else {
      this.showAccountSelector();
    }
  }

  private startPairBitPayAccount() {
    this.navCtrl.popToRoot({ animate: false }); // Back to Root
    let url = 'https://bitpay.com/visa/dashboard/add-to-bitpay-wallet-confirm';
    this.externalLinkProvider.open(url);
  }

  private showAccountSelector() {
    let options = [];

    _.forEach(this.accounts, account => {
      options.push({
        text:
          (account.givenName || account.familyName) +
          ' (' +
          account.email +
          ')',
        handler: () => {
          this.onAccountSelect(account);
        }
      });
    });

    // Add account
    options.push({
      text: this.translate.instant('Add account'),
      handler: () => {
        this.onAccountSelect();
      }
    });

    // Cancel
    options.push({
      text: this.translate.instant('Cancel'),
      role: 'cancel'
    });

    let actionSheet = this.actionSheetCtrl.create({
      title: this.translate.instant('From BitPay account'),
      buttons: options
    });
    actionSheet.present();
  }

  private onAccountSelect(account?): void {
    if (_.isUndefined(account)) {
      this.startPairBitPayAccount();
    } else {
      this.bitPayCardProvider.sync(account.apiContext, err => {
        if (err) {
          this.popupProvider.ionicAlert(this.translate.instant('Error'), err);
          return;
        }
        this.navCtrl.pop();
      });
    }
  }
}
