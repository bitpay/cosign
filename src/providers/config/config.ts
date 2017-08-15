import { Injectable } from '@angular/core';
import { Logger } from '@nsalaun/ng-logger';
import { Events } from 'ionic-angular';
import { PlatformProvider } from '../platform/platform';

import * as _ from "lodash";

@Injectable()
export class ConfigProvider {
  private configCache: object;
  private configDefault: object = {
    // wallet limits
    limits: {
      totalCopayers: 6,
      mPlusN: 100
    },

    // wallet default config
    wallet: {
      requiredCopayers: 2,
      totalCopayers: 3,
      spendUnconfirmed: false,
      reconnectDelay: 5000,
      idleDurationMin: 4,
      settings: {
        unitName: 'BTC',
        unitToSatoshi: 100000000,
        unitDecimals: 8,
        unitCode: 'btc',
        alternativeName: 'US Dollar',
        alternativeIsoCode: 'USD'
      }
    },

    // Bitcore wallet service URL
    bws: {
      url: 'https://bws.bitpay.com/bws/api'
    },

    download: {
      bitpay: {
        url: 'https://bitpay.com/wallet'
      },
      copay: {
        url: 'https://copay.io/#download'
      }
    },

    rateApp: {
      bitpay: {
        ios: 'http://itunes.apple.com/WebObjects/MZStore.woa/wa/viewContentsUserReviews?id=1149581638&pageNumber=0&sortOrdering=2&type=Purple+Software&mt=8',
        android: 'https://play.google.com/store/apps/details?id=com.bitpay.wallet',
        wp: ''
      },
      copay: {
        ios: 'http://itunes.apple.com/WebObjects/MZStore.woa/wa/viewContentsUserReviews?id=951330296&pageNumber=0&sortOrdering=2&type=Purple+Software&mt=8',
        android: 'https://play.google.com/store/apps/details?id=com.bitpay.copay',
        wp: ''
      }
    },

    lock: {
      method: null,
      value: null,
      bannedUntil: null
    },

    // External services
    recentTransactions: {
      enabled: true
    },

    hideNextSteps: {
      enabled: this.platform.isWP ? true : false
    },

    rates: {
      url: 'https://insight.bitpay.com:443/api/rates'
    },

    release: {
      url: 'https://api.github.com/repos/bitpay/copay/releases/latest'
    },

    pushNotificationsEnabled: true,

    confirmedTxsNotifications: {
      enabled: true
    },

    emailNotifications: {
      enabled: false
    },

    log: {
      filter: 'debug'
    }
  };

  constructor(
    private logger: Logger,
    private events: Events,
    private platform: PlatformProvider
  ) {
    this.logger.debug('ConfigProvider initialized.');
  }

  public load() {
    return new Promise((resolve, reject) => {
      this.configCache = _.clone(this.configDefault);
      resolve(this.configCache);
    });
  }

  set(newOpts: object) {
    let config = _.cloneDeep(this.configDefault);

    if (_.isString(newOpts)) {
      newOpts = JSON.parse(newOpts);
    }

    _.merge(config, this.configCache, newOpts);
    this.configCache = config;

    this.events.publish('config:updated', this.configCache);
  }

  get() {
    return this.configCache;
  }

}
