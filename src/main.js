/**
 * Podcast feed WDC config.
 */

/* globals module */

(function(root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory(require('jQuery'), require('moment'));
  }
  else {
    root._wdcwConfig = factory(root.jQuery, root.moment);
  }
} (this, function ($, moment) {
  var wdcwConfig = {tables: {}};

  // Basic details about our WDC.
  wdcwConfig.name = 'Podcast WDC';
  wdcwConfig.authType = 'none';

  // Pull schema details from JSON.
  wdcwConfig.schema = function getPodcastSchema() {
    return Promise.all([
      $.when($.getJSON('./src/schema-channels.json')),
      $.when($.getJSON('./src/schema-episodes.json'))
    ]);
  };

  // Provide space for channel and episode getters/processors.
  wdcwConfig.tables.channels = {};
  wdcwConfig.tables.episodes = {};

  // Primary data getter; promises to return podcast XML for each URL.
  wdcwConfig.tables.channels.getData = function () {
    var urls = this.getConnectionData('FeedURLs').split("\n");

    return Promise.all(urls.map(function (url) {
      return $.when($.ajax('/proxy?feed_url=' + encodeURI(url)));
    }));
  };

  // Episode data depends on channels, so we just echo it back.
  wdcwConfig.tables.episodes.getData = function (token, channelData) {
    // Just return the XML feeds as parsed by the channel data getter.
    return Promise.resolve(channelData[0]);
  };

  // Parse channel-level detail from the XML using jQuery.
  wdcwConfig.tables.channels.postProcess = function (channelDocuments) {
    var processedData = [];

    // Iterate through each channel document.
    channelDocuments.forEach(function (data) {
      var $channel = $(data).find('channel'),
          record = {};

      // Extract the data we care about.
      record.title = $channel.find('title').first().text();
      record.link = $channel.find('link').first().text();
      record.description = $channel.find('description').first().text();
      record.author = $channel.find('author').first().text();
      record.lastBuildDate = moment($channel.find('lastBuildDate').text()).format('YYYY-M-D HH:mm:ss');
      record.language = $channel.find('language').text();

      // If no author metadata was found, check the itunes namespace.
      record.author = record.author || $channel.find('itunes\\:author, author').first().text();

      // Push the channel onto the processedData array.
      processedData.push(record);
    });

    return Promise.resolve(processedData);
  };

  // Parse episode-level detail from the XML using jQuery.
  wdcwConfig.tables.episodes.postProcess = function (channelDocuments) {
    var processedData = [];

    // Iterate through each channel document.
    channelDocuments.forEach(function (data) {
      var $items = $(data).find('channel item'),
          channelName = $(data).find('channel > title').first().text();

      // Iterate through each item found underneath the channel.
      $items.each(function (index, item) {
        var $item = $(item),
            record = {};

        // Extract "standard" RSS XML data.
        record.channel = channelName;
        record.title = $item.find('title').first().text();
        record.link = $item.find('link').first().text();
        record.description = $item.find('description').first().text();
        record.pubDate = moment($item.find('pubDate').text()).format('YYYY-M-D HH:mm:ss');
        record.guid = $item.find('guid').text();
        record.enclosure_url = $item.find('enclosure').attr('url');
        record.enclosure_type = $item.find('enclosure').attr('type');

        // Extract itunes and podcast-specific metadata.
        record.thumbnail = $item.find('media\\:thumbnail, thumbnail').attr('url');
        record.explicit = $item.find('itunes\\:explicit, explicit').text();
        record.duration = $item.find('itunes\\:duration, duration').text();

        // Convert explicit to a bool.
        record.explicit = record.explicit === 'yes' ? true : false;

        // Convert duration to number of seconds.
        if (record.duration) {
          record.duration = moment.duration('00:' + record.duration).asSeconds();
        }

        // Push our parsed record onto the array.
        processedData.push(record);
      });
    });

    return Promise.resolve(processedData);
  };

  return wdcwConfig;
}));

// Instantiate the WDC with our config from above.
wdcw(_wdcwConfig);
