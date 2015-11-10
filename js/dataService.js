var app = angular.module("statsApp.dataService", []);
app.service('dataService', function($rootScope) {
  var root = {};

  root.refresh = function(opts) {
    //opts.network = $('#network').val();
    root.fetch(opts, function(err, data) {
      if (err) {
        self.error('Could not fetch data');
        return;
      }
      root.show(data);
    });
  };

  root.fetch = function(opts, cb) {
    var to = moment().subtract(1, 'days').format('YYYY-MM-DD');
    var url_ = opts.url + '/v1/stats/?network=' + opts.network + '&from=' + opts.from + '&to=' + to;

    d3.json(url_)
      .get(function(err, data) {
        if (err) return cb(err);
        if (!data || _.isEmpty(data)) return cb('No data');

        var data = root.transform(data);
        return cb(null, data);
      });
  };

  root.transform = function(data) {
    var parseDate = d3.time.format('%Y%m%d').parse;

    var result = {};
    _.each(data.newWallets.byDay, function(d) {
      if (!result[d.day]) result[d.day] = {};
      result[d.day].walletCount = d.count;
    });

    _.each(data.txProposals.amountByDay, function(d) {
      if (!result[d.day]) result[d.day] = {};
      result[d.day].txAmount = d.amount / 1e8;
    });

    _.each(data.txProposals.nbByDay, function(d) {
      if (!result[d.day]) result[d.day] = {};
      result[d.day].txCount = d.count;
    });

    return _.map(result, function(v, k) {
      var d = new Date(parseDate(k));

      return {
        date: parseDate(k),
        amount: v.txAmount,
        txps: v.txCount,
        wallets: v.walletCount,
        week: d.getFullYear() + '-' + d.getWeek(),
        month: d.getFullYear() + '-' + d.getMonth()
      };
    });
  };

  Date.prototype.getWeek = function() {
    var onejan = new Date(this.getFullYear(), 0, 1);
    return Math.ceil((((this - onejan) / 86400000) + onejan.getDay() + 1) / 7);
  }

  root.error = function(msg) {
    alert(msg);
  };

  root.show = function(data) {
    root.showTotals(data);
    root.showWallets(data);
    root.showTransactions(data);
    root.showAmount(data);
    $rootScope.$emit('Data/Finish');
  };

  root.showTotals = function(data) {
    function addCommas(nStr) {
      nStr += '';
      var x = nStr.split('.');
      var x1 = x[0];
      var x2 = x.length > 1 ? '.' + x[1] : '';
      var rgx = /(\d+)(\d{3})/;
      while (rgx.test(x1)) {
        x1 = x1.replace(rgx, '$1' + ',' + '$2');
      }
      return x1 + x2;
    };

    var total = _.reduce(data, function(memo, d) {
      memo.wallets += (d.wallets || 0);
      memo.txps += (d.txps || 0);
      memo.amount += (d.amount || 0);
      return memo;
    }, {
      wallets: 0,
      txps: 0,
      amount: 0
    });

    $('#total-wallets .value').html(addCommas(total.wallets));
    $('#total-txps .value').html(addCommas(total.txps));
    $('#total-amount .value').html(addCommas(total.amount.toFixed(2)));
  };

  root.showWallets = function(data) {
    var byMonth = _.groupBy(data, 'month');
    var byMonthGrouped = _.map(byMonth, function(v, k) {
      return {
        x: v[0].date,
        y: _.sum(v, function(d) {
          return d.wallets;
        })
      }
    });

    var byWeek = _.groupBy(data, 'week');
    var byWeekGrouped = _.map(byWeek, function(v, k) {
      return {
        x: v[0].date,
        y: _.sum(v, function(d) {
          return d.wallets;
        })
      }
    });

    var walletsPerMonth = [{
      key: '# of New wallets per month',
      values: byMonthGrouped
    }];

    var walletsPerWeek = [{
      key: '# of New wallets per week',
      values: byWeekGrouped
    }];

    var walletsPerDay = [{
      key: '# of New wallets per day',
      values: _.map(data, function(d) {
        return {
          x: d.date,
          y: d.wallets || 0,
        };
      }),
    }];

    $('#interval').change(function() {
      nv.addGraph(function() {
        var interval = $('#interval').val();
        var opts = {};

        if (interval == 'perDay') {
          opts.coords = walletsPerDay;
          opts.format = '%b %d';
          opts.label = walletsPerDay[0].key;
        } else if (interval == 'perMonth') {
          opts.coords = walletsPerMonth;
          opts.format = '%b';
          opts.label = walletsPerMonth[0].key;
        } else if (interval == 'perWeek') {
          opts.coords = walletsPerWeek;
          opts.format = '%W';
          opts.label = walletsPerWeek[0].key;
        }
        var chart = nv.models.lineChart()
          .useInteractiveGuideline(true);

        chart.xAxis
          .tickFormat(function(d) {
            return d3.time.format(opts.format)(new Date(d));
          });

        chart.yAxis
          .axisLabel(opts.label)
          .tickFormat(d3.format(',f'));

        d3.select('#chart-wallets svg').remove();
        d3.select('#chart-wallets')
          .append('svg')
          .datum(opts.coords)
          .transition().duration(500)
          .call(chart);

        nv.utils.windowResize(chart.update);

        return chart;
      });
    }).trigger('change');
  };

  root.showTransactions = function(data) {
    data = [{
      key: '# of Transaction proposals',
      values: _.map(data, function(d) {
        return {
          x: d.date,
          y: d.txps || 0,
        };
      }),
    }];

    nv.addGraph(function() {
      var chart = nv.models.lineChart()
        .useInteractiveGuideline(true);

      chart.xAxis
        .tickFormat(function(d) {
          return d3.time.format('%b %d')(new Date(d));
        });

      chart.yAxis
        .axisLabel(data[0].key)
        .tickFormat(d3.format(',f'));

      d3.select('#chart-txps svg').remove();
      d3.select('#chart-txps')
        .append('svg')
        .datum(data)
        .transition().duration(500)
        .call(chart);

      nv.utils.windowResize(chart.update);

      return chart;
    });
  };

  root.showAmount = function(data) {
    data = [{
      key: 'Amount sent (BTC)',
      values: _.map(data, function(d) {
        return {
          x: d.date,
          y: d.amount || 0,
        };
      }),
    }];

    nv.addGraph(function() {
      var chart = nv.models.lineChart()
        .useInteractiveGuideline(true);

      chart.xAxis
        .tickFormat(function(d) {
          return d3.time.format('%b %d')(new Date(d));
        });

      chart.yAxis
        .axisLabel(data[0].key)
        .tickFormat(d3.format('.02f'));

      d3.select('#chart-amount svg').remove();
      d3.select('#chart-amount')
        .append('svg')
        .datum(data)
        .transition().duration(500)
        .call(chart);

      nv.utils.windowResize(chart.update);

      return chart;
    });
  };

  return root;
});
