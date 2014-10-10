events = require 'events'

serialport = require("serialport")
SerialPort = serialport.SerialPort

Promise = require 'bluebird'
Promise.promisifyAll(SerialPort.prototype)


class SerialPortserialPort extends events.EventEmitter

  constructor: (port, baudrate)->
    @serialPort = new SerialPort(port, { 
      baudrate, 
      parser: serialport.parsers.readline("\r\n")
    }, openImmediately = no)


  connect: (timeout, retries) ->
    # cleanup
    @ready = no
    @serialPort.removeAllListeners('error')
    @serialPort.removeAllListeners('data')
    @serialPort.removeAllListeners('close')

    @serialPort.on('error', (error) => @emit('error', error) )
    @serialPort.on('close', => @emit 'close' )

    return @serialPort.openAsync().then( =>
      resolver = null

      # setup data listner
      @serialPort.on("data", (data) => 
        console.log data
        # Sanitize data
        line = data.replace(/\0/g, '').trim()
        @emit('data', line) 
        if line is "ready"
          @ready = yes
          @emit 'ready'
          return
        unless @ready
          # got, data but was not ready => reset
          @driver.write("RESET\n").catch( (error) -> @emit("error", error) )
          return
        @emit('line', line) 
      )

      return new Promise( (resolve, reject) =>
        # write ping to force reset (see data listerner) if device was not reseted probably
        Promise.delay(1000).then( =>
          @serialPort.writeAsync("PING\n").catch(reject)
        ).done()
        resolver = resolve
        @once("ready", resolver)
      ).timeout(timeout).catch( (err) =>
        @removeListener("ready", resolver)
        @serialPort.removeAllListeners('data')
        if err.name is "TimeoutError" and retries > 0
          @emit 'reconnect', err
          # try to reconnect
          return @connect(timeout, retries-1)
        else
          throw err
      )
    )

  disconnect: -> @serialPort.closeAsync()

  write: (data) -> @serialPort.writeAsync(data)

module.exports = SerialPortserialPort