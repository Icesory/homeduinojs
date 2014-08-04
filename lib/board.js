var Board, Promise, SerialPort, assert, events, serialport,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

serialport = require("serialport");

SerialPort = serialport.SerialPort;

Promise = require('bluebird');

Promise.promisifyAll(SerialPort.prototype);

assert = require('assert');

events = require('events');

Board = (function(_super) {
  __extends(Board, _super);

  Board.prototype._awaitingAck = [];

  function Board(port, baudrate) {
    var openImmediately;
    if (baudrate == null) {
      baudrate = 9600;
    }
    this._waitForAcknowledge = __bind(this._waitForAcknowledge, this);
    this._onAcknowledge = __bind(this._onAcknowledge, this);
    this.serialPort = new SerialPort(port, {
      baudrate: baudrate,
      parser: serialport.parsers.readline("\n")
    }, openImmediately = false);
    this.serialPort.on("data", (function(_this) {
      return function(line) {
        var args, cmd;
        console.log("data:", JSON.stringify(line));
        if (line === "ready") {
          return;
        }
        args = line.split(" ");
        assert(args.length >= 1);
        cmd = args[0];
        args.splice(0, 1);
        switch (cmd) {
          case 'ACK':
          case 'ERR':
            return _this._handleAcknowledge(cmd, args);
          case 'RF':
            return _this._handleRFControl(cmd, args);
          case 'KP':
            return _this._handleKeypad(cmd, args);
          default:
            return console.log("unknown message received: " + data);
        }
      };
    })(this));
  }

  Board.prototype.connect = function() {
    return this.serialPort.openAsync().then((function(_this) {
      return function() {
        return new Promise(function(resolve, reject) {
          return _this.serialPort.once("data", function(line) {
            return resolve();
          });
        }).timeout(3000);
      };
    })(this));
  };

  Board.prototype.digitalWrite = function(pin, value) {
    assert(typeof pin === "number");
    assert(value === 0 || value === 1);
    return this.serialPort.writeAsync("DW " + pin + " " + value + "\n").then(this._waitForAcknowledge);
  };

  Board.prototype.analogWrite = function(pin, value) {
    assert(typeof pin === "number");
    assert(typeof value === "number");
    return this.serialPort.writeAsync("AW " + pin + " " + value + "\n").then(this._waitForAcknowledge);
  };

  Board.prototype.digitalRead = function(pin) {
    assert(typeof pin === "number");
    return this.serialPort.writeAsync("DR " + pin + "\n").then(this._waitForAcknowledge);
  };

  Board.prototype.analogRead = function(pin) {
    assert(typeof pin === "number");
    return this.serialPort.writeAsync("AR " + pin + "\n").then(this._waitForAcknowledge);
  };

  Board.prototype.pinMode = function(pin, mode) {
    assert(typeof pin === "number");
    assert(mode === 0 || mode === 1 || mode === 2);
    return this.serialPort.writeAsync("PM " + pin + " " + mode + "\n").then(this._waitForAcknowledge);
  };

  Board.prototype.readDHT = function(type, pin) {
    assert(type === 11 || type === 22 || type === 33 || type === 44 || type === 55);
    assert(typeof pin === "number");
    return this.serialPort.writeAsync("DHT " + type + " " + pin + "\n").then(this._waitForAcknowledge).then(function(args) {
      return {
        temperature: args[0],
        humidity: args[1]
      };
    });
  };

  Board.prototype.rfControlStartReceiving = function(pin) {
    assert(typeof pin === "number");
    assert(pin === 0 || pin === 1);
    return this.serialPort.writeAsync("RF receive " + pin + "\n").then(this._waitForAcknowledge);
  };

  Board.prototype.rfControlSend = function(pin, pulseLengths, pulses) {
    var i, pl, pulseLengthsArgs, _i, _len;
    assert(typeof pin === "numer");
    assert(Array.isArray(pulseLengths));
    assert(pulseLengths.length <= 8);
    assert(typeof pulses === "string");
    pulseLengthsArgs = "";
    i = 0;
    for (_i = 0, _len = pulseLengths.length; _i < _len; _i++) {
      pl = pulseLengths[_i];
      pulseLengthsArgs += " " + pl;
      i++;
    }
    while (i < 8) {
      pulseLengthsArgs += " 0";
      i++;
    }
    return this.serialPort.writeAsync("RF send " + pin + " " + pulseLengthsArgs + " " + pulses + "\n").then(this._waitForAcknowledge);
  };

  Board.prototype._onAcknowledge = function() {
    return new Promise((function(_this) {
      return function(resolve) {
        return _this._awaitingAck.push(resolve);
      };
    })(this));
  };

  Board.prototype._waitForAcknowledge = function() {
    return this._onAcknowledge().then((function(_this) {
      return function(_arg) {
        var args, cmd;
        cmd = _arg.cmd, args = _arg.args;
        switch (cmd) {
          case 'ERR':
            throw new Error(args[0]);
            break;
          case 'ACK':
            switch (args.length) {
              case 0:
                break;
              case 1:
                return args[0];
              default:
                return args;
            }
            break;
          default:
            return assert(false);
        }
      };
    })(this));
  };

  Board.prototype._handleAcknowledge = function(cmd, args) {
    var resolver;
    assert(this._awaitingAck.length > 0);
    resolver = this._awaitingAck[0];
    resolver({
      cmd: cmd,
      args: args
    });
    this._awaitingAck.splice(0, 1);
  };

  Board.prototype._handleRFControl = function(cmd, args) {
    var pulseLengths, pulses;
    assert(args.length === 10);
    assert(args[0] === 'receive');
    pulseLengths = args.slice(1, 9).map(function(v) {
      return parseInt(v, 10);
    }).filter(function(v) {
      return v !== 0;
    });
    pulses = args[9];
    this.emit('rfReceive', {
      pulseLengths: pulseLengths,
      pulses: pulses
    });
  };

  Board.prototype._handleKeypad = function(cmd, args) {
    var key;
    assert(args.length === 1);
    key = args[0];
    this.emit('keypad', {
      key: key
    });
  };

  return Board;

})(events.EventEmitter);

module.exports = Board;
