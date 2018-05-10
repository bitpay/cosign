import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import * as _ from 'lodash';
import { Logger } from '../../providers/logger/logger';

// providers
import { ConfigProvider } from '../config/config';
import { HomeIntegrationsProvider } from '../home-integrations/home-integrations';
import { PersistenceProvider } from '../persistence/persistence';


@Injectable()
export class AmazonProvider {

  public credentials: any;
  public limitPerDay: number;
  public country: string;
  public currency: string;

  constructor(
    private http: HttpClient,
    private logger: Logger,
    private persistenceProvider: PersistenceProvider,
    private homeIntegrationsProvider: HomeIntegrationsProvider,
    private configProvider: ConfigProvider
  ) {
    this.logger.info('AmazonProvider initialized.');
    this.credentials = {};
    this.setCountryParameters('usa');
    /*
    * Development: 'testnet'
    * Production: 'livenet'
    */
    this.credentials.NETWORK = 'livenet';
    this.credentials.BITPAY_API_URL = this.credentials.NETWORK === 'testnet' ? "https://test.bitpay.com" : "https://bitpay.com";
  }

  public getNetwork() {
    return this.credentials.NETWORK;
  }

  public setCountryParameters(country: string): void {
    this.country = country;
    switch (country) {
      case 'japan':
        this.currency = 'JPY';
        this.limitPerDay = 200000;
        break;
      case 'usa':
        this.currency = 'USD';
        this.limitPerDay = 2000;
      default:
        break;
    }
  }

  public getCountry(): string {
    return this.country;
  }

  public getCurrency(): string {
    return this.currency;
  }

  public savePendingGiftCard(gc, opts, cb) {
    var network = this.getNetwork();
    this.persistenceProvider.getAmazonGiftCards(network, this.country).then((oldGiftCards) => {
      if (_.isString(oldGiftCards)) {
        oldGiftCards = JSON.parse(oldGiftCards);
      }
      if (_.isString(gc)) {
        gc = JSON.parse(gc);
      }
      var inv = oldGiftCards || {};
      inv[gc.invoiceId] = gc;
      if (opts && (opts.error || opts.status)) {
        inv[gc.invoiceId] = _.assign(inv[gc.invoiceId], opts);
      }
      if (opts && opts.remove) {
        delete (inv[gc.invoiceId]);
      }

      inv = JSON.stringify(inv);
      this.persistenceProvider.setAmazonGiftCards(network, inv, this.country);
      return cb(null);
    });
  }

  public getPendingGiftCards(cb) {
    var network = this.getNetwork();
    this.persistenceProvider.getAmazonGiftCards(network, this.country).then((giftCards) => {
      var _gcds = giftCards ? giftCards : null;
      return cb(null, _gcds);
    }).catch((err) => {
      return cb(err);
    });
  }

  public createBitPayInvoice(data, cb) {
    var dataSrc = {
      currency: data.currency,
      amount: data.amount,
      clientId: data.uuid,
      email: data.email,
      buyerSelectedTransactionCurrency: data.buyerSelectedTransactionCurrency
    };

    this.http.post(this.credentials.BITPAY_API_URL + '/amazon-gift/pay', dataSrc).subscribe((data: any) => {
      this.logger.info('BitPay Create Invoice: SUCCESS');
      return cb(null, data);
    }, (data) => {
      this.logger.error('BitPay Create Invoice: ERROR ' + data.error.message);
      return cb(data.error);
    });
  }

  public getBitPayInvoice(id, cb) {
    this.http.get(this.credentials.BITPAY_API_URL + '/invoices/' + id).subscribe((data: any) => {
      this.logger.info('BitPay Get Invoice: SUCCESS');
      return cb(null, data.data);
    }, (data: any) => {
      this.logger.error('BitPay Get Invoice: ERROR ' + data.error.message);
      return cb(data.error.message);
    });
  }

  public createGiftCard(data, cb) {

    var dataSrc = {
      "clientId": data.uuid,
      "invoiceId": data.invoiceId,
      "accessKey": data.accessKey
    };

    this.http.post(this.credentials.BITPAY_API_URL + '/amazon-gift/redeem', dataSrc).subscribe((data: any) => {
      var status = data.status == 'new' ? 'PENDING' : (data.status == 'paid') ? 'PENDING' : data.status;
      data.status = status;
      this.logger.info('Amazon.com Gift Card Create/Update: ' + status);
      return cb(null, data);
    }, (data: any) => {
      this.logger.error('Amazon.com Gift Card Create/Update: ' + data.message);
      return cb(data);
    });
  }

  public cancelGiftCard(data, cb) {

    var dataSrc = {
      "clientId": data.uuid,
      "invoiceId": data.invoiceId,
      "accessKey": data.accessKey
    };

    this.http.post(this.credentials.BITPAY_API_URL + '/amazon-gift/cancel', dataSrc).subscribe((data: any) => {
      this.logger.info('Amazon.com Gift Card Cancel: SUCCESS');
      return cb(null, data);
    }, (data: any) => {
      this.logger.error('Amazon.com Gift Card Cancel: ' + data.message);
      return cb(data);
    });
  }

  public register() {
    this.homeIntegrationsProvider.register({
      name: 'amazon',
      title: 'Amazon.com Gift Cards',
      icon: 'assets/img/amazon/icon-amazon.svg',
      page: 'AmazonPage',
      show: !!this.configProvider.get().showIntegration['amazon']
    });
    this.homeIntegrationsProvider.register({
      name: 'amazonJapan',
      title: 'Amazon.co.jp Gift Cards',
      icon: 'assets/img/amazon/icon-amazon.svg',
      page: 'AmazonPage',
      show: !!this.configProvider.get().showIntegration['amazonJapan']
    });
  }

}
