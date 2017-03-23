const Bacon = require('baconjs');
const debug = require('debug')('signalk-to-nmea2000')
const util = require('util')

module.exports = function(app) {
  var plugin = {
    unsubscribes: []
  };

  plugin.id = "sk-to-nmea2000"
  plugin.name = "Convert Signal K to NMEA2000"
  plugin.description = "Plugin to convert Signal K to NMEA2000"

  plugin.schema = {
    type: "object",
    title: "Conversions to NMEA2000",
    description: "If there is SK data for the conversion generate the following NMEA2000 pgns from Signal K data:",
    properties: {
      WIND: {
        type: "boolean",
        default: false
      },
      GPS: {
        type: "boolean",
        default: false
      }
    }
  }
  plugin.start = function(options) {
    debug("signalk-to-nmea2000: start")
    const selfContext = 'vessels.' + app.selfId
    const selfMatcher = (delta) => delta.context && delta.context === selfContext

    function mapToNmea(encoder) {
      const selfStreams = encoder.keys.map(app.streambundle.getSelfStream, app.streambundle)
      plugin.unsubscribes.push(Bacon.combineWith(encoder.f, selfStreams).changes().debounceImmediate(20).log().onValue(nmeaString => {
        debug("emit: " + nmeaString)
        app.emit('nmea2000out', nmeaString)
      }))
    }

    if (options.WIND) {
      mapToNmea(WIND);
    }
    if (options.GPS) {
      mapToNmea(GPS);
    }
  }

  plugin.stop = function() {
    plugin.unsubscribes.forEach(f => f())
  }

  return plugin
}

function padd(n, p, c)
{
  var pad_char = typeof c !== 'undefined' ? c : '0';
  var pad = new Array(1 + p).join(pad_char);
  return (pad + n).slice(-pad.length);
}

const wind_format = "%s,2,130306,1,255,8,ff,%s,%s,%s,%s,fa,ff,ff"


var WIND = {
  keys: [
    'environment.wind.angleApparent', 'environment.wind.speedApparent'
  ],
  f: function wind(angle, speed) {
    speed = speed * 100;
    angle = Math.trunc(angle * 10000)
    return util.format(wind_format, (new Date()).toISOString(),
                       padd((speed & 0xff).toString(16), 2),
                       padd(((speed >> 8) & 0xff).toString(16), 2),
                       padd((angle & 0xff).toString(16), 2),
                       padd(((angle >> 8) & 0xff).toString(16), 2));
  }
};

const location_format = "%s,2,129025,1,255,8,%s,%s,%s,%s,%s,%s,%s,%s"

var GPS = {
  keys: [
    'navigation.position'
  ],
  f: function wind(pos) {
    var lat = pos.latitude * 10000000
    var lon = pos.longitude * 10000000
    return util.format(location_format, (new Date()).toISOString(),
                       padd((lat & 0xff).toString(16), 2),
                       padd(((lat >> 8) & 0xff).toString(16), 2),
                       padd(((lat >> 16) & 0xff).toString(16), 2),
                       padd(((lat >> 24) & 0xff).toString(16), 2),
                       padd((lon & 0xff).toString(16), 2),
                       padd(((lon >> 8) & 0xff).toString(16), 2),
                       padd(((lon >> 16) & 0xff).toString(16), 2),
                       padd(((lon >> 24) & 0xff).toString(16), 2))
  }
};
