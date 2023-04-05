var PYTHON_PATH = "<PYTHON_PATH>"
var PYTHON_COMMAND = "<PYTHON_PATH> <MONITOR_PATH>"

var globalList = []
// find base address of kernel32

var process_createAPI = [
    ["kernelbase.dll", "CreateProcessInternalW"]
 ]

for (var i = 0; i < process_createAPI.length; i++){
    var api = process_createAPI[i]
    var create_process_addr = Module.findExportByName(api[0], api[1])
    if (create_process_addr){
        Interceptor.attach(create_process_addr, {
            onEnter: function(args){
                var app_name = Memory.readUtf16String(args[1])
                var command_line = Memory.readUtf16String(args[2])                var reg1 = /^[^\x20]+(chrome|edge|chromium)\.exe/
                var reg1 = /^[^\x20]+(chrome|edge|chromium)\.exe/
                var reg2 = /^\x22[^\x22]+(chrome|edge|chromium)\.exe[\x22\x20]/
                if (reg1.test(command_line) || reg2.test(command_line) ){

                    var new_command_line = PYTHON_COMMAND + " " + command_line
                    if (app_name != null){
                        var new_app_name = app_name.replace(/[^\x20]+\.exe/, PYTHON_PATH)
                        var new_app_name_address = Memory.allocUtf16String( new_app_name)


                        args[1] = new_app_name_address
                        globalList.push(new_app_name_address)
                    }
                    if (command_line != null){
                        var new_command_address = Memory.allocUtf16String( new_command_line)

                        args[2] = new_command_address
                        globalList.push(new_command_address)

                    }
                }
                else if (command_line.indexOf("chromedriver.exe") !== -1){
                // Coverage of Selenium
                this.chromedriver = true
                this.process_info = args[10]
                }
            },
            onLeave: function(retval) {
                if (retval != 0 && this.chromedriver){
                    var pid = this.process_info.add(2 * Process.pointerSize).readUInt()
                    send({pid:pid})
                    var op = recv('input', value => {

                    })
                    op.wait();
                }
            }

        })

    }
}
